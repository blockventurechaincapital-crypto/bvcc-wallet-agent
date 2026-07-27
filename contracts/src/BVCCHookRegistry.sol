// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title BVCCHookRegistry
 * @notice Governed allowlist of Uniswap v4 hooks that a BVCC Agent Wallet may
 *         provide liquidity into. Standalone: it does NOT touch the
 *         BVCCValidatorRegistry or the deployed wallets (those are immutable and
 *         compile the validator registry address in as a constant). The v4
 *         PositionManager validator reads this contract as a constant and, on a
 *         MINT_POSITION, requires `poolKey.hooks == address(0)` (no hook) OR
 *         `isHookApproved(poolKey.hooks)`.
 *
 *         Why a hook allowlist at all: a v4 pool is identified by its PoolKey,
 *         which includes an arbitrary `hooks` contract. A malicious hook can keep
 *         almost everything supplied/withdrawn (afterAddLiquidity / afterRemove
 *         hook delta), charge a ~99% dynamic fee, or revert on remove to trap
 *         funds. Pinning the recipient does NOT protect against this — the hook
 *         drains via the PoolManager's accounting, not by stealing the NFT — so
 *         the only safe posture is default-deny with a curated, timelocked list.
 *
 *         Governance mirrors BVCCValidatorRegistry and is asymmetric:
 *          - Approving a hook (allow direction) sits behind a 48h timelock with an
 *            on-chain event, so wallet owners can react (pauseAgents / revoke) to a
 *            bad proposal before it takes effect.
 *          - Freezing a hook (deny direction) is immediate.
 *          - Owner = the BVCC admin wallet (same one that governs the validators).
 *
 *         Pools with NO hook (`address(0)`) are always allowed by the validator
 *         without being registered here.
 */
contract BVCCHookRegistry {

    /// @notice Delay between proposing a hook (allow direction) and activation.
    uint256 public constant UPDATE_DELAY = 48 hours;

    /// @notice Admin allowed to manage the allowlist (BVCC kill-switch admin wallet).
    address public immutable owner;

    /// @notice Whether a hook is approved. Default-deny (false).
    mapping(address => bool) public approvedHooks;

    /// @notice Timelock: when a proposed hook becomes activatable (0 = none pending).
    mapping(address => uint256) public pendingHookReadyAt;

    error NotOwner();
    error ZeroAddress();
    error NothingPending();
    error TimelockActive();

    event HookProposed(address indexed hook, uint256 readyAt);
    event HookActivated(address indexed hook);
    event HookFrozen(address indexed hook);
    event HookProposalCancelled(address indexed hook);

    constructor(address owner_) {
        require(owner_ != address(0), ZeroAddress());
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, NotOwner());
        _;
    }

    // -------------------------------------------------------------------------
    // Read (called by the PM validator via staticcall)
    // -------------------------------------------------------------------------

    /// @notice True if `hook` is on the approved allowlist. address(0) (no hook)
    ///         is NOT special-cased here — the validator treats it as always
    ///         allowed without registration.
    function isHookApproved(address hook) external view returns (bool) {
        return approvedHooks[hook];
    }

    // -------------------------------------------------------------------------
    // Governance — immediate to deny, timelocked to allow
    // -------------------------------------------------------------------------

    /// @notice Propose a hook for the allowlist. Activatable after 48h.
    function proposeHook(address hook) external onlyOwner {
        require(hook != address(0), ZeroAddress());
        uint256 readyAt = block.timestamp + UPDATE_DELAY;
        pendingHookReadyAt[hook] = readyAt;
        emit HookProposed(hook, readyAt);
    }

    /// @notice Approve a proposed hook once its timelock has elapsed.
    function activateHook(address hook) external onlyOwner {
        uint256 readyAt = pendingHookReadyAt[hook];
        require(readyAt != 0, NothingPending());
        require(block.timestamp >= readyAt, TimelockActive());
        approvedHooks[hook] = true;
        delete pendingHookReadyAt[hook];
        emit HookActivated(hook);
    }

    /// @notice Cancel a pending proposal (deny direction — immediate).
    function cancelHookProposal(address hook) external onlyOwner {
        delete pendingHookReadyAt[hook];
        emit HookProposalCancelled(hook);
    }

    /// @notice Immediately remove a hook from the allowlist (deny direction) AND
    ///         cancel any pending proposal for it, so a stale timelock can't later
    ///         re-approve a hook the admin just killed. New MINT_POSITION calls into
    ///         that hook's pools revert at once; re-approving needs a fresh 48h proposal.
    function freezeHook(address hook) external onlyOwner {
        approvedHooks[hook] = false;
        delete pendingHookReadyAt[hook];
        emit HookFrozen(hook);
    }
}
