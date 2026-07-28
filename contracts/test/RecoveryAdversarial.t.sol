// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCSmartWalletV4} from "../src/BVCCWallet.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/**
 * Adversarial battery for the 2-of-3 guardian recovery.
 *
 * The existing suite covers the happy paths and the access checks. This one attacks the
 * trust model itself: what a single malicious guardian can do, what two colluding ones
 * can do, and what recovery does NOT undo.
 */
contract RecoveryAdversarialTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    // Two genuine P-256 points: executeRecovery validates the new key is on-curve.
    uint256 constant KEY_A_X = 0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978;
    uint256 constant KEY_A_Y = 0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1;
    uint256 constant KEY_B_X = 0x5ECBE4D1A6330A44C8F7EF951D4BF165E6C6B721EFADA985FB41661BC6E7FD6C;
    uint256 constant KEY_B_Y = 0x8734640C4998FF7E374B06CE1A64A2ECD82AB036384FB83D9A79B127A27D5032;

    address g1 = makeAddr("guardian1");
    address g2 = makeAddr("guardian2");
    address g3 = makeAddr("guardian3");
    address attacker = makeAddr("attacker");

    BVCCSmartWalletV4 w;

    function setUp() public {
        w = new BVCCSmartWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([g1, g2, g3], bytes("cred"));
        vm.deal(address(w), 10 ether);
    }

    // ------------------------------------------------------------------ 1
    /**
     * A single malicious guardian can stall recovery indefinitely. initiateRecovery is
     * allowed whenever approvals < 2, and it overwrites the pending key AND zeroes the
     * timelock. So guardian 3 only has to front-run each second approval to keep the
     * honest pair from ever reaching the threshold.
     */
    function test_SingleGuardianCanStallRecoveryIndefinitely() public {
        for (uint256 round = 0; round < 3; round++) {
            vm.prank(g1);
            w.initiateRecovery(KEY_A_X, KEY_A_Y);            // honest target
            assertEq(w.recoveryApprovals(), 1);

            vm.prank(g3);
            w.initiateRecovery(KEY_B_X, KEY_B_Y);            // hijacks it back
            assertEq(w.recoveryApprovals(), 1, "approvals reset to the attacker's single vote");
            assertEq(w.pendingNewSignerX(), KEY_B_X, "pending key is now the attacker's");
            assertEq(w.recoveryReadyAt(), 0, "timelock zeroed");
        }
        // The honest guardians never get to two approvals on their own key.
        (bytes32 sx,) = w.signer();
        assertEq(sx, P256_GX, "owner never rotated: recovery is stalled, not stolen");
    }

    /// @dev The honest pair still wins if they land both calls in one block — the stall is
    ///      a race, not a lock. Shown here so the finding is not overstated.
    function test_HonestPairWinsIfTheyReachTwoApprovalsFirst() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(g2);
        w.approveRecovery();                                  // threshold reached
        assertEq(w.recoveryApprovals(), 2);

        vm.prank(g3);
        vm.expectRevert();                                    // RecoveryAlreadyApproved
        w.initiateRecovery(KEY_B_X, KEY_B_Y);
    }

    // ------------------------------------------------------------------ 2
    /**
     * Recovery rotates the signer and nothing else. An agent authorized before the
     * recovery is still authorized after it — with its budget intact.
     *
     * This matters because compromise is the reason recovery exists: an owner who
     * recovers a wallet believing they have locked the attacker out has not revoked the
     * attacker's agent.
     */
    function test_RecoveryKeepsAgentConfigButPaused() public {
        BVCCAgentWalletV4 aw = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(aw));
        aw.setGuardians([g1, g2, g3], bytes("cred"));
        vm.deal(address(aw), 10 ether);

        address agent = makeAddr("agentBefore");
        address sink = makeAddr("agentSink");
        address[] memory rcpts = new address[](1);
        rcpts[0] = sink;

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.maxPerTxWei = 1 ether;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = rcpts;
        vm.prank(address(aw));
        aw.authorizeAgent(ap);

        // Owner recovers to a fresh passkey.
        vm.prank(g1);
        aw.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(g2);
        aw.approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(g1);
        aw.executeRecovery();
        (bytes32 sx,) = aw.signer();
        assertEq(uint256(sx), KEY_A_X, "signer rotated");

        // The agent's configuration survives — pausing is reversible, revoking is not —
        // but nothing moves until the new owner has reviewed it and unpaused.
        assertTrue(aw.paused());
        vm.prank(address(aw));
        aw.unpauseAgents();
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: sink, value: 1 ether, callData: ""});
        vm.prank(agent);
        aw.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertGt(sink.balance, 0, "config preserved: the new owner can re-enable it deliberately");
    }

    // ------------------------------------------------------------------ 3
    /**
     * Regression: guardians are rotatable by the owner, so a lost or compromised guardian
     * key is no longer permanent. Rotation stays a self-call, and is refused while a
     * recovery is in flight — otherwise a stolen passkey could swap the guardians out
     * from under a recovery already under way.
     */
    function test_OwnerCanRotateGuardiansButNotDuringRecovery() public {
        address[3] memory fresh = [makeAddr("new1"), makeAddr("new2"), makeAddr("new3")];

        vm.prank(address(w));
        w.setGuardians(fresh, bytes("cred"));
        assertEq(w.guardians(0), fresh[0], "owner rotated the set");

        // The old guardians lose their seat immediately.
        vm.prank(g1);
        vm.expectRevert();                                    // NotGuardian
        w.initiateRecovery(KEY_A_X, KEY_A_Y);

        // With a recovery in flight, rotation is refused until the owner cancels.
        vm.prank(fresh[0]);
        w.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(address(w));
        vm.expectRevert(BVCCSmartWalletV4.RecoveryActive.selector);
        w.setGuardians([g1, g2, g3], bytes("cred"));

        vm.prank(address(w));
        w.cancelRecovery();
        vm.prank(address(w));
        w.setGuardians([g1, g2, g3], bytes("cred"));           // cancel first, then rotate
        assertEq(w.guardians(0), g1);
    }

    /// @dev Regression: recovery now pauses agents, so an agent authorized before the
    ///      rotation cannot spend until the new owner reviews the list and unpauses.
    function test_RecoveryPausesAgents() public {
        BVCCAgentWalletV4 aw = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(aw));
        aw.setGuardians([g1, g2, g3], bytes("cred"));
        vm.deal(address(aw), 10 ether);

        address agent = makeAddr("agentPaused");
        address sink = makeAddr("sinkPaused");
        address[] memory rcpts = new address[](1);
        rcpts[0] = sink;
        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.maxPerTxWei = 1 ether;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = rcpts;
        vm.prank(address(aw));
        aw.authorizeAgent(ap);

        vm.prank(g1);
        aw.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(g2);
        aw.approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(g1);
        aw.executeRecovery();

        assertTrue(aw.paused(), "agents paused by the recovery");
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: sink, value: 1 ether, callData: ""});
        vm.prank(agent);
        vm.expectRevert();                                    // EnforcedPause
        aw.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertEq(sink.balance, 0, "the pre-existing agent cannot spend after recovery");
    }

    // ------------------------------------------------------------------ 4
    /**
     * The trust model, stated as a test: two colluding guardians take the wallet if the
     * owner does not cancel inside the 48-hour window. This is by design — it is what
     * makes recovery work — but it means the owner must be watching every chain the
     * wallet exists on.
     */
    function test_TwoColludingGuardiansTakeTheWallet() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_B_X, KEY_B_Y);
        vm.prank(g2);
        w.approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(g2);
        w.executeRecovery();

        (bytes32 sx, bytes32 sy) = w.signer();
        assertEq(uint256(sx), KEY_B_X);
        assertEq(uint256(sy), KEY_B_Y);
        assertEq(address(w).balance, 10 ether, "with the balance still in it");
    }

    /// @dev The owner's defence: cancelling inside the window forces a full restart,
    ///      including a fresh 48 hours.
    function test_OwnerCancelForcesFullRestart() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_B_X, KEY_B_Y);
        vm.prank(g2);
        w.approveRecovery();
        uint256 readyAt = w.recoveryReadyAt();
        assertGt(readyAt, 0);

        vm.prank(address(w));                                 // owner, via passkey
        w.cancelRecovery();
        assertEq(w.recoveryApprovals(), 0);
        assertEq(w.recoveryReadyAt(), 0);

        vm.warp(readyAt + 1);
        vm.prank(g1);
        vm.expectRevert();                                    // NoRecoveryInProgress
        w.executeRecovery();

        // Restarting begins the 48 hours again.
        vm.prank(g1);
        w.initiateRecovery(KEY_B_X, KEY_B_Y);
        vm.prank(g2);
        w.approveRecovery();
        assertGt(w.recoveryReadyAt(), readyAt, "fresh timelock, not the old one");
    }

    /// @dev An EOA cannot cancel — only the wallet itself, i.e. the owner's passkey.
    function test_AttackerCannotCancelOwnersDefence() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_B_X, KEY_B_Y);
        vm.prank(attacker);
        vm.expectRevert();                                    // OnlyWallet
        w.cancelRecovery();
    }

    // ------------------------------------------------------------------ 5
    function test_ExecuteBeforeTimelockReverts() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(g2);
        w.approveRecovery();
        vm.warp(block.timestamp + 48 hours - 1);
        vm.prank(g1);
        vm.expectRevert();                                    // TimelockNotExpired
        w.executeRecovery();
    }

    function test_ExecuteTwiceReverts() public {
        vm.prank(g1);
        w.initiateRecovery(KEY_A_X, KEY_A_Y);
        vm.prank(g2);
        w.approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(g1);
        w.executeRecovery();
        vm.prank(g1);
        vm.expectRevert();                                    // NoRecoveryInProgress
        w.executeRecovery();
    }

    /// @dev A recovery target that is not a point on the curve is rejected at execution.
    function test_OffCurveKeyIsRejected() public {
        vm.prank(g1);
        w.initiateRecovery(uint256(keccak256("nonsenseX")), uint256(keccak256("nonsenseY")));
        vm.prank(g2);
        w.approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(g1);
        vm.expectRevert();                                    // SignerP256InvalidPublicKey
        w.executeRecovery();
    }
}
