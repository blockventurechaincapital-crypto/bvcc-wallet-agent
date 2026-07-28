// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {DeployFactoriesMainnet} from "../script/DeployFactoriesMainnet.s.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/// @dev Always-true validator registry, etched at the predicted CREATE2 address.
contract MockRegistryTrue {
    function validate(address, address, uint256, bytes calldata) external pure returns (bool) {
        return true;
    }
}

/// @dev Trivial protocol target for Case 3 calls.
contract MockProtocol {
    uint256 public hits;
    function poke() external { hits++; }
}

/**
 * @notice Self-checking CREATE2 consistency. If ANY source change drifts the V3
 *         bytecode, these tests fail until the baked constants are re-synced:
 *          - DeployFactoriesMainnet.EXPECTED_* == CREATE2(registry/factories)
 *          - BVCCAgentWalletV4.VALIDATOR_REGISTRY == CREATE2(registry), proven
 *            behaviorally: a DEEP_VALIDATION call only succeeds if the wallet's
 *            compiled constant points at the etched registry address.
 *         This is the freeze-guard for C2: never deploy with these tests red.
 */
contract Create2ConsistencyTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    function test_ScriptConstantsMatchCreate2() public {
        DeployFactoriesMainnet deployScript = new DeployFactoriesMainnet();
        (address reg, address smart, address agent) = deployScript.predicted();

        console.log("predicted REGISTRY:      ", reg);
        console.log("predicted SMART_FACTORY: ", smart);
        console.log("predicted AGENT_FACTORY: ", agent);

        assertEq(deployScript.EXPECTED_REGISTRY(), reg, "script EXPECTED_REGISTRY out of sync");
        assertEq(deployScript.EXPECTED_SMART_FACTORY(), smart, "script EXPECTED_SMART_FACTORY out of sync");
        assertEq(deployScript.EXPECTED_AGENT_FACTORY(), agent, "script EXPECTED_AGENT_FACTORY out of sync");
    }

    /// @dev Proves the wallet's compiled VALIDATOR_REGISTRY constant equals the
    ///      registry's predicted CREATE2 address: the always-true registry is
    ///      etched ONLY there, and a DEEP_VALIDATION call must succeed through it
    ///      (a drifted constant would staticcall a codeless address and revert).
    function test_WalletRegistryConstantMatchesPredicted() public {
        (address reg,,) = new DeployFactoriesMainnet().predicted();
        vm.etch(reg, address(new MockRegistryTrue()).code);

        BVCCAgentWalletV4 wallet = new BVCCAgentWalletV4(P256_GX, P256_GY);
        MockProtocol protocol = new MockProtocol();
        address agent = makeAddr("agent");

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
        wallet.authorizeAgent(ap);

        vm.prank(address(wallet));
        wallet.setCallPolicy(address(protocol), MockProtocol.poke.selector, (1 << 255) | (1 << 254));

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(protocol), value: 0, callData: abi.encodeCall(MockProtocol.poke, ())});
        vm.prank(agent);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(protocol.hits(), 1, "deep-validated call must reach the protocol");
    }
}
