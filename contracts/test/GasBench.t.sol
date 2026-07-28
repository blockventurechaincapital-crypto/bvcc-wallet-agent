// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {BVCCAgentWalletFactoryV4} from "../src/BVCCAgentWalletFactory.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

contract GBProtocol {
    uint256 public hits;
    function poke() external { hits++; }
}

/// @dev Deterministic per-call gas benchmark (gasleft() deltas, fixed inputs) for the
///      solc/optimizer-runs comparison matrix. Not a correctness test — logs numbers.
contract GasBenchTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);
    address[3] GUARDIANS = [address(10), address(11), address(12)];

    function test_gasbench() public {
        // --- wallet creation via factory ---
        BVCCAgentWalletFactoryV4 factory = new BVCCAgentWalletFactoryV4(address(0xBEEF));
        uint256 g = gasleft();
        factory.createWallet(uint256(P256_GX), uint256(P256_GY));
        console.log("GAS createWallet          ", g - gasleft());

        BVCCAgentWalletV4 wallet = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.deal(address(wallet), 10 ether);
        GBProtocol protocol = new GBProtocol();
        address agent = makeAddr("agent");

        // --- authorizeAgent ---
        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](1);
        ap.allowedProtocols[0] = address(protocol);
        ap.allowedRecipients = new address[](0);
        vm.prank(address(wallet));
        g = gasleft();
        wallet.authorizeAgent(ap);
        console.log("GAS authorizeAgent        ", g - gasleft());

        // --- setCallPolicy (allow-only, no deep, no pins) ---
        vm.prank(address(wallet));
        g = gasleft();
        wallet.setCallPolicy(address(protocol), GBProtocol.poke.selector, 1 << 255);
        console.log("GAS setCallPolicy         ", g - gasleft());

        // --- executeAsAgent (Case 3, policy-checked, non-deep) ---
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(protocol), value: 0, callData: abi.encodeCall(GBProtocol.poke, ())});
        bytes memory ed = abi.encode(b);
        vm.prank(agent);
        g = gasleft();
        wallet.executeAsAgent(BATCH_MODE, ed);
        console.log("GAS executeAsAgent Case3  ", g - gasleft());
    }
}
