// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract RecoveryV5Test is V5Base {
    BVCCAgentWalletV5 internal wallet;
    address internal constant G0 = address(0x6000);
    address internal constant G1 = address(0x6001);
    address internal constant G2 = address(0x6002);
    bytes32 internal nx;
    bytes32 internal ny;
    bytes32 internal ox;
    bytes32 internal oy;
    bytes internal constant NEW_CRED = hex"beef02";

    function setUp() public override {
        super.setUp();
        wallet = _createAgent();
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.setGuardians, ([G0, G1, G2])));
        (uint256 x, uint256 y) = vm.publicKeyP256(PK2);
        nx = bytes32(x);
        ny = bytes32(y);
        (x, y) = vm.publicKeyP256(0xC0DE);
        ox = bytes32(x);
        oy = bytes32(y);
    }

    function _vote(address g, bytes32 x, bytes32 y, bytes memory cred) internal {
        vm.prank(g);
        wallet.voteRecovery(x, y, cred);
    }

    function _id(bytes32 x, bytes32 y, bytes memory cred) internal pure returns (bytes32) {
        return keccak256(abi.encode(x, y, keccak256(cred)));
    }

    function _armed() internal view returns (bytes32 id, uint256 readyAt) {
        return wallet.armedRecovery();
    }

    function test_TwoMatchingVotesArm() public {
        _vote(G0, nx, ny, NEW_CRED);
        (bytes32 id,) = _armed();
        assertEq(id, bytes32(0));
        _vote(G1, nx, ny, NEW_CRED);
        uint256 readyAt;
        (id, readyAt) = _armed();
        assertEq(id, _id(nx, ny, NEW_CRED));
        assertEq(readyAt, vm.getBlockTimestamp() + 48 hours);
    }

    function test_DifferentVotesDoNotArm() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, ox, oy, NEW_CRED);
        _vote(G2, nx, ny, hex"00"); // same key, other credential = other proposal
        (bytes32 id,) = _armed();
        assertEq(id, bytes32(0));
    }

    function test_InvalidKeyRejectedAtVote() public {
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.InvalidPublicKey.selector);
        wallet.voteRecovery(bytes32(uint256(1)), bytes32(uint256(2)), NEW_CRED);
    }

    function test_OnlyGuardiansVote() public {
        vm.expectRevert(BVCCSmartWalletV5.NotGuardian.selector);
        wallet.voteRecovery(nx, ny, NEW_CRED);
    }

    function test_ThirdGuardianCannotBlockOrReplace() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        (bytes32 id, uint256 readyAt) = _armed();
        _vote(G2, ox, oy, NEW_CRED); // the third guardian pushes another key
        vm.prank(G2);
        wallet.withdrawRecoveryVote(); // and withdraws its own vote: no effect on the armed one
        (bytes32 id2, uint256 readyAt2) = _armed();
        assertEq(id2, id);
        assertEq(readyAt2, readyAt);
        vm.warp(readyAt);
        vm.prank(G2);
        wallet.executeRecovery();
        (bytes32 x,) = wallet.signer();
        assertEq(x, nx);
    }

    function test_WithdrawKeepsArmedWhileTwoRemain() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        (, uint256 readyAt) = _armed();
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        _vote(G2, nx, ny, NEW_CRED);
        vm.prank(G0);
        wallet.withdrawRecoveryVote();
        (bytes32 id, uint256 readyAt2) = _armed();
        assertEq(id, _id(nx, ny, NEW_CRED));
        assertEq(readyAt2, readyAt, "timer not restarted");
    }

    function test_WithdrawBelowTwoDisarms() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        vm.prank(G1);
        wallet.withdrawRecoveryVote();
        (bytes32 id, uint256 readyAt) = _armed();
        assertEq(id, bytes32(0));
        assertEq(readyAt, 0);
        vm.warp(vm.getBlockTimestamp() + 49 hours);
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.NoRecoveryArmed.selector);
        wallet.executeRecovery();
    }

    function test_MovingVoteFromArmedDisarmsAndMayArmOther() public {
        _vote(G2, ox, oy, NEW_CRED);
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        vm.warp(vm.getBlockTimestamp() + 10 hours);
        _vote(G1, ox, oy, NEW_CRED); // G1 moves to the other proposal
        (bytes32 id, uint256 readyAt) = _armed();
        assertEq(id, _id(ox, oy, NEW_CRED));
        assertEq(readyAt, vm.getBlockTimestamp() + 48 hours, "new proposal gets a fresh delay");
    }

    function test_GriefingGuardianOnlyDelaysOneCycle() public {
        // G2 is malicious: votes with G0, withdraws just before the delay ends.
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G2, nx, ny, NEW_CRED);
        vm.warp(vm.getBlockTimestamp() + 47 hours);
        vm.prank(G2);
        wallet.withdrawRecoveryVote();
        // G1 joins G0: G2 no longer holds up the proposal.
        _vote(G1, nx, ny, NEW_CRED);
        (, uint256 readyAt) = _armed();
        vm.prank(G2);
        vm.expectRevert(BVCCSmartWalletV5.NoVote.selector);
        wallet.withdrawRecoveryVote();
        vm.warp(readyAt);
        vm.prank(G0);
        wallet.executeRecovery();
        (bytes32 x,) = wallet.signer();
        assertEq(x, nx);
    }

    function test_ExecuteBeforeDelayReverts() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        vm.warp(vm.getBlockTimestamp() + 48 hours - 1);
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.TimelockNotExpired.selector);
        wallet.executeRecovery();
    }

    function test_ExecuteSetsKeyCredentialAndPausesAgents() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(G1);
        wallet.executeRecovery();
        (bytes32 x, bytes32 y) = wallet.signer();
        assertEq(x, nx);
        assertEq(y, ny);
        assertEq(wallet.credentialId(), NEW_CRED);
        assertTrue(wallet.paused());
        (bytes32 id,) = _armed();
        assertEq(id, bytes32(0));
        bytes32[3] memory votes = wallet.recoveryVotes();
        assertEq(votes[0], bytes32(0));
        assertEq(votes[1], bytes32(0));
    }

    function test_OwnerCancels() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.cancelRecovery, ()));
        (bytes32 id,) = _armed();
        assertEq(id, bytes32(0));
        vm.warp(vm.getBlockTimestamp() + 49 hours);
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.NoRecoveryArmed.selector);
        wallet.executeRecovery();
    }

    function test_CancelOnlyByOwner() public {
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.OnlyWallet.selector);
        wallet.cancelRecovery();
    }

    function test_SetGuardiansRefusedWhileArmed() public {
        _vote(G0, nx, ny, NEW_CRED);
        _vote(G1, nx, ny, NEW_CRED);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCSmartWalletV5.RecoveryActive.selector);
        wallet.execute(
            _mode(),
            _one(address(wallet), 0, abi.encodeCall(BVCCSmartWalletV5.setGuardians, ([G0, G1, address(0x7)])))
        );
    }

    function test_SetGuardiansClearsUnarmedVotes() public {
        _vote(G0, nx, ny, NEW_CRED);
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.setGuardians, ([G0, G1, address(0x7)])));
        bytes32[3] memory votes = wallet.recoveryVotes();
        assertEq(votes[0], bytes32(0));
        _vote(G1, nx, ny, NEW_CRED);
        (bytes32 id,) = _armed();
        assertEq(id, bytes32(0), "old vote does not count");
    }

    function test_SetGuardiansValidation() public {
        vm.startPrank(address(wallet));
        vm.expectRevert(BVCCSmartWalletV5.InvalidGuardian.selector);
        wallet.setGuardians([G0, G0, G2]);
        vm.expectRevert(BVCCSmartWalletV5.InvalidGuardian.selector);
        wallet.setGuardians([G0, address(0), G2]);
        vm.stopPrank();
        vm.expectRevert(BVCCSmartWalletV5.OnlyWallet.selector);
        wallet.setGuardians([G0, G1, G2]);
    }

    function test_DoubleVoteReverts() public {
        _vote(G0, nx, ny, NEW_CRED);
        vm.prank(G0);
        vm.expectRevert(BVCCSmartWalletV5.AlreadyVoted.selector);
        wallet.voteRecovery(nx, ny, NEW_CRED);
    }
}
