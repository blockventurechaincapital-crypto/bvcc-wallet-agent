// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {BVCCSmartWalletV5} from "./BVCCSmartWalletV5.sol";
import {BVCCAgentLogicV5 as Logic} from "./BVCCAgentLogicV5.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {TransientSlot} from "@openzeppelin/contracts/utils/TransientSlot.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BVCCAgentWalletV5
/// @notice BVCCSmartWalletV5 plus AI agents: EOAs that operate the wallet within
///         per-agent permissions. What leaves the wallet during an agent batch is
///         measured (balance before and after) and charged to the agent's budgets,
///         together with the agent fee on it.
///         Permission logic lives in the BVCCAgentLogicV5 library.
contract BVCCAgentWalletV5 is BVCCSmartWalletV5, ReentrancyGuardTransient, Pausable {
    using TransientSlot for *;

    uint256 public constant MAX_WHITELIST = Logic.MAX_WHITELIST;
    uint256 public constant MAX_TOKENS = Logic.MAX_TOKENS;
    uint256 public constant MAX_MEASURED_TOKENS = Logic.MAX_MEASURED_TOKENS;
    uint256 public constant MAX_AGENT_LIFETIME = Logic.MAX_AGENT_LIFETIME;

    bytes32 private constant CURRENT_AGENT_SLOT = bytes32(uint256(keccak256("bvcc.agentwallet.v5.currentAgent")) - 1);

    /// @notice Registry of deep validators. Fixed for the life of the wallet.
    address public immutable VALIDATOR_REGISTRY;

    error ReentrantAgentExecute();

    event AgentsPaused();
    event AgentsUnpaused();

    Logic.AgentStorage private _agents;

    constructor(address feeWallet, address validatorRegistry) BVCCSmartWalletV5(feeWallet) {
        if (validatorRegistry == address(0)) revert ZeroAddress();
        VALIDATOR_REGISTRY = validatorRegistry;
    }

    // -------------------------------------------------------------------------
    // Owner controls (passkey, through execute)
    // -------------------------------------------------------------------------

    /// @notice Authorizes (or re-configures) an agent. Spending history, call policies
    ///         and the agent's own pause flag are kept.
    function authorizeAgent(Logic.AuthorizeParams calldata p) external {
        _onlySelf();
        Logic.authorize(_agents, p);
    }

    function revokeAgent(address agent) external {
        _onlySelf();
        Logic.revoke(_agents, agent);
    }

    /// @notice Moves an agent's expiry, at most MAX_AGENT_LIFETIME from now.
    function renewAgent(address agent, uint64 newExpiry) external {
        _onlySelf();
        Logic.renew(_agents, agent, newExpiry);
    }

    function increaseBudget(address agent, uint128 additionalWei) external {
        _onlySelf();
        Logic.increaseBudget(_agents, agent, additionalWei);
    }

    function pauseAgent(address agent) external {
        _onlySelf();
        Logic.setPaused(_agents, agent, true);
    }

    function unpauseAgent(address agent) external {
        _onlySelf();
        Logic.setPaused(_agents, agent, false);
    }

    /// @notice Pauses or unpauses every agent. Repeating either call is a no-op, so it is
    ///         safe inside a batch (for example right after a recovery, which pauses).
    function pauseAgents() external {
        _onlySelf();
        if (!paused()) _pause();
        emit AgentsPaused();
    }

    function unpauseAgents() external {
        _onlySelf();
        if (paused()) _unpause();
        emit AgentsUnpaused();
    }

    /// @notice Sets the policy of one (target, selector) for one agent. 0 denies.
    function setAgentCallPolicy(address agent, address target, bytes4 selector, uint256 policy) external {
        _onlySelf();
        Logic.setPolicy(_agents, agent, target, selector, policy);
    }

    /// @notice Sets the values accepted by the S anchors of one (agent, target, selector).
    function setAgentValueSet(address agent, address target, bytes4 selector, bytes32[] calldata values) external {
        _onlySelf();
        Logic.setValueSet(_agents, agent, target, selector, values);
    }

    /// @notice Blocks (or unblocks) a target for every agent at once.
    function setTargetBlocked(address target, bool blocked) external {
        _onlySelf();
        Logic.setBlocked(_agents, target, blocked);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getAgentPermission(address agent) external view returns (Logic.AgentPermission memory) {
        return Logic.permission(_agents, agent);
    }

    function getAgentSpending(address agent) external view returns (Logic.AgentSpending memory) {
        return _agents.spending[agent];
    }

    function getAgents() external view returns (address[] memory) {
        return _agents.agentList;
    }

    function getDailySpent(address agent) external view returns (uint128) {
        return _agents.dailySpent[block.timestamp / 1 days][agent];
    }

    function getTokenSpent(address agent, address token) external view returns (uint128 daily, uint128 total) {
        return (_agents.tokenDailySpent[block.timestamp / 1 days][agent][token], _agents.tokenTotalSpent[agent][token]);
    }

    function getAgentCallPolicy(address agent, address target, bytes4 selector) external view returns (uint256) {
        return _agents.policies[agent][target][selector];
    }

    function getAgentValueSet(address agent, address target, bytes4 selector) external view returns (bytes32[] memory) {
        return _agents.valueSets[agent][target][selector];
    }

    function isTargetBlocked(address target) external view returns (bool) {
        return _agents.blockedTargets[target];
    }

    // -------------------------------------------------------------------------
    // Agent execution
    // -------------------------------------------------------------------------

    /// @notice Runs a batch as an authorized agent. The agent pays its own gas.
    ///   1. agent checks                  5. execute the batch
    ///   2. per-item checks               6. restore the agent's approvals
    ///   3. balances before               7. measure outflows, charge outflow + fee, pay fees
    ///   4. charge native value + fee     8. validator post-checks
    ///   The agent fee (0.15 %) is taken on what leaves the wallet, in the same asset,
    ///   instead of the owner's fee cases of execute. Withdrawals from positions the
    ///   wallet does not measure are charged too: when a validator asks for it, what an
    ///   item brings in is measured around that item and charged as a cost.
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external nonReentrant {
        _requireNotPaused();
        if (!supportsExecutionMode(mode)) revert UnsupportedExecutionMode();
        address agent = msg.sender;
        Logic.Batch memory b = Logic.prepare(_agents, VALIDATOR_REGISTRY, agent, executionData);

        CURRENT_AGENT_SLOT.asAddress().tstore(agent);
        Execution[] calldata batch = ERC7579Utils.decodeBatch(executionData);
        for (uint256 i = 0; i < batch.length; i++) {
            Execution calldata exec = batch[i];
            uint256[] memory inflow = b.inflowTokens[i];
            uint256[] memory start = _balances(b.tokens, inflow);
            if (_isTokenCall(exec.callData, TRANSFER_SELECTOR)) _tokenCall(exec.target, exec.value, exec.callData);
            else _call(exec.target, exec.value, exec.callData);
            uint256[] memory end = _balances(b.tokens, inflow);
            for (uint256 j = 0; j < inflow.length; j++) {
                if (end[j] > start[j]) b.costs[inflow[j]] += end[j] - start[j];
            }
        }
        CURRENT_AGENT_SLOT.asAddress().tstore(address(0));

        Logic.settle(_agents, VALIDATOR_REGISTRY, agent, b, executionData, BVCC_FEE_WALLET);
    }

    /// @dev Balances of the tokens at the given indexes. They were all measured in prepare.
    function _balances(address[] memory tokens, uint256[] memory indexes)
        private
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](indexes.length);
        for (uint256 j = 0; j < indexes.length; j++) {
            balances[j] = IERC20(tokens[indexes[j]]).balanceOf(address(this));
        }
    }

    /// @notice External execute is refused while an agent batch is running.
    function execute(bytes32 mode, bytes calldata executionData) public payable override {
        if (CURRENT_AGENT_SLOT.asAddress().tload() != address(0)) revert ReentrantAgentExecute();
        super.execute(mode, executionData);
    }

    /// @dev After a recovery every agent is paused until the new owner reviews them.
    function _afterRecovery() internal override {
        if (!paused()) _pause();
    }

    function _feeNumerator() internal pure override returns (uint256) {
        return Logic.AGENT_FEE_NUMERATOR; // 0.15 %
    }

    function walletType() public pure override returns (uint8) {
        return 1;
    }
}
