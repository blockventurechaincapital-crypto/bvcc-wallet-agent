// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/**
 * Comparison harness for the candidate fixes. Each scenario ATTEMPTS the drain and logs
 * the outcome instead of asserting it, so the same file can be run against each variant
 * and the results read off side by side.
 *
 *   S1  direct   — batch sends 1 wei to the agent, which re-enters.
 *   S2  CREATE2  — agent is code-less at entry; the batch itself deploys code to the
 *                  agent's address through a whitelisted helper, then pings it.
 *   S3  indirect — batch never targets the agent: a whitelisted intermediary forwards
 *                  value to it, which re-enters.
 */
contract Reenterer {
    BVCCAgentWalletV4 public immutable WALLET;
    address public immutable SINK;
    uint256 public immutable AMOUNT;
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    constructor(BVCCAgentWalletV4 w, address sink, uint256 amount) { WALLET = w; SINK = sink; AMOUNT = amount; }

    receive() external payable {
        Execution[] memory evil = new Execution[](1);
        evil[0] = Execution({target: SINK, value: AMOUNT, callData: ""});
        WALLET.execute(BATCH_MODE, abi.encode(evil));
    }
}

/// @dev A whitelisted protocol that happens to be able to deploy (models any allowed
///      target with a create2 helper). Used to make code appear DURING the batch.
contract Deployer {
    function deploy(bytes32 salt, bytes memory initcode) external returns (address a) {
        assembly { a := create2(0, add(initcode, 0x20), mload(initcode), salt) }
    }
}

/// @dev A whitelisted protocol that forwards value — the batch never names the agent.
contract Pinger {
    function ping(address to) external payable {
        (bool ok, ) = to.call{value: msg.value}("");
        require(ok, "ping failed");
    }
}

contract FixVariantsMatrixTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);
    uint256 constant ALLOWED = 1 << 255;

    uint128 constant TOTAL = 0.003 ether;
    uint256 constant LOOT  = 50 ether;

    BVCCAgentWalletV4 wallet;
    address attacker;

    function _newWallet() internal returns (BVCCAgentWalletV4 w) {
        w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        vm.deal(address(w), 100 ether);
    }

    function _authorize(BVCCAgentWalletV4 w, address agent, address[] memory protocols) internal {
        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.maxPerTxWei = 0.001 ether;
        ap.dailyLimitWei = 0.002 ether;
        ap.totalBudgetWei = TOTAL;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = protocols;
        ap.allowedRecipients = new address[](0);
        vm.prank(address(w));
        w.authorizeAgent(ap);
    }

    function _report(string memory tag) internal {
        if (attacker.balance > TOTAL) {
            emit log_named_string(tag, "DRAINED - variant does not stop this");
            emit log_named_uint("   attacker wei", attacker.balance);
        } else {
            emit log_named_string(tag, "blocked");
        }
    }

    function _attempt(BVCCAgentWalletV4 w, address agent, Execution[] memory b) internal {
        vm.prank(agent);
        (bool ok, bytes memory ret) = address(w).call(
            abi.encodeWithSelector(BVCCAgentWalletV4.executeAsAgent.selector, BATCH_MODE, abi.encode(b))
        );
        if (!ok) {
            bytes4 sel;
            if (ret.length >= 4) assembly { sel := mload(add(ret, 0x20)) }
            emit log_named_bytes32("   revert selector", bytes32(sel));
        }
    }

    function setUp() public {
        attacker = makeAddr("attacker");
    }

    // ---------------------------------------------------------------- S1
    function test_S1_DirectSelfCall() public {
        wallet = _newWallet();
        address agent = makeAddr("agentS1");
        _authorize(wallet, agent, new address[](0));

        Reenterer impl = new Reenterer(wallet, attacker, LOOT);
        vm.etch(agent, address(impl).code);

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: agent, value: 1, callData: ""});
        _attempt(wallet, agent, b);
        _report("S1 direct self-call");
    }

    // ---------------------------------------------------------------- S2
    function test_S2_Create2CodeAppearsMidBatch() public {
        wallet = _newWallet();
        Deployer dep = new Deployer();

        // The agent address IS the CREATE2 address of the malicious contract — code-less
        // until the batch deploys it. An attacker offering "their agent address" can do this.
        bytes memory initcode = abi.encodePacked(
            type(Reenterer).creationCode, abi.encode(wallet, attacker, LOOT)
        );
        bytes32 salt = bytes32(uint256(0xBEEF));
        address agent = vm.computeCreate2Address(salt, keccak256(initcode), address(dep));
        assertEq(agent.code.length, 0, "agent must be code-less at authorization");

        address[] memory protos = new address[](1);
        protos[0] = address(dep);
        _authorize(wallet, agent, protos);
        vm.prank(address(wallet));
        wallet.setCallPolicy(address(dep), Deployer.deploy.selector, ALLOWED);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: address(dep), value: 0,
                          callData: abi.encodeCall(Deployer.deploy, (salt, initcode))});
        b[1] = Execution({target: agent, value: 1, callData: ""});
        _attempt(wallet, agent, b);
        _report("S2 CREATE2 mid-batch");
    }

    // ---------------------------------------------------------------- S3
    function test_S3_IndirectViaWhitelistedProtocol() public {
        wallet = _newWallet();
        Pinger pinger = new Pinger();
        address agent = makeAddr("agentS3");

        address[] memory protos = new address[](1);
        protos[0] = address(pinger);
        _authorize(wallet, agent, protos);
        vm.prank(address(wallet));
        wallet.setCallPolicy(address(pinger), Pinger.ping.selector, ALLOWED);

        Reenterer impl = new Reenterer(wallet, attacker, LOOT);
        vm.etch(agent, address(impl).code);

        // The batch names the PINGER, never the agent.
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(pinger), value: 1,
                          callData: abi.encodeCall(Pinger.ping, (agent))});
        _attempt(wallet, agent, b);
        _report("S3 indirect via protocol");
    }
}
