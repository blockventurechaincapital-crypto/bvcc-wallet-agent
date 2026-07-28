// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCSmartWalletFactoryV4} from "../src/BVCCWalletFactory.sol";
import {BVCCSmartWalletV4} from "../src/BVCCWallet.sol";

contract BVCCSmartWalletFactoryV4Test is Test {
    BVCCSmartWalletFactoryV4 factory;

    // P-256 generator point — valid public key
    uint256 constant PUB_KEY_X = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296;
    uint256 constant PUB_KEY_Y = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5;

    address[3] GUARDIANS = [address(0x10), address(0x20), address(0x30)];
    string constant CRED_ID = "test-credential-id";

    address constant OWNER = address(0xB0CC);

    function setUp() public {
        factory = new BVCCSmartWalletFactoryV4(OWNER);
    }

    // =========================================================================
    // 1. Deterministic address prediction
    // =========================================================================

    function test_DeterministicAddress() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        address deployed  = factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        assertEq(deployed, predicted, "Deployed address must match predicted");
    }

    // =========================================================================
    // 2. Idempotency — createWallet called twice returns same address
    // =========================================================================

    function test_CreateWalletIsIdempotent() public {
        address first  = factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        address second = factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        assertEq(first, second, "Both calls must return the same wallet address");
    }

    // =========================================================================
    // 3. isDeployed — before and after deployment
    // =========================================================================

    function test_IsDeployed() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        assertFalse(factory.isDeployed(predicted), "Should not be deployed yet");
        factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        assertTrue(factory.isDeployed(predicted), "Should be deployed now");
    }

    // =========================================================================
    // 4. WalletCreated event carries only the address and pubkey
    // =========================================================================

    function test_WalletCreatedEventEmitted() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        vm.expectEmit(true, false, false, true);
        emit BVCCSmartWalletFactoryV4.WalletCreated(predicted, PUB_KEY_X, PUB_KEY_Y);
        factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
    }

    // =========================================================================
    // 5. The factory does NOT set guardians — the owner does, with their passkey
    // =========================================================================

    function test_DeployLeavesNoGuardians() public {
        address deployed = factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        BVCCSmartWalletV4 w = BVCCSmartWalletV4(payable(deployed));
        assertEq(w.guardians(0), address(0), "deployer must not choose guardians");
        assertEq(w.guardians(1), address(0));
        assertEq(w.guardians(2), address(0));

        // Whoever deployed it cannot configure it either.
        vm.prank(makeAddr("squatter"));
        vm.expectRevert();                       // OnlyWallet
        w.setGuardians(GUARDIANS, bytes("cred"));

        // The owner sets them through a self-call authenticated by their passkey.
        vm.prank(deployed);
        w.setGuardians(GUARDIANS, bytes("cred"));
        assertEq(w.guardians(0), GUARDIANS[0]);
        assertEq(w.guardians(2), GUARDIANS[2]);
    }

    // =========================================================================
    // 6. Different keys produce different addresses
    // =========================================================================

    function test_DifferentKeysDifferentAddresses() public {
        (uint256 nx, uint256 ny) = vm.publicKeyP256(0xDEADBEEF);
        address addr1 = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        address addr2 = factory.getWalletAddress(nx, ny);
        assertTrue(addr1 != addr2, "Different keys must produce different addresses");
    }

    // =========================================================================
    // 7. Kill switch — one-way, owner only
    // =========================================================================

    function test_OwnerIsSet() public view {
        assertEq(factory.owner(), OWNER);
        assertFalse(factory.killed());
    }

    function test_KillOnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(BVCCSmartWalletFactoryV4.NotOwner.selector);
        factory.kill();
    }

    function test_KillBlocksCreation() public {
        vm.prank(OWNER);
        factory.kill();
        assertTrue(factory.killed());

        vm.expectRevert(BVCCSmartWalletFactoryV4.FactoryKilledError.selector);
        factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
    }

    function test_KillStillAllowsAddressPrediction() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        vm.prank(OWNER);
        factory.kill();
        // getWalletAddress must keep working even after kill
        assertEq(factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y), predicted);
    }

    function test_KillEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit BVCCSmartWalletFactoryV4.FactoryKilled(OWNER);
        vm.prank(OWNER);
        factory.kill();
    }

    function test_CreationWorksBeforeKill() public {
        address deployed = factory.createWallet(PUB_KEY_X, PUB_KEY_Y);
        assertTrue(deployed != address(0));
    }
}
