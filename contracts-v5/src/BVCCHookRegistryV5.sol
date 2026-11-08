// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title BVCCHookRegistryV5
/// @notice Governed allowlist of Uniswap v4 hooks an agent may provide liquidity into.
///         Read by the PositionManager validator. Approving waits UPDATE_DELAY;
///         freezing is immediate. Pools without a hook need no entry.
contract BVCCHookRegistryV5 is Ownable2Step {
    uint256 public constant UPDATE_DELAY = 48 hours;

    mapping(address hook => bool) public approvedHooks;
    mapping(address hook => uint256) public pendingHookReadyAt;

    error NothingPending();
    error TimelockActive();
    error ZeroAddress();

    event HookProposed(address indexed hook, uint256 readyAt);
    event HookActivated(address indexed hook);
    event HookFrozen(address indexed hook);
    event HookProposalCancelled(address indexed hook);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function isHookApproved(address hook) external view returns (bool) {
        return approvedHooks[hook];
    }

    function proposeHook(address hook) external onlyOwner {
        if (hook == address(0)) revert ZeroAddress();
        uint256 readyAt = block.timestamp + UPDATE_DELAY;
        pendingHookReadyAt[hook] = readyAt;
        emit HookProposed(hook, readyAt);
    }

    function activateHook(address hook) external onlyOwner {
        uint256 readyAt = pendingHookReadyAt[hook];
        if (readyAt == 0) revert NothingPending();
        if (block.timestamp < readyAt) revert TimelockActive();
        approvedHooks[hook] = true;
        delete pendingHookReadyAt[hook];
        emit HookActivated(hook);
    }

    function cancelHookProposal(address hook) external onlyOwner {
        delete pendingHookReadyAt[hook];
        emit HookProposalCancelled(hook);
    }

    function freezeHook(address hook) external onlyOwner {
        approvedHooks[hook] = false;
        delete pendingHookReadyAt[hook];
        emit HookFrozen(hook);
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnableInvalidOwner(address(0));
    }
}
