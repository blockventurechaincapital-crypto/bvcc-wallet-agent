// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCHookRegistry} from "../src/BVCCHookRegistry.sol";

contract BVCCHookRegistryTest is Test {
    BVCCHookRegistry internal reg;
    address internal constant ADMIN = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;
    address internal constant OUTSIDER = 0x1234567890123456789012345678901234567890;
    address internal constant HOOK = 0x5555555555555555555555555555555555555555;

    function setUp() public {
        reg = new BVCCHookRegistry(ADMIN);
    }

    function test_defaultDeny() public view {
        assertFalse(reg.isHookApproved(HOOK));
    }

    function test_constructorRejectsZeroOwner() public {
        vm.expectRevert(BVCCHookRegistry.ZeroAddress.selector);
        new BVCCHookRegistry(address(0));
    }

    function test_proposeActivate_afterTimelock() public {
        vm.prank(ADMIN);
        reg.proposeHook(HOOK);
        assertFalse(reg.isHookApproved(HOOK)); // not yet
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        reg.activateHook(HOOK);
        assertTrue(reg.isHookApproved(HOOK));
    }

    function test_activate_beforeTimelock_reverts() public {
        vm.prank(ADMIN);
        reg.proposeHook(HOOK);
        vm.warp(block.timestamp + 47 hours);
        vm.prank(ADMIN);
        vm.expectRevert(BVCCHookRegistry.TimelockActive.selector);
        reg.activateHook(HOOK);
    }

    function test_activate_withoutProposal_reverts() public {
        vm.prank(ADMIN);
        vm.expectRevert(BVCCHookRegistry.NothingPending.selector);
        reg.activateHook(HOOK);
    }

    function test_freeze_isImmediate() public {
        vm.startPrank(ADMIN);
        reg.proposeHook(HOOK);
        vm.warp(block.timestamp + 48 hours);
        reg.activateHook(HOOK);
        assertTrue(reg.isHookApproved(HOOK));
        reg.freezeHook(HOOK);
        vm.stopPrank();
        assertFalse(reg.isHookApproved(HOOK));
    }

    function test_freeze_cancelsPendingProposal() public {
        vm.startPrank(ADMIN);
        reg.proposeHook(HOOK);          // start a 48h timer
        reg.freezeHook(HOOK);           // emergency deny — must also void the pending
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(BVCCHookRegistry.NothingPending.selector);
        reg.activateHook(HOOK);         // stale proposal can no longer re-approve it
        vm.stopPrank();
        assertFalse(reg.isHookApproved(HOOK));
    }

    function test_cancelProposal_blocksActivation() public {
        vm.startPrank(ADMIN);
        reg.proposeHook(HOOK);
        reg.cancelHookProposal(HOOK);
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(BVCCHookRegistry.NothingPending.selector);
        reg.activateHook(HOOK);
        vm.stopPrank();
    }

    function test_onlyOwner_propose() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(BVCCHookRegistry.NotOwner.selector);
        reg.proposeHook(HOOK);
    }

    function test_onlyOwner_freeze() public {
        vm.prank(OUTSIDER);
        vm.expectRevert(BVCCHookRegistry.NotOwner.selector);
        reg.freezeHook(HOOK);
    }

    function test_proposeZeroHook_reverts() public {
        vm.prank(ADMIN);
        vm.expectRevert(BVCCHookRegistry.ZeroAddress.selector);
        reg.proposeHook(address(0));
    }
}
