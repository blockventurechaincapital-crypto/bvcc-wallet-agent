// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletFactoryV2} from "../src/BVCCAgentWalletFactory.sol";

contract BVCCAgentWalletFactoryV2Test is Test {
    BVCCAgentWalletFactoryV2 factory;

    // P-256 generator point — valid public key
    uint256 constant PUB_KEY_X = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296;
    uint256 constant PUB_KEY_Y = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5;

    address[3] GUARDIANS = [address(0x10), address(0x20), address(0x30)];
    string constant CRED_ID = "test-credential-id";

    address constant OWNER = address(0xB0CC);

    function setUp() public {
        factory = new BVCCAgentWalletFactoryV2(OWNER);
    }

    function test_OwnerIsSet() public view {
        assertEq(factory.owner(), OWNER);
        assertFalse(factory.killed());
    }

    function test_CreationWorksBeforeKill() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        address deployed  = factory.createWallet(PUB_KEY_X, PUB_KEY_Y, GUARDIANS, CRED_ID);
        assertEq(deployed, predicted);
    }

    function test_KillOnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(BVCCAgentWalletFactoryV2.NotOwner.selector);
        factory.kill();
    }

    function test_KillBlocksCreation() public {
        vm.prank(OWNER);
        factory.kill();
        assertTrue(factory.killed());

        vm.expectRevert(BVCCAgentWalletFactoryV2.FactoryKilledError.selector);
        factory.createWallet(PUB_KEY_X, PUB_KEY_Y, GUARDIANS, CRED_ID);
    }

    function test_KillStillAllowsAddressPrediction() public {
        address predicted = factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y);
        vm.prank(OWNER);
        factory.kill();
        assertEq(factory.getWalletAddress(PUB_KEY_X, PUB_KEY_Y), predicted);
    }

    function test_KillEmitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit BVCCAgentWalletFactoryV2.FactoryKilled(OWNER);
        vm.prank(OWNER);
        factory.kill();
    }
}
