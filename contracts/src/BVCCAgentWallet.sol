// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BVCCSmartWalletV3} from "./BVCCWallet.sol";
import {IBVCCValidator} from "./IBVCCValidator.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

contract BVCCAgentWalletV3 is BVCCSmartWalletV3, ReentrancyGuard, Pausable {

    uint256 public constant MAX_WHITELIST = 20;

    /// @dev ERC-20 approve(address,uint256) selector — same calldata layout as transfer.
    ///      transfer is decoded via the inherited _isDirectTransfer/_decodeTransfer helpers.
    bytes4 private constant APPROVE_SELECTOR = bytes4(keccak256("approve(address,uint256)"));

    /// @dev Fixed validator registry for DEEP_VALIDATION policies (CREATE2 — same
    ///      address on every chain, deployed BEFORE the factories). Compiled in as
    ///      a constant so policies never carry validator addresses (anti-phishing).
    ///      Must match the address asserted by test/Create2Consistency.t.sol.
    address internal constant VALIDATOR_REGISTRY = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2;

    /// @dev Call-policy word layout (one uint256 per (target, selector)):
    ///      bit 255           = selector allowed (0 == whole policy denied)
    ///      bit 254           = DEEP_VALIDATION via VALIDATOR_REGISTRY (fail-closed)
    ///      bits 223..192     = PIN_WALLET bitmap  (calldata word i == address(this))
    ///      bits 191..160     = PIN_PROTOCOL bitmap (calldata word i in allowedProtocols)
    ///      bits 159..0       = reserved (0)
    uint256 internal constant POLICY_ALLOWED = 1 << 255;
    uint256 internal constant POLICY_DEEP    = 1 << 254;

    error AgentBudgetExceeded();
    error AgentCannotCallWallet();
    error AgentMustBeEOA();
    error AgentNotActive();
    error AgentPermissionsExpired();
    error ArrayLengthMismatch();
    error DailyLimitExceeded();
    error ExceedsPerTxLimit();
    error ExceedsTokenMaxAmount();
    error InvalidAgent();
    error NoProtocolsWhitelisted();
    error NoTokensWhitelisted();
    error NotAuthorizedAgent();
    error OnlyWallet();
    error PeriodBudgetExceeded();
    error ProtocolNotAllowed();
    error RecipientNotAllowed();
    error TokenBatchLimitExceeded();
    error TokenDailyLimitExceeded();
    error TokenTotalBudgetExceeded();
    error TokenNotAllowed();
    error TooManyProtocols();
    error TooManyRecipients();
    error TooManyTokens();
    error UnknownAgent();
    error SelectorNotAllowed();
    error PinnedArgMismatch();
    error CalldataTooShort();
    error PolicyValidationFailed();
    error ZeroAmount();


    struct AgentPermission {
        uint128 maxPerTxWei;        // Max ETH value per single Execution item; 0 = unlimited
        uint128 dailyLimitWei;      // Max ETH per UTC day (resets automatically); 0 = unlimited
        uint128 totalBudgetWei;     // Lifetime ETH budget for this agent; 0 = unlimited
        uint128 totalSpentWei;      // Cumulative ETH spent — PRESERVED on re-authorization
        uint128 periodBudgetWei;    // Max ETH per rolling period; 0 = disabled
        uint128 periodSpentWei;     // ETH spent in current period — PRESERVED on re-authorization
        address[] allowedTokens;     // ERC-20 whitelist; empty = deny all token transfers
        uint128[] tokenMaxAmounts;   // Parallel to allowedTokens; 0 = no per-tx/batch amount limit for that token
        uint128[] tokenDailyLimits;  // Parallel to allowedTokens; max token amount per UTC day; 0 = unlimited
        uint128[] tokenTotalBudgets; // Parallel to allowedTokens; lifetime token amount budget; 0 = unlimited
        address[] allowedProtocols;  // DeFi target whitelist; empty = deny all DeFi calls
        address[] allowedRecipients; // Unified destination whitelist (ETH sends, ERC-20 transfer recipients, approve spenders); empty = any allowed
        uint64  expiry;              // Unix timestamp; 0 = never expires
        uint64  periodDuration;     // Period length in seconds; 0 = disabled
        uint64  periodStart;        // Start of current period — PRESERVED on re-authorization
        bool    active;
    }

    /// @dev Single-struct input for authorizeAgent — avoids stack-too-deep with the
    ///      full permission set and keeps the call ABI tidy.
    struct AuthorizeParams {
        address   agent;
        uint128   maxPerTxWei;
        uint128   dailyLimitWei;
        uint128   totalBudgetWei;
        uint128   periodBudgetWei;
        uint64    periodDuration;
        uint64    expiry;
        address[] allowedTokens;
        uint128[] tokenMaxAmounts;
        uint128[] tokenDailyLimits;
        uint128[] tokenTotalBudgets;
        address[] allowedProtocols;
        address[] allowedRecipients;
    }

    mapping(address => AgentPermission) private _permissions;

    /// @dev day index (block.timestamp / 86400) => agent => ETH spent that day
    mapping(uint32 => mapping(address => uint128)) private _dailySpent;

    /// @dev agent => token => cumulative token amount spent (lifetime). Keyed by token
    ///      address so it survives re-authorization regardless of array order.
    mapping(address => mapping(address => uint128)) private _tokenTotalSpent;

    /// @dev day index => agent => token => token amount spent that UTC day.
    mapping(uint32 => mapping(address => mapping(address => uint128))) private _tokenDailySpent;

    address[] private _agentList;
    mapping(address => bool) private _isAgent;

    /// @dev target => selector => policy word. 0 = denied. Agent Case 3 calls are
    ///      default-deny: a whitelisted protocol is callable only on selectors the
    ///      owner registered here (wallet-global — policies describe the protocol,
    ///      not the agent).
    mapping(address => mapping(bytes4 => uint256)) private _callPolicies;

    event CallPolicySet(address indexed target, bytes4 indexed selector, uint256 policy);

    /// @dev Transient-like flag: set to agent address before super.execute(), cleared after.
    ///      Allows _erc7821AuthorizedExecutor to grant execute() access during agent calls.
    address private _currentAgent;

    event AgentAuthorized(
        address indexed agent,
        uint128 maxPerTxWei,
        uint128 dailyLimitWei,
        uint128 totalBudgetWei,
        uint128 periodBudgetWei,
        uint64  periodDuration,
        uint64  expiry
    );
    event AgentRevoked(address indexed agent);
    event AgentsPaused(address indexed by);
    event AgentsUnpaused(address indexed by);
    event AgentBudgetIncreased(address indexed agent, uint128 additionalWei, uint128 newTotalBudget);
    event AgentExecution(
        address indexed agent,
        uint128 ethSpent,
        uint32 dayIndex,
        uint128 totalSpentWei
    );

    constructor(bytes32 qx, bytes32 qy) BVCCSmartWalletV3(qx, qy) {}

    /**
     * @notice Authorize an AI agent with specific spend permissions.
     * @dev Must be called via execute() — authenticated by Face ID / WebAuthn.
     *      Re-authorizing an existing agent PRESERVES all spending history:
     *      totalSpentWei, periodSpentWei, and periodStart are kept unchanged.
     *      Daily spent (_dailySpent mapping) also persists — resets automatically each UTC day.
     */
    /**
     * @notice Pause all agent operations immediately.
     * @dev Must be called via execute() — authenticated by Face ID / WebAuthn.
     */
    function pauseAgents() external {
        require(msg.sender == address(this), OnlyWallet());
        _pause();
        emit AgentsPaused(address(this));
    }

    /**
     * @notice Unpause agent operations.
     * @dev Must be called via execute() — authenticated by Face ID / WebAuthn.
     */
    function unpauseAgents() external {
        require(msg.sender == address(this), OnlyWallet());
        _unpause();
        emit AgentsUnpaused(address(this));
    }

    function authorizeAgent(AuthorizeParams calldata p) external {
        require(msg.sender == address(this), OnlyWallet());
        require(p.agent != address(0), InvalidAgent());
        require(p.agent.code.length == 0, AgentMustBeEOA());
        require(
            p.allowedTokens.length == p.tokenMaxAmounts.length &&
            p.allowedTokens.length == p.tokenDailyLimits.length &&
            p.allowedTokens.length == p.tokenTotalBudgets.length,
            ArrayLengthMismatch()
        );
        require(p.allowedTokens.length <= MAX_WHITELIST, TooManyTokens());
        require(p.allowedProtocols.length <= MAX_WHITELIST, TooManyProtocols());
        require(p.allowedRecipients.length <= MAX_WHITELIST, TooManyRecipients());

        if (!_isAgent[p.agent]) {
            _agentList.push(p.agent);
            _isAgent[p.agent] = true;
        }

        // Field-by-field assignment (keeps stack shallow vs a struct literal).
        // totalSpentWei, periodSpentWei and periodStart are intentionally NOT written:
        // for a new agent they are already zero; for a re-authorization they are
        // preserved (spending history kept). Per-token spent lives in mappings keyed
        // by token address, so it is likewise preserved regardless of array order.
        AgentPermission storage perm = _permissions[p.agent];
        perm.maxPerTxWei       = p.maxPerTxWei;
        perm.dailyLimitWei     = p.dailyLimitWei;
        perm.totalBudgetWei    = p.totalBudgetWei;
        perm.periodBudgetWei   = p.periodBudgetWei;
        perm.allowedTokens     = p.allowedTokens;
        perm.tokenMaxAmounts   = p.tokenMaxAmounts;
        perm.tokenDailyLimits  = p.tokenDailyLimits;
        perm.tokenTotalBudgets = p.tokenTotalBudgets;
        perm.allowedProtocols  = p.allowedProtocols;
        perm.allowedRecipients = p.allowedRecipients;
        perm.expiry            = p.expiry;
        perm.periodDuration    = p.periodDuration;
        perm.active            = true;

        emit AgentAuthorized(p.agent, p.maxPerTxWei, p.dailyLimitWei, p.totalBudgetWei, p.periodBudgetWei, p.periodDuration, p.expiry);
    }

    /**
     * @notice Revoke an agent's permissions immediately.
     * @dev Sets active = false. Does not delete state (spending history preserved).
     *      Must be called via execute() — authenticated by Face ID / WebAuthn.
     */
    function revokeAgent(address agent) external {
        require(msg.sender == address(this), OnlyWallet());
        require(_isAgent[agent], UnknownAgent());
        _permissions[agent].active = false;
        emit AgentRevoked(agent);
    }

    /**
     * @notice Increase an agent's lifetime budget without re-authorizing.
     * @dev Preserves all spending history (totalSpentWei, periodSpentWei).
     *      Must be called via execute() — authenticated by Face ID / WebAuthn.
     */
    function increaseBudget(address agent, uint128 additionalWei) external {
        require(msg.sender == address(this), OnlyWallet());
        require(_isAgent[agent] && _permissions[agent].active, AgentNotActive());
        require(additionalWei > 0, ZeroAmount());
        _permissions[agent].totalBudgetWei += additionalWei;
        emit AgentBudgetIncreased(agent, additionalWei, _permissions[agent].totalBudgetWei);
    }

    /**
     * @notice Returns full AgentPermission struct including arrays.
     * @dev The auto-generated getter for the mapping does NOT return dynamic arrays inside structs.
     */
    function getAgentPermission(address agent) external view returns (AgentPermission memory) {
        return _permissions[agent];
    }

    /// @notice Returns all agent addresses ever authorized (including revoked).
    function getAgents() external view returns (address[] memory) {
        return _agentList;
    }

    /// @notice Returns ETH spent by the agent today (UTC day, resets automatically).
    function getDailySpent(address agent) external view returns (uint128) {
        return _dailySpent[uint32(block.timestamp / 86400)][agent];
    }

    /// @notice Returns a token's spent amounts for an agent: today (UTC) and lifetime.
    function getTokenSpent(address agent, address token)
        external
        view
        returns (uint128 dailySpent, uint128 totalSpent)
    {
        return (
            _tokenDailySpent[uint32(block.timestamp / 86400)][agent][token],
            _tokenTotalSpent[agent][token]
        );
    }

    /**
     * @notice Execute transactions on behalf of the wallet as an authorized AI agent.
     * @dev The agent (msg.sender) must be authorized. Permissions are enforced on-chain.
     *      The agent pays gas from their own EOA. The wallet's BVCC fee logic still applies.
     *
     *      Validation order:
     *        1. active + expiry
     *        2. Per-item: target != address(this), maxPerTxWei, call-type whitelist
     *        3. Period budget auto-rollover + check (if periodBudgetWei > 0 && periodDuration > 0)
     *        4. dailyLimitWei (cumulative ETH this UTC day)
     *        5. totalBudgetWei (cumulative ETH lifetime)
     *      State updated BEFORE execution (checks-effects-interactions + nonReentrant).
     */
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external nonReentrant whenNotPaused {
        address agent = msg.sender;
        AgentPermission storage perm = _permissions[agent];

        require(perm.active, NotAuthorizedAgent());
        require(
            perm.expiry == 0 || block.timestamp < uint256(perm.expiry),
            AgentPermissionsExpired()
        );

        // Decode batch — same calldata slice pattern as parent execute()
        Execution[] calldata batch = ERC7579Utils.decodeBatch(executionData);

        // Validate each item; accumulate total ETH and per-token batch amounts.
        uint256 totalEth = 0;
        uint256[] memory tokenAccumulated = new uint256[](perm.allowedTokens.length);

        for (uint256 i = 0; i < batch.length; i++) {
            _validateExecutionItem(perm, batch[i]);
            totalEth += batch[i].value;

            // Accumulate token transfer AND approve amounts for the per-token spend
            // checks below. approve must count toward daily/total budgets too:
            // otherwise an agent could approve(spender, amount) (only per-tx capped)
            // and drain via an external transferFrom, bypassing tokenDailyLimits /
            // tokenTotalBudgets entirely. approve() has the same calldata layout as
            // transfer(), so _decodeTransfer works for both.
            // NOTE: ERC-20 approve overwrites (not adds) the allowance, so charging
            // every approve amount as spend is intentionally conservative — it never
            // under-counts (the safe direction); repeated approves to the same spender
            // may over-count, which only tightens the budget.
            if (_isDirectTransfer(batch[i].callData) || _isApprove(batch[i].callData)) {
                (, uint256 amount) = _decodeTransfer(batch[i].callData);
                for (uint256 j = 0; j < perm.allowedTokens.length; j++) {
                    if (perm.allowedTokens[j] == batch[i].target) {
                        tokenAccumulated[j] += amount;
                        break;
                    }
                }
            }
        }

        uint32 today = uint32(block.timestamp / 86400);

        // Per-token limits over the batch's cumulative amount of each token.
        // Extracted to a helper to keep executeAsAgent's stack shallow.
        for (uint256 i = 0; i < perm.allowedTokens.length; i++) {
            if (tokenAccumulated[i] > 0) {
                _applyTokenSpend(perm, i, agent, today, tokenAccumulated[i]);
            }
        }

        // Period budget: auto-rollover then check (both 0 = disabled)
        if (perm.periodBudgetWei > 0 && perm.periodDuration > 0) {
            if (block.timestamp >= uint256(perm.periodStart) + uint256(perm.periodDuration)) {
                perm.periodSpentWei = 0;
                perm.periodStart    = uint64(block.timestamp);
            }
            require(
                uint256(perm.periodSpentWei) + totalEth <= uint256(perm.periodBudgetWei),
                PeriodBudgetExceeded()
            );
        }

        // Daily limit check (0 = unlimited)
        if (perm.dailyLimitWei > 0) {
            require(
                uint256(_dailySpent[today][agent]) + totalEth <= uint256(perm.dailyLimitWei),
                DailyLimitExceeded()
            );
        }

        // Total budget check (0 = unlimited)
        if (perm.totalBudgetWei > 0) {
            require(
                uint256(perm.totalSpentWei) + totalEth <= uint256(perm.totalBudgetWei),
                AgentBudgetExceeded()
            );
        }

        // Update state BEFORE execution (reentrancy safety; nonReentrant also protects)
        // Explicit bound: the limit checks above only run when the corresponding cap
        // is non-zero, so an all-unlimited agent could otherwise truncate silently.
        require(totalEth <= type(uint128).max, AgentBudgetExceeded());
        uint128 ethSpent = uint128(totalEth);
        _dailySpent[today][agent] += ethSpent;
        perm.totalSpentWei        += ethSpent;
        perm.periodSpentWei       += ethSpent;

        // Authorize parent execute() for this call via _currentAgent flag.
        // Cleared after super.execute(). If super.execute() reverts, entire tx reverts
        // (including _currentAgent = agent), so no persistent dirty state is possible.
        _currentAgent = agent;
        super.execute(mode, executionData);
        _currentAgent = address(0);

        emit AgentExecution(agent, ethSpent, today, perm.totalSpentWei);
    }

    /**
     * @dev Checks and updates per-token spend limits for one token over a batch's
     *      cumulative amount: per-batch cap, daily cap (UTC), and lifetime budget.
     *      Spent counters are keyed by token address so they survive re-authorization.
     */
    function _applyTokenSpend(
        AgentPermission storage perm,
        uint256 i,
        address agent,
        uint32 day,
        uint256 amount
    ) internal {
        address token = perm.allowedTokens[i];

        uint128 cap = perm.tokenMaxAmounts[i];
        if (cap > 0) require(amount <= uint256(cap), TokenBatchLimitExceeded());

        // Cache the inner mappings as storage pointers to avoid deep triple-nesting.
        mapping(address => uint128) storage daySlot = _tokenDailySpent[day][agent];
        mapping(address => uint128) storage totSlot = _tokenTotalSpent[agent];

        uint128 dl = perm.tokenDailyLimits[i];
        if (dl > 0) {
            require(uint256(daySlot[token]) + amount <= uint256(dl), TokenDailyLimitExceeded());
        }
        uint128 tb = perm.tokenTotalBudgets[i];
        if (tb > 0) {
            require(uint256(totSlot[token]) + amount <= uint256(tb), TokenTotalBudgetExceeded());
        }
        daySlot[token] += uint128(amount);
        totSlot[token] += uint128(amount);
    }

    /**
     * @dev Per-item permission checks. All checks are view-only (no state changes).
     *      NOTE: exec is calldata because executeAsAgent receives executionData as calldata
     *      and decodes via ERC7579Utils.decodeBatch which returns a calldata slice.
     *      This ensures _isDirectTransfer() and _decodeTransfer() assembly patterns work correctly.
     */
    function _validateExecutionItem(
        AgentPermission storage perm,
        Execution calldata exec
    ) internal view {
        // Prevent privilege escalation: agent cannot call wallet functions directly.
        // Combined with require(msg.sender == address(this)) in owner functions, this is safe.
        require(exec.target != address(this), AgentCannotCallWallet());

        // Per-transaction ETH value limit (0 = unlimited)
        if (perm.maxPerTxWei > 0) {
            require(exec.value <= uint256(perm.maxPerTxWei), ExceedsPerTxLimit());
        }

        // Determine call type and apply corresponding whitelist checks.
        // allowedRecipients (if set) is a single unified destination whitelist applied to:
        // native ETH sends, ERC-20 transfer() recipients, and approve() spenders.
        if (exec.value > 0 && exec.callData.length == 0) {
            // ── Case 1: Pure ETH send ──────────────────────────────────────
            _checkRecipient(perm, exec.target);

        } else if (_isDirectTransfer(exec.callData)) {
            // ── Case 2: ERC-20 transfer(to, amount) ────────────────────────
            (address to, uint256 amount) = _decodeTransfer(exec.callData);
            _checkTokenWhitelistAndAmount(perm, exec.target, amount);
            _checkRecipient(perm, to);

        } else if (_isApprove(exec.callData)) {
            // ── Case 2b: ERC-20 approve(spender, amount) ───────────────────
            // Same calldata layout as transfer. The spender is gated by the recipient
            // whitelist so an agent cannot approve an unlisted address to pull funds.
            (address spender, uint256 amount) = _decodeTransfer(exec.callData);
            _checkTokenWhitelistAndAmount(perm, exec.target, amount);
            _checkRecipient(perm, spender);

        } else {
            // ── Case 3: DeFi / Swap ────────────────────────────────────────
            require(perm.allowedProtocols.length > 0, NoProtocolsWhitelisted());
            require(_isAllowedProtocol(perm, exec.target), ProtocolNotAllowed());
            _checkCallPolicy(perm, exec);
        }
    }

    /**
     * @notice Register, update or revoke (policy = 0) the call policy for a
     *         (target, selector) pair. See the policy word layout above.
     * @dev Must be called via execute() — authenticated by Face ID / WebAuthn.
     */
    function setCallPolicy(address target, bytes4 selector, uint256 policy) external {
        require(msg.sender == address(this), OnlyWallet());
        _callPolicies[target][selector] = policy;
        emit CallPolicySet(target, selector, policy);
    }

    function getCallPolicy(address target, bytes4 selector) external view returns (uint256) {
        return _callPolicies[target][selector];
    }

    /// @dev Linear membership check over the agent's protocol whitelist (<= 20 items).
    function _isAllowedProtocol(AgentPermission storage perm, address a) internal view returns (bool) {
        for (uint256 i = 0; i < perm.allowedProtocols.length; i++) {
            if (perm.allowedProtocols[i] == a) return true;
        }
        return false;
    }

    /**
     * @dev Case 3 policy enforcement: default-deny per selector; pinned calldata
     *      words must be the wallet (PIN_WALLET) or a whitelisted protocol
     *      (PIN_PROTOCOL); DEEP_VALIDATION defers to the fixed registry.
     *      Reading past calldata end yields 0 => pin mismatch => revert, so no
     *      per-word bounds check is needed (fail-closed).
     */
    function _checkCallPolicy(AgentPermission storage perm, Execution calldata exec) internal view {
        bytes calldata data = exec.callData;
        require(data.length >= 4, CalldataTooShort());
        bytes4 sel;
        assembly { sel := calldataload(data.offset) }
        uint256 policy = _callPolicies[exec.target][sel];
        require(policy & POLICY_ALLOWED != 0, SelectorNotAllowed());

        uint256 pinsW = (policy >> 192) & 0xFFFFFFFF;
        uint256 pinsP = (policy >> 160) & 0xFFFFFFFF;
        for (uint256 w = 0; (pinsW | pinsP) >> w != 0; w++) {
            if (((pinsW | pinsP) >> w) & 1 == 0) continue;
            uint256 word;
            assembly { word := calldataload(add(data.offset, add(4, mul(w, 32)))) }
            if ((pinsW >> w) & 1 == 1) {
                // Full-word compare also rejects dirty high bits.
                require(word == uint256(uint160(address(this))), PinnedArgMismatch());
            } else {
                require(word >> 160 == 0 && _isAllowedProtocol(perm, address(uint160(word))), PinnedArgMismatch());
            }
        }

        if (policy & POLICY_DEEP != 0) {
            // Fail-closed: a revert in the registry (or no code at the address)
            // bubbles up and denies; an explicit false is rejected here.
            require(
                IBVCCValidator(VALIDATOR_REGISTRY).validate(address(this), exec.target, exec.value, data),
                PolicyValidationFailed()
            );
        }
    }

    /// @dev Reverts if `dest` is not in the agent's destination whitelist.
    ///      Empty whitelist = any destination allowed.
    function _checkRecipient(AgentPermission storage perm, address dest) internal view {
        uint256 len = perm.allowedRecipients.length;
        if (len == 0) return;
        for (uint256 i = 0; i < len; i++) {
            if (perm.allowedRecipients[i] == dest) return;
        }
        revert RecipientNotAllowed();
    }

    /// @dev Reverts unless `token` is whitelisted; enforces the per-tx amount cap if set.
    function _checkTokenWhitelistAndAmount(
        AgentPermission storage perm,
        address token,
        uint256 amount
    ) internal view {
        require(perm.allowedTokens.length > 0, NoTokensWhitelisted());
        for (uint256 i = 0; i < perm.allowedTokens.length; i++) {
            if (perm.allowedTokens[i] == token) {
                if (perm.tokenMaxAmounts[i] > 0) {
                    require(amount <= uint256(perm.tokenMaxAmounts[i]), ExceedsTokenMaxAmount());
                }
                return;
            }
        }
        revert TokenNotAllowed();
    }

    /// @dev True if calldata is an ERC-20 approve(address,uint256) call.
    function _isApprove(bytes calldata data) internal pure returns (bool) {
        if (data.length < 68) return false;
        bytes4 sel;
        assembly { sel := calldataload(data.offset) }
        return sel == APPROVE_SELECTOR;
    }

    /**
     * @dev Override to allow the current agent to call execute() during executeAsAgent().
     *      _currentAgent is set immediately before super.execute() and cleared after.
     *      The caller check (caller == _currentAgent) is tight — only the exact agent EOA
     *      is authorized, not any DeFi callback contracts whose msg.sender would differ.
     */
    function _erc7821AuthorizedExecutor(
        address caller,
        bytes32 mode,
        bytes calldata data
    ) internal view override returns (bool) {
        if (_currentAgent != address(0) && caller == _currentAgent) return true;
        return super._erc7821AuthorizedExecutor(caller, mode, data);
    }

    /// @notice 1500 / 1_000_000 = 0.15% fee for agent wallets.
    function _feeNumerator() internal view override returns (uint256) { return 1500; }

    /// @notice Returns 1 — identifies this contract as an AI Agent wallet on-chain.
    function walletType() public pure override returns (uint8) {
        return 1;
    }
}
