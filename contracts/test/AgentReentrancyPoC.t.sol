// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/**
 * PoC — cross-function reentrancy through the _currentAgent flag.
 *
 * Slither flags `reentrancy-eth` in executeAsAgent because `_currentAgent` is written
 * after super.execute(). The dismissal "an agent is an EOA and cannot be re-entered"
 * relies on `AgentMustBeEOA`, which is checked ONLY at authorizeAgent time. EIP-7702
 * lets an EOA gain code afterwards, signed with that same EOA's key — the very key an
 * attacker holds in the "stolen agent key" threat model.
 *
 * vm.etch models the post-authorization delegation: code now lives at the agent address,
 * so a call to it runs that code with msg.sender == agent on the way back in.
 */
contract Reenterer {
    BVCCAgentWalletV4 public immutable WALLET;
    address public immutable SINK;
    uint256 public immutable AMOUNT;
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    constructor(BVCCAgentWalletV4 w, address sink, uint256 amount) {
        WALLET = w; SINK = sink; AMOUNT = amount;
    }

    /// @dev Runs while the wallet is mid-batch, so _currentAgent == address(this).
    receive() external payable {
        Execution[] memory evil = new Execution[](1);
        evil[0] = Execution({target: SINK, value: AMOUNT, callData: ""});
        WALLET.execute(BATCH_MODE, abi.encode(evil));
    }
}

/// @dev Whitelisted helper able to deploy — models code appearing during the batch.
contract Deployer {
    function deploy(bytes32 salt, bytes memory initcode) external returns (address a) {
        assembly { a := create2(0, add(initcode, 0x20), mload(initcode), salt) }
    }
}

contract AgentReentrancyPoCTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    BVCCAgentWalletV4 wallet;
    address agent;
    address attacker;

    // Deliberately tiny caps: the whole point is that the drain ignores them.
    uint128 constant MAX_PER_TX = 0.001 ether;
    uint128 constant DAILY      = 0.002 ether;
    uint128 constant TOTAL      = 0.003 ether;

    function setUp() public {
        wallet = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(wallet));
        wallet.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        vm.deal(address(wallet), 100 ether);
        agent = makeAddr("agent");
        attacker = makeAddr("attacker");
        vm.deal(agent, 1 ether);

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;                 // still code-less here: AgentMustBeEOA passes
        ap.maxPerTxWei = MAX_PER_TX;
        ap.dailyLimitWei = DAILY;
        ap.totalBudgetWei = TOTAL;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = new address[](0);   // documented default: empty = unrestricted
        vm.prank(address(wallet));
        wallet.authorizeAgent(ap);
    }

    /// @notice Baseline: without code at the agent address the caps hold.
    function test_Baseline_CapsHold() public {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: attacker, value: 50 ether, callData: ""});
        vm.prank(agent);
        vm.expectRevert();                       // ExceedsPerTxLimit
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertEq(attacker.balance, 0);
    }

    /**
     * @notice Regression, layer 1: an agent carrying code is rejected at the front door.
     *
     * Before the fix this exact call drained 50 ETH minus the wallet's 0.15% fee — the fee
     * itself proving it had travelled the owner-level execute() path, where no agent cap is
     * consulted. executeAsAgent now re-checks the EOA invariant on every execution.
     */
    function test_Regression_CodeBearingAgentRejected() public {
        Reenterer impl = new Reenterer(wallet, attacker, 50 ether);
        vm.etch(agent, address(impl).code);      // models the EIP-7702 delegation

        // A 1 wei transfer to the agent — trivially inside every cap — hands it control.
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: agent, value: 1, callData: ""});

        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV4.AgentMustBeEOA.selector);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(attacker.balance, 0, "nothing moved");
        assertEq(address(wallet).balance, 100 ether, "wallet untouched");
    }

    /**
     * @notice Regression, layer 2: the reentrancy guard holds on its own, in the one case the
     *         front-door check cannot catch — the agent is genuinely code-less on entry and
     *         the batch deploys code to its address mid-flight (CREATE2, no EIP-7702 needed).
     *         Layer 1 therefore passes, and only the execute() guard stands between the
     *         attacker and the drain. Reverting with ReentrantAgentExecute is the proof.
     */
    function test_Regression_ReentrancyGuardHoldsIndependently() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        vm.deal(address(w), 100 ether);
        Deployer dep = new Deployer();

        // The agent address IS where the malicious contract will land.
        bytes memory initcode = abi.encodePacked(
            type(Reenterer).creationCode, abi.encode(w, attacker, uint256(50 ether))
        );
        bytes32 salt = bytes32(uint256(0xBEEF));
        address lateAgent = vm.computeCreate2Address(salt, keccak256(initcode), address(dep));
        assertEq(lateAgent.code.length, 0, "code-less on entry: layer 1 cannot catch this");

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = lateAgent;
        ap.maxPerTxWei = MAX_PER_TX;
        ap.dailyLimitWei = DAILY;
        ap.totalBudgetWei = TOTAL;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](1);
        ap.allowedProtocols[0] = address(dep);
        ap.allowedRecipients = new address[](0);
        vm.prank(address(w));
        w.authorizeAgent(ap);
        vm.prank(address(w));
        w.setCallPolicy(address(dep), Deployer.deploy.selector, 1 << 255);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: address(dep), value: 0,
                          callData: abi.encodeCall(Deployer.deploy, (salt, initcode))});
        b[1] = Execution({target: lateAgent, value: 1, callData: ""});

        vm.prank(lateAgent);
        vm.expectRevert(BVCCAgentWalletV4.ReentrantAgentExecute.selector);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(attacker.balance, 0, "nothing moved");
        assertEq(address(w).balance, 100 ether, "wallet untouched");
    }

    /// @notice A non-empty allowedRecipients that omits the agent closes the entry point:
    ///         the batch can no longer hand control to the agent address.
    function test_RecipientWhitelist_BlocksTheEntry() public {
        address[] memory rcpts = new address[](1);
        rcpts[0] = makeAddr("payroll");
        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.maxPerTxWei = MAX_PER_TX;
        ap.dailyLimitWei = DAILY;
        ap.totalBudgetWei = TOTAL;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = rcpts;
        vm.prank(address(wallet));
        wallet.authorizeAgent(ap);

        Reenterer impl = new Reenterer(wallet, attacker, 50 ether);
        vm.etch(agent, address(impl).code);

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: agent, value: 1, callData: ""});
        vm.prank(agent);
        vm.expectRevert();                       // RecipientNotAllowed
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertEq(attacker.balance, 0);
    }
}
