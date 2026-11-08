// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "./IBVCCValidatorV5.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BVCCAgentLogicV5
/// @notice Agent permissions and the checks around an agent batch, for BVCCAgentWalletV5.
///         External library: reached by DELEGATECALL, so it runs in the wallet's
///         context (address(this) is the wallet, storage is the wallet's). Stateless itself.
library BVCCAgentLogicV5 {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 internal constant MAX_WHITELIST = 20;
    uint256 internal constant MAX_TOKENS = 50;
    /// @dev MAX_TOKENS allowed tokens + room for tokens found in the batch.
    uint256 internal constant MAX_MEASURED_TOKENS = 60;
    uint256 internal constant MAX_AGENT_LIFETIME = 365 days;
    uint256 internal constant PROBE_GAS_CAP = 100_000;

    /// @dev Agent fee: 0.15 % of everything an agent batch charges to its budgets
    ///      (what leaves the wallet plus validator costs such as new debt), paid in
    ///      the same asset and counted in the same budgets.
    uint256 internal constant AGENT_FEE_NUMERATOR = 1500;
    uint256 internal constant FEE_DENOMINATOR = 1_000_000;

    bytes4 internal constant TRANSFER_SELECTOR = 0xa9059cbb; // transfer(address,uint256)
    bytes4 internal constant APPROVE_SELECTOR = 0x095ea7b3; // approve(address,uint256)

    /// @dev Call-policy word, one per (agent, target, selector):
    ///      bit 255        selector allowed
    ///      bit 254        DEEP: ask the validator registry; required for every protocol call
    ///      bits 223..192  W: calldata word i == this wallet
    ///      bits 191..160  P: calldata word i is an allowed protocol
    ///      bits 159..128  T: calldata word i is an allowed token
    ///      bits 127..96   R: calldata word i is an allowed recipient
    ///      bits 95..64    S: calldata word i is in the policy's value set
    ///      every other bit is reserved and must be zero
    uint256 internal constant POLICY_ALLOWED = 1 << 255;
    uint256 internal constant POLICY_DEEP = 1 << 254;
    uint256 internal constant POLICY_RESERVED = (((1 << 30) - 1) << 224) | ((1 << 64) - 1);

    uint256 private constant NOT_FOUND = type(uint256).max;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @dev Every cap means "at most this much"; 0 allows nothing. An unlimited cap is
    ///      type(uint128).max, set on purpose. maxPerTxWei caps the native value of a
    ///      whole batch. The period cap only applies when periodDuration > 0.
    struct AgentPermission {
        uint128 maxPerTxWei;
        uint128 dailyLimitWei;
        uint128 totalBudgetWei;
        uint128 periodBudgetWei;
        uint64 periodDuration;
        uint64 expiry;
        bool active;
        bool paused;
        address[] allowedTokens;
        uint128[] tokenMaxAmounts;
        uint128[] tokenDailyLimits;
        uint128[] tokenTotalBudgets;
        address[] allowedProtocols;
        address[] allowedRecipients;
    }

    /// @dev Spending history, kept across re-authorizations.
    struct AgentSpending {
        uint128 totalSpentWei;
        uint128 periodSpentWei;
        uint64 periodStart;
    }

    struct AuthorizeParams {
        address agent;
        uint128 maxPerTxWei;
        uint128 dailyLimitWei;
        uint128 totalBudgetWei;
        uint128 periodBudgetWei;
        uint64 periodDuration;
        uint64 expiry;
        address[] allowedTokens;
        uint128[] tokenMaxAmounts;
        uint128[] tokenDailyLimits;
        uint128[] tokenTotalBudgets;
        address[] allowedProtocols;
        address[] allowedRecipients;
    }

    struct AgentStorage {
        mapping(address agent => AgentPermission) permissions;
        mapping(address agent => AgentSpending) spending;
        mapping(uint256 day => mapping(address agent => uint128)) dailySpent;
        mapping(address agent => mapping(address token => uint128)) tokenTotalSpent;
        mapping(uint256 day => mapping(address agent => mapping(address token => uint128))) tokenDailySpent;
        mapping(address agent => mapping(address target => mapping(bytes4 selector => uint256))) policies;
        mapping(address agent => mapping(address target => mapping(bytes4 selector => bytes32[]))) valueSets;
        mapping(address target => bool) blockedTargets;
        address[] agentList;
        mapping(address agent => bool) isAgent;
    }

    /// @dev Working state of one agent batch, between prepare and settle.
    struct Batch {
        address[] tokens;
        uint256[] before;
        uint256[] costs;
        uint256 tokenCount;
        address[] approvalTokens;
        address[] approvalSpenders;
        uint256[] approvalPrevious;
        uint256 approvalCount;
        bool[] postCheck;
        /// @dev Per item: indexes of the tokens whose inflow during that item is charged.
        uint256[][] inflowTokens;
        uint256 eth;
        uint256 ethFee;
    }

    // -------------------------------------------------------------------------
    // Errors and events
    // -------------------------------------------------------------------------

    error AgentCannotCallWallet();
    error AgentMustBeEOA();
    error AgentPaused();
    error AgentPermissionsExpired();
    error ArrayLengthMismatch();
    error BudgetOverflow();
    error CalldataTooShort();
    error CallNeedsValidator();
    error DailyLimitExceeded();
    error ExceedsPerTxLimit();
    error FeeTransferFailed();
    error InvalidAgent();
    error InvalidExpiry();
    error InvalidPolicy();
    error MeasurementFailed();
    error NotAuthorizedAgent();
    error PeriodBudgetExceeded();
    error PinnedArgMismatch();
    error PolicyValidationFailed();
    error PostCheckFailed();
    error ProtocolNotAllowed();
    error RecipientNotAllowed();
    error SelectorNotAllowed();
    error TargetIsBlocked();
    error TokenBatchLimitExceeded();
    error TokenCallWithValue();
    error TokenDailyLimitExceeded();
    error TokenNotAllowed();
    error TokenTotalBudgetExceeded();
    error TooManyMeasuredTokens();
    error TooManyProtocols();
    error TooManyRecipients();
    error TooManyTokens();
    error TooManyValues();
    error TotalBudgetExceeded();
    error UnknownAgent();
    error ZeroAmount();

    event AgentAuthorized(
        address indexed agent,
        uint128 maxPerTxWei,
        uint128 dailyLimitWei,
        uint128 totalBudgetWei,
        uint128 periodBudgetWei,
        uint64 periodDuration,
        uint64 expiry
    );
    event AgentRevoked(address indexed agent);
    event AgentRenewed(address indexed agent, uint64 expiry);
    event AgentBudgetIncreased(address indexed agent, uint128 additionalWei, uint128 newTotalBudget);
    event AgentPausedSet(address indexed agent, bool paused);
    event AgentCallPolicySet(address indexed agent, address indexed target, bytes4 indexed selector, uint256 policy);
    event AgentValueSetUpdated(address indexed agent, address indexed target, bytes4 indexed selector, bytes32[] values);
    event TargetBlocked(address indexed target, bool blocked);
    /// @dev Charges include the fees.
    event AgentExecution(
        address indexed agent,
        uint256 ethCharged,
        uint256 ethFee,
        address[] tokens,
        uint256[] tokenCharges,
        uint256[] tokenFees
    );

    // -------------------------------------------------------------------------
    // Owner configuration (the wallet checks that the caller is itself)
    // -------------------------------------------------------------------------

    function authorize(AgentStorage storage s, AuthorizeParams calldata p) external {
        address agent = p.agent;
        if (agent == address(0) || agent == address(this)) revert InvalidAgent();
        if (agent.code.length != 0) revert AgentMustBeEOA();
        _checkExpiry(p.expiry);
        uint256 n = p.allowedTokens.length;
        if (p.tokenMaxAmounts.length != n || p.tokenDailyLimits.length != n || p.tokenTotalBudgets.length != n) {
            revert ArrayLengthMismatch();
        }
        if (n > MAX_TOKENS) revert TooManyTokens();
        if (p.allowedProtocols.length > MAX_WHITELIST) revert TooManyProtocols();
        if (p.allowedRecipients.length > MAX_WHITELIST) revert TooManyRecipients();

        if (!s.isAgent[agent]) {
            s.isAgent[agent] = true;
            s.agentList.push(agent);
        }
        AgentPermission storage perm = s.permissions[agent];
        perm.maxPerTxWei = p.maxPerTxWei;
        perm.dailyLimitWei = p.dailyLimitWei;
        perm.totalBudgetWei = p.totalBudgetWei;
        perm.periodBudgetWei = p.periodBudgetWei;
        perm.periodDuration = p.periodDuration;
        perm.expiry = p.expiry;
        perm.active = true;
        perm.allowedTokens = p.allowedTokens;
        perm.tokenMaxAmounts = p.tokenMaxAmounts;
        perm.tokenDailyLimits = p.tokenDailyLimits;
        perm.tokenTotalBudgets = p.tokenTotalBudgets;
        perm.allowedProtocols = p.allowedProtocols;
        perm.allowedRecipients = p.allowedRecipients;
        emit AgentAuthorized(
            agent, p.maxPerTxWei, p.dailyLimitWei, p.totalBudgetWei, p.periodBudgetWei, p.periodDuration, p.expiry
        );
    }

    function revoke(AgentStorage storage s, address agent) external {
        _requireKnown(s, agent);
        s.permissions[agent].active = false;
        emit AgentRevoked(agent);
    }

    function renew(AgentStorage storage s, address agent, uint64 newExpiry) external {
        _requireKnown(s, agent);
        _checkExpiry(newExpiry);
        s.permissions[agent].expiry = newExpiry;
        emit AgentRenewed(agent, newExpiry);
    }

    function increaseBudget(AgentStorage storage s, address agent, uint128 additionalWei) external {
        _requireKnown(s, agent);
        if (additionalWei == 0) revert ZeroAmount();
        AgentPermission storage perm = s.permissions[agent];
        uint256 total = uint256(perm.totalBudgetWei) + additionalWei;
        if (total > type(uint128).max) revert BudgetOverflow();
        perm.totalBudgetWei = uint128(total);
        emit AgentBudgetIncreased(agent, additionalWei, uint128(total));
    }

    function setPaused(AgentStorage storage s, address agent, bool value) external {
        _requireKnown(s, agent);
        s.permissions[agent].paused = value;
        emit AgentPausedSet(agent, value);
    }

    function setPolicy(AgentStorage storage s, address agent, address target, bytes4 selector, uint256 policy)
        external
    {
        if (policy & POLICY_RESERVED != 0) revert InvalidPolicy();
        s.policies[agent][target][selector] = policy;
        emit AgentCallPolicySet(agent, target, selector, policy);
    }

    function setValueSet(
        AgentStorage storage s,
        address agent,
        address target,
        bytes4 selector,
        bytes32[] calldata values
    ) external {
        if (values.length > MAX_WHITELIST) revert TooManyValues();
        s.valueSets[agent][target][selector] = values;
        emit AgentValueSetUpdated(agent, target, selector, values);
    }

    function setBlocked(AgentStorage storage s, address target, bool blocked) external {
        s.blockedTargets[target] = blocked;
        emit TargetBlocked(target, blocked);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function permission(AgentStorage storage s, address agent) external view returns (AgentPermission memory) {
        return s.permissions[agent];
    }

    // -------------------------------------------------------------------------
    // Agent batch: before execution
    // -------------------------------------------------------------------------

    /// @notice Agent checks, per-item checks, balances before and the native charge.
    function prepare(AgentStorage storage s, address registry, address agent, bytes calldata executionData)
        external
        returns (Batch memory b)
    {
        AgentPermission storage perm = s.permissions[agent];
        if (agent.code.length != 0) revert AgentMustBeEOA();
        if (!perm.active) revert NotAuthorizedAgent();
        if (block.timestamp >= perm.expiry) revert AgentPermissionsExpired();
        if (perm.paused) revert AgentPaused();

        Execution[] calldata items = ERC7579Utils.decodeBatch(executionData);
        b = _newBatch(perm, items.length);
        for (uint256 i = 0; i < items.length; i++) {
            _checkItem(s, registry, agent, perm, items[i], b, i);
        }
        for (uint256 i = 0; i < b.tokenCount; i++) {
            (bool ok, uint256 balance) = _tryBalanceOf(b.tokens[i]);
            if (!ok) revert MeasurementFailed();
            b.before[i] = balance;
        }
        _trim(b);
        b.ethFee = _fee(b.eth);
        _chargeNative(s, agent, perm, b.eth + b.ethFee);
    }

    function _newBatch(AgentPermission storage perm, uint256 itemCount) private view returns (Batch memory b) {
        b.tokens = new address[](MAX_MEASURED_TOKENS);
        b.before = new uint256[](MAX_MEASURED_TOKENS);
        b.costs = new uint256[](MAX_MEASURED_TOKENS);
        b.approvalTokens = new address[](itemCount);
        b.approvalSpenders = new address[](itemCount);
        b.approvalPrevious = new uint256[](itemCount);
        b.postCheck = new bool[](itemCount);
        b.inflowTokens = new uint256[][](itemCount);
        uint256 n = perm.allowedTokens.length;
        for (uint256 i = 0; i < n; i++) {
            _addToken(b, perm.allowedTokens[i]);
        }
    }

    function _checkItem(
        AgentStorage storage s,
        address registry,
        address agent,
        AgentPermission storage perm,
        Execution calldata item,
        Batch memory b,
        uint256 i
    ) private view {
        address target = item.target;
        bytes calldata data = item.callData;
        if (target == address(this)) revert AgentCannotCallWallet();
        if (s.blockedTargets[target]) revert TargetIsBlocked();
        b.eth += item.value;

        if (item.value > 0 && data.length == 0) {
            if (!_contains(perm.allowedRecipients, target)) revert RecipientNotAllowed();
        } else if (_isTokenCall(data, TRANSFER_SELECTOR)) {
            if (item.value != 0) revert TokenCallWithValue();
            if (!_contains(perm.allowedTokens, target)) revert TokenNotAllowed();
            if (!_contains(perm.allowedRecipients, _firstArgument(data))) revert RecipientNotAllowed();
        } else if (_isTokenCall(data, APPROVE_SELECTOR)) {
            if (item.value != 0) revert TokenCallWithValue();
            if (!_contains(perm.allowedTokens, target)) revert TokenNotAllowed();
            address spender = _firstArgument(data);
            if (!_contains(perm.allowedProtocols, spender)) revert ProtocolNotAllowed();
            _recordApproval(b, target, spender);
        } else {
            if (data.length < 4) revert CalldataTooShort();
            if (!_contains(perm.allowedProtocols, target)) revert ProtocolNotAllowed();
            bytes4 selector = bytes4(data[0:4]);
            uint256 policy = s.policies[agent][target][selector];
            if (policy & POLICY_ALLOWED == 0) revert SelectorNotAllowed();
            if (policy & POLICY_RESERVED != 0) revert InvalidPolicy();
            if (policy & POLICY_DEEP == 0) revert CallNeedsValidator();
            _checkAnchors(s.valueSets[agent][target][selector], perm, policy, data);
            _scanCalldata(b, target, data);
            (bool ok, address[] memory extra, IBVCCValidatorV5.Cost[] memory costs, bool post, bool inflow) =
                IBVCCValidatorV5(registry).validate(agent, address(this), target, item.value, data);
            if (!ok) revert PolicyValidationFailed();
            uint256[] memory indexes = new uint256[](inflow ? extra.length : 0);
            for (uint256 j = 0; j < extra.length; j++) {
                uint256 index = _addToken(b, extra[j]);
                if (inflow) indexes[j] = index;
            }
            for (uint256 j = 0; j < costs.length; j++) {
                b.costs[_addToken(b, costs[j].token)] += costs[j].amount;
            }
            b.postCheck[i] = post;
            b.inflowTokens[i] = indexes;
        }
    }

    /// @dev Every anchored word must lie inside the call's own calldata.
    function _checkAnchors(
        bytes32[] storage valueSet,
        AgentPermission storage perm,
        uint256 policy,
        bytes calldata data
    ) private view {
        uint256 pinW = (policy >> 192) & 0xFFFFFFFF;
        uint256 pinP = (policy >> 160) & 0xFFFFFFFF;
        uint256 pinT = (policy >> 128) & 0xFFFFFFFF;
        uint256 pinR = (policy >> 96) & 0xFFFFFFFF;
        uint256 pinS = (policy >> 64) & 0xFFFFFFFF;
        uint256 all = pinW | pinP | pinT | pinR | pinS;
        for (uint256 w = 0; all >> w != 0; w++) {
            if ((all >> w) & 1 == 0) continue;
            uint256 start = 4 + w * 32;
            if (data.length < start + 32) revert PinnedArgMismatch();
            bytes32 word = bytes32(data[start:start + 32]);
            bool isAddress = uint256(word) >> 160 == 0;
            address account = address(uint160(uint256(word)));
            if ((pinW >> w) & 1 == 1 && !(isAddress && account == address(this))) revert PinnedArgMismatch();
            if ((pinP >> w) & 1 == 1 && !(isAddress && _contains(perm.allowedProtocols, account))) {
                revert PinnedArgMismatch();
            }
            if ((pinT >> w) & 1 == 1 && !(isAddress && _contains(perm.allowedTokens, account))) {
                revert PinnedArgMismatch();
            }
            if ((pinR >> w) & 1 == 1 && !(isAddress && _contains(perm.allowedRecipients, account))) {
                revert PinnedArgMismatch();
            }
            if ((pinS >> w) & 1 == 1 && !_containsValue(valueSet, word)) revert PinnedArgMismatch();
        }
    }

    /// @dev Adds the target and every address-shaped calldata word that answers balanceOf,
    ///      except ERC-721 contracts: their balanceOf counts NFTs, not an amount, and burning
    ///      a position would read as an outflow. Allowed tokens are always measured anyway.
    function _scanCalldata(Batch memory b, address target, bytes calldata data) private view {
        (bool isToken,) = _tryBalanceOf(target);
        if (isToken && !_isERC721(target)) _addToken(b, target);
        uint256 words = (data.length - 4) / 32;
        for (uint256 i = 0; i < words; i++) {
            bytes32 word = bytes32(data[4 + i * 32:36 + i * 32]);
            if (bytes12(word) != bytes12(0)) continue;
            address candidate = address(uint160(uint256(word)));
            if (candidate == address(0) || candidate == address(this) || _indexIn(b, candidate) != NOT_FOUND) {
                continue;
            }
            (isToken,) = _tryBalanceOf(candidate);
            if (isToken && !_isERC721(candidate)) _addToken(b, candidate);
        }
    }

    function _addToken(Batch memory b, address token) private pure returns (uint256 index) {
        index = _indexIn(b, token);
        if (index != NOT_FOUND) return index;
        index = b.tokenCount;
        if (index == MAX_MEASURED_TOKENS) revert TooManyMeasuredTokens();
        b.tokens[index] = token;
        b.tokenCount = index + 1;
    }

    function _indexIn(Batch memory b, address token) private pure returns (uint256) {
        for (uint256 i = 0; i < b.tokenCount; i++) {
            if (b.tokens[i] == token) return i;
        }
        return NOT_FOUND;
    }

    function _recordApproval(Batch memory b, address token, address spender) private view {
        uint256 n = b.approvalCount;
        for (uint256 i = 0; i < n; i++) {
            if (b.approvalTokens[i] == token && b.approvalSpenders[i] == spender) return;
        }
        b.approvalTokens[n] = token;
        b.approvalSpenders[n] = spender;
        b.approvalPrevious[n] = _allowance(token, spender);
        b.approvalCount = n + 1;
    }

    function _chargeNative(AgentStorage storage s, address agent, AgentPermission storage perm, uint256 eth)
        private
    {
        if (eth == 0) return;
        if (eth > perm.maxPerTxWei) revert ExceedsPerTxLimit();
        AgentSpending storage spent = s.spending[agent];
        uint256 day = block.timestamp / 1 days;
        uint256 daily = uint256(s.dailySpent[day][agent]) + eth;
        if (daily > perm.dailyLimitWei) revert DailyLimitExceeded();
        uint256 total = uint256(spent.totalSpentWei) + eth;
        if (total > perm.totalBudgetWei) revert TotalBudgetExceeded();
        if (perm.periodDuration > 0) {
            uint256 periodSpent = spent.periodSpentWei;
            if (block.timestamp >= uint256(spent.periodStart) + perm.periodDuration) {
                periodSpent = 0;
                spent.periodStart = uint64(block.timestamp);
            }
            periodSpent += eth;
            if (periodSpent > perm.periodBudgetWei) revert PeriodBudgetExceeded();
            spent.periodSpentWei = uint128(periodSpent);
        }
        s.dailySpent[day][agent] = uint128(daily);
        spent.totalSpentWei = uint128(total);
    }

    // -------------------------------------------------------------------------
    // Agent batch: after execution
    // -------------------------------------------------------------------------

    /// @notice Restores the agent's approvals, charges what left the wallet plus the
    ///         agent fee, pays the fees and runs the validators' post-checks.
    function settle(
        AgentStorage storage s,
        address registry,
        address agent,
        Batch memory b,
        bytes calldata executionData,
        address feeWallet
    ) external {
        for (uint256 i = 0; i < b.approvalCount; i++) {
            IERC20(b.approvalTokens[i]).forceApprove(b.approvalSpenders[i], b.approvalPrevious[i]);
        }
        (uint256[] memory charges, uint256[] memory fees, uint256[] memory afters) =
            _chargeTokens(s, agent, s.permissions[agent], b);
        for (uint256 i = 0; i < b.tokenCount; i++) {
            if (fees[i] == 0) continue;
            IERC20(b.tokens[i]).safeTransfer(feeWallet, fees[i]);
            // Paying the fee must not take more than the fee (tokens that tax the sender).
            (bool ok, uint256 balance) = _tryBalanceOf(b.tokens[i]);
            if (!ok || balance + fees[i] < afters[i]) revert FeeTransferFailed();
        }
        if (b.ethFee > 0) {
            (bool sent,) = feeWallet.call{value: b.ethFee}("");
            if (!sent) revert FeeTransferFailed();
        }

        Execution[] calldata items = ERC7579Utils.decodeBatch(executionData);
        for (uint256 i = 0; i < items.length; i++) {
            if (!b.postCheck[i]) continue;
            if (!IBVCCValidatorV5(registry).validateAfter(agent, address(this), items[i].target, items[i].callData)) {
                revert PostCheckFailed();
            }
        }

        address[] memory measured = b.tokens;
        uint256 count = b.tokenCount;
        assembly ("memory-safe") {
            mstore(measured, count)
        }
        emit AgentExecution(agent, b.eth + b.ethFee, b.ethFee, measured, charges, fees);
    }

    /// @dev outflow = balance before - balance after, if positive
    ///      costs   = validator costs + what flowed in during items whose validator asked so
    ///      fee     = agent fee on (outflow + costs)
    ///      charge  = outflow + costs + fee
    ///      Any charge on a token the agent may not move reverts.
    function _chargeTokens(AgentStorage storage s, address agent, AgentPermission storage perm, Batch memory b)
        private
        returns (uint256[] memory charges, uint256[] memory fees, uint256[] memory afters)
    {
        charges = new uint256[](b.tokenCount);
        fees = new uint256[](b.tokenCount);
        afters = new uint256[](b.tokenCount);
        uint256 day = block.timestamp / 1 days;
        for (uint256 i = 0; i < b.tokenCount; i++) {
            address token = b.tokens[i];
            (bool ok, uint256 balanceAfter) = _tryBalanceOf(token);
            if (!ok) revert MeasurementFailed();
            afters[i] = balanceAfter;
            uint256 outflow = b.before[i] > balanceAfter ? b.before[i] - balanceAfter : 0;
            uint256 fee = _fee(outflow + b.costs[i]);
            uint256 charge = outflow + b.costs[i] + fee;
            if (charge == 0) continue;
            charges[i] = charge;
            fees[i] = fee;
            uint256 idx = _indexOf(perm.allowedTokens, token);
            if (idx == NOT_FOUND) revert TokenNotAllowed();
            if (charge > perm.tokenMaxAmounts[idx]) revert TokenBatchLimitExceeded();
            uint256 daily = uint256(s.tokenDailySpent[day][agent][token]) + charge;
            if (daily > perm.tokenDailyLimits[idx]) revert TokenDailyLimitExceeded();
            uint256 total = uint256(s.tokenTotalSpent[agent][token]) + charge;
            if (total > perm.tokenTotalBudgets[idx]) revert TokenTotalBudgetExceeded();
            s.tokenDailySpent[day][agent][token] = uint128(daily);
            s.tokenTotalSpent[agent][token] = uint128(total);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev Cuts the measured-token arrays to the tokens actually found, so the batch
    ///      passed to settle carries only those.
    function _trim(Batch memory b) private pure {
        address[] memory tokens = b.tokens;
        uint256[] memory before = b.before;
        uint256[] memory costs = b.costs;
        uint256 n = b.tokenCount;
        assembly ("memory-safe") {
            mstore(tokens, n)
            mstore(before, n)
            mstore(costs, n)
        }
    }

    function _fee(uint256 amount) private pure returns (uint256) {
        return (amount * AGENT_FEE_NUMERATOR) / FEE_DENOMINATOR;
    }

    function _requireKnown(AgentStorage storage s, address agent) private view {
        if (!s.isAgent[agent]) revert UnknownAgent();
    }

    function _checkExpiry(uint64 expiry) private view {
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_AGENT_LIFETIME) revert InvalidExpiry();
    }

    function _isTokenCall(bytes calldata data, bytes4 selector) private pure returns (bool) {
        return data.length >= 68 && bytes4(data[0:4]) == selector;
    }

    /// @dev First ABI word after the selector, as an address. Dirty high bits revert.
    function _firstArgument(bytes calldata data) private pure returns (address) {
        uint256 word = uint256(bytes32(data[4:36]));
        if (word >> 160 != 0) revert PinnedArgMismatch();
        return address(uint160(word));
    }

    /// @dev Gas-capped balanceOf that copies at most 32 bytes of return data.
    function _tryBalanceOf(address token) private view returns (bool ok, uint256 bal) {
        if (token.code.length == 0) return (false, 0);
        uint256 cap = PROBE_GAS_CAP;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x70a08231))
            mstore(add(ptr, 4), address())
            let success := staticcall(cap, token, ptr, 0x24, ptr, 0x20)
            ok := and(success, gt(returndatasize(), 0x1f))
            bal := mul(mload(ptr), ok)
        }
    }

    /// @dev Gas-capped ERC-165 check for the ERC-721 interface (0x80ac58cd).
    function _isERC721(address token) private view returns (bool yes) {
        uint256 cap = PROBE_GAS_CAP;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x01ffc9a7))
            mstore(add(ptr, 4), shl(224, 0x80ac58cd))
            let success := staticcall(cap, token, ptr, 0x24, ptr, 0x20)
            yes := and(and(success, gt(returndatasize(), 0x1f)), eq(mload(ptr), 1))
        }
    }

    /// @dev Gas-capped allowance read that copies at most 32 bytes of return data.
    function _allowance(address token, address spender) private view returns (uint256 value) {
        uint256 cap = PROBE_GAS_CAP;
        bool ok;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0xdd62ed3e))
            mstore(add(ptr, 4), address())
            mstore(add(ptr, 0x24), spender)
            let success := staticcall(cap, token, ptr, 0x44, ptr, 0x20)
            ok := and(success, gt(returndatasize(), 0x1f))
            value := mload(ptr)
        }
        if (!ok) revert MeasurementFailed();
    }

    function _contains(address[] storage list, address a) private view returns (bool) {
        return _indexOf(list, a) != NOT_FOUND;
    }

    function _indexOf(address[] storage list, address a) private view returns (uint256) {
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == a) return i;
        }
        return NOT_FOUND;
    }

    function _containsValue(bytes32[] storage list, bytes32 v) private view returns (bool) {
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == v) return true;
        }
        return false;
    }
}
