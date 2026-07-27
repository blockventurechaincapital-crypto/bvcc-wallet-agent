// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV3} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock
// ---------------------------------------------------------------------------
contract MockERC20Adv {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Mock swap target
// ---------------------------------------------------------------------------
contract MockSwapTargetAdv {
    function swap(address tokenOut, uint256 amountOut) external {
        MockERC20Adv(tokenOut).mint(msg.sender, amountOut);
    }
}

// ---------------------------------------------------------------------------
// Mock reentrancy attacker
// ---------------------------------------------------------------------------
contract MockReentrantAdv {
    BVCCAgentWalletV3 public target;
    bytes32 public mode;
    bytes public execData;

    function setup(BVCCAgentWalletV3 _target, bytes32 _mode, bytes calldata _execData) external {
        target = _target;
        mode = _mode;
        execData = _execData;
    }

    receive() external payable {
        target.executeAsAgent(mode, execData);
    }

    fallback() external payable {
        target.executeAsAgent(mode, execData);
    }
}

// ---------------------------------------------------------------------------
// Advanced test contract — categories H–L + security + wallet type
// ---------------------------------------------------------------------------
contract BVCCAgentWalletV3AdvancedTest is Test {
    using ERC7579Utils for *;

    address constant ENTRY_POINT     = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;
    bytes32 constant BATCH_MODE      = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX         = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY         = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);
    uint256 constant FEE_NUM         = 1500;
    uint256 constant FEE_DEN         = 1_000_000;
    address constant BVCC_FEE_WALLET = 0x3e3eb089169a7315a994947465ce5f5FC3A307D4;

    BVCCAgentWalletV3  agentWallet;
    MockERC20Adv     token;
    MockSwapTargetAdv swapTarget;
    address          agent1;
    address          agent2;

    function setUp() public {
        agentWallet = new BVCCAgentWalletV3(P256_GX, P256_GY);
        token       = new MockERC20Adv();
        swapTarget  = new MockSwapTargetAdv();
        agentWallet.setGuardians([address(10), address(11), address(12)]);
        vm.deal(address(agentWallet), 100 ether);
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        vm.deal(agent1, 1 ether);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _batch(address target, uint256 value, bytes memory data)
        internal pure returns (bytes memory)
    {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: value, callData: data});
        return abi.encode(b);
    }

    function _authorize(
        address agent, uint128 maxPerTx, uint128 daily, uint128 totalBudget,
        uint128 periodBudget, uint64 periodDuration,
        address[] memory tokens, uint128[] memory tokenAmounts,
        address[] memory protocols, address[] memory recipients, uint64 expiry
    ) internal {
        vm.prank(address(agentWallet));
        agentWallet.authorizeAgent(_ap(
            agent, maxPerTx, daily, totalBudget, periodBudget, periodDuration,
            tokens, tokenAmounts, protocols, recipients, expiry
        ));
    }

    /// @dev Builds an AuthorizeParams struct, defaulting per-token daily/total caps
    ///      to zero arrays sized to `tokens` (i.e. unlimited per token).
    function _ap(
        address agent,
        uint128 maxPerTx,
        uint128 daily,
        uint128 totalBudget,
        uint128 periodBudget,
        uint64  periodDuration,
        address[] memory tokens,
        uint128[] memory tokenAmounts,
        address[] memory protocols,
        address[] memory recipients,
        uint64 expiry
    ) internal pure returns (BVCCAgentWalletV3.AuthorizeParams memory ap) {
        ap.agent             = agent;
        ap.maxPerTxWei       = maxPerTx;
        ap.dailyLimitWei     = daily;
        ap.totalBudgetWei    = totalBudget;
        ap.periodBudgetWei   = periodBudget;
        ap.periodDuration    = periodDuration;
        ap.expiry            = expiry;
        ap.allowedTokens     = tokens;
        ap.tokenMaxAmounts   = tokenAmounts;
        ap.tokenDailyLimits  = new uint128[](tokens.length);
        ap.tokenTotalBudgets = new uint128[](tokens.length);
        ap.allowedProtocols  = protocols;
        ap.allowedRecipients = recipients;
    }

    function _authorize(
        address agent, uint128 maxPerTx, uint128 daily, uint128 totalBudget,
        uint128 periodBudget, uint64 periodDuration,
        address[] memory tokens, uint128[] memory tokenAmounts,
        address[] memory protocols, uint64 expiry
    ) internal {
        address[] memory recipients = new address[](0);
        _authorize(agent, maxPerTx, daily, totalBudget, periodBudget, periodDuration, tokens, tokenAmounts, protocols, recipients, expiry);
    }

    function _authorizeEthOnly(address agent, uint128 maxPerTx, uint128 daily, uint128 totalBudget) internal {
        address[] memory tokens     = new address[](0);
        uint128[] memory amounts    = new uint128[](0);
        address[] memory protocols  = new address[](0);
        address[] memory recipients = new address[](0);
        _authorize(agent, maxPerTx, daily, totalBudget, 0, 0, tokens, amounts, protocols, recipients, 0);
    }

    function _authorizeWithPeriod(
        address agent, uint128 totalBudget, uint128 periodBudget, uint64 periodDuration
    ) internal {
        address[] memory tokens     = new address[](0);
        uint128[] memory amounts    = new uint128[](0);
        address[] memory protocols  = new address[](0);
        address[] memory recipients = new address[](0);
        _authorize(agent, 0, 0, totalBudget, periodBudget, periodDuration, tokens, amounts, protocols, recipients, 0);
    }

    function _agentExec(address agent, address target, uint256 value, bytes memory data) internal {
        vm.prank(agent);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(target, value, data));
    }

    // =========================================================================
    // Category H — Reentrancy & smart-contract agent prevention
    // =========================================================================

    function test_Reentrant_Reverts() public {
        MockReentrantAdv attacker = new MockReentrantAdv();

        address recipient = makeAddr("recipient");
        bytes memory innerExec = _batch(recipient, 0, "");
        attacker.setup(agentWallet, BATCH_MODE, innerExec);

        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(agent1);
        vm.expectRevert();
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(attacker), 0.1 ether, ""));
    }

    function test_Security_SmartContractAgentRejected() public {
        // Smart contract cannot be authorized as agent — prevents callback re-entry bypass
        MockReentrantAdv sc = new MockReentrantAdv();

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV3.AgentMustBeEOA.selector);
        agentWallet.authorizeAgent(_ap(
            address(sc), 0, 0, 0, 0, 0,
            new address[](0), new uint128[](0), new address[](0), new address[](0), 0
        ));
    }

    function test_Security_ExecuteDirectBypassBlocked() public {
        // EOA agent cannot call execute() directly — only EntryPoint is authorized
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0.1 ether);

        _agentExec(agent1, recipient, 0.1 ether, "");

        vm.prank(agent1);
        vm.expectRevert();
        agentWallet.execute(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    // =========================================================================
    // Category I — Fee preservation
    // =========================================================================

    function test_Fee_ETHSend_Collected() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0);

        uint256 amount      = 1 ether;
        uint256 expectedFee = (amount * FEE_NUM) / FEE_DEN;
        uint256 feeBefore   = BVCC_FEE_WALLET.balance;

        _agentExec(agent1, recipient, amount, "");

        assertEq(BVCC_FEE_WALLET.balance - feeBefore, expectedFee,          "fee wallet received exact fee");
        assertEq(recipient.balance,                    amount - expectedFee, "recipient got amount minus fee");
    }

    function test_Fee_ERC20_Collected() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1000 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;

        token.mint(address(agentWallet), amount + fee);

        address[] memory tokens   = new address[](1);
        uint128[] memory amounts  = new uint128[](1);
        tokens[0]  = address(token);
        amounts[0] = 0;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), 0);

        uint256 feeBalBefore = token.balanceOf(BVCC_FEE_WALLET);
        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
        _agentExec(agent1, address(token), 0, cd);

        assertEq(token.balanceOf(recipient),                        amount, "recipient gets exact amount");
        assertEq(token.balanceOf(BVCC_FEE_WALLET) - feeBalBefore, fee,    "fee wallet receives 0.15%");
    }

    function test_Fee_AgentWallet_Is015Pct() public {
        // Verify the agent wallet charges 0.15% (1500/1_000_000), not 0.05%
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0);

        uint256 amount = 1 ether;
        uint256 feeBefore = BVCC_FEE_WALLET.balance;
        _agentExec(agent1, recipient, amount, "");

        uint256 feeCharged = BVCC_FEE_WALLET.balance - feeBefore;
        assertEq(feeCharged, (amount * 1500) / 1_000_000, "fee should be 0.15%");
    }

    // =========================================================================
    // Category J — Period budget
    // =========================================================================

    function test_Period_BlocksWhenExceeded() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 0, 0.5 ether, uint64(7 days));

        _agentExec(agent1, recipient, 0.4 ether, "");

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.PeriodBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.2 ether, ""));
    }

    function test_Period_RollsOverAfterDuration() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 0, 0.5 ether, uint64(7 days));

        _agentExec(agent1, recipient, 0.5 ether, "");

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.PeriodBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));

        vm.warp(block.timestamp + 7 days + 1);
        _agentExec(agent1, recipient, 0.5 ether, "");

        assertEq(agentWallet.getAgentPermission(agent1).periodSpentWei, 0.5 ether, "new period spend");
    }

    function test_Period_ZeroBudgetIsDisabled() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 0, 0, uint64(7 days));

        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");
        assertGt(recipient.balance, 0, "no period limit when budget is 0");
    }

    function test_Period_ZeroDurationIsDisabled() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 0, 0.5 ether, 0);

        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");
        assertGt(recipient.balance, 0, "no period limit when duration is 0");
    }

    function test_Period_IndependentOfTotalBudget() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 10 ether, 0.5 ether, uint64(7 days));

        _agentExec(agent1, recipient, 0.5 ether, "");

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.PeriodBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    function test_Period_PreservedOnReAuth() public {
        address recipient = makeAddr("recipient");
        _authorizeWithPeriod(agent1, 0, 1 ether, uint64(7 days));

        _agentExec(agent1, recipient, 0.6 ether, "");
        assertEq(agentWallet.getAgentPermission(agent1).periodSpentWei, 0.6 ether, "before re-auth");

        _authorizeWithPeriod(agent1, 0, 1 ether, uint64(7 days));
        assertEq(agentWallet.getAgentPermission(agent1).periodSpentWei, 0.6 ether, "preserved after re-auth");

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.PeriodBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.5 ether, ""));
    }

    function test_Period_StartSetOnFirstRollover() public {
        address recipient = makeAddr("recipient");
        vm.warp(uint256(7 days) + 1);

        _authorizeWithPeriod(agent1, 0, 1 ether, uint64(7 days));
        assertEq(agentWallet.getAgentPermission(agent1).periodStart, 0, "periodStart is 0 before first exec");

        uint256 execTime = block.timestamp;
        _agentExec(agent1, recipient, 0.1 ether, "");

        assertEq(agentWallet.getAgentPermission(agent1).periodStart, uint64(execTime), "periodStart set on rollover");
    }

    // =========================================================================
    // Category K — Allowed recipients whitelist
    // =========================================================================

    function test_Recipient_EmptyAllowsAny() public {
        address recipient = makeAddr("anyone");
        _authorizeEthOnly(agent1, 0, 0, 0);

        _agentExec(agent1, recipient, 0.1 ether, "");
        assertGt(recipient.balance, 0, "any recipient allowed when whitelist is empty");
    }

    function test_Recipient_InWhitelist() public {
        address recipient = makeAddr("recipient");

        address[] memory recipients = new address[](1);
        recipients[0] = recipient;
        _authorize(agent1, 0, 0, 0, 0, 0, new address[](0), new uint128[](0), new address[](0), recipients, 0);

        _agentExec(agent1, recipient, 0.1 ether, "");
        assertGt(recipient.balance, 0, "whitelisted recipient allowed");
    }

    function test_Recipient_NotInWhitelist() public {
        address allowed   = makeAddr("allowed");
        address forbidden = makeAddr("forbidden");

        address[] memory recipients = new address[](1);
        recipients[0] = allowed;
        _authorize(agent1, 0, 0, 0, 0, 0, new address[](0), new uint128[](0), new address[](0), recipients, 0);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.RecipientNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(forbidden, 0.1 ether, ""));
    }

    function test_Recipient_MultipleWhitelisted() public {
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        address r3 = makeAddr("r3");

        address[] memory recipients = new address[](2);
        recipients[0] = r1;
        recipients[1] = r2;
        _authorize(agent1, 0, 0, 0, 0, 0, new address[](0), new uint128[](0), new address[](0), recipients, 0);

        _agentExec(agent1, r1, 0.1 ether, "");
        _agentExec(agent1, r2, 0.1 ether, "");

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.RecipientNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(r3, 0.1 ether, ""));
    }

    // The destination whitelist is unified: it gates ERC-20 transfer() recipients too.
    function test_Recipient_TokenTransferToWhitelisted() public {
        address recipient = makeAddr("recipient");

        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = address(token);
        amounts[0]    = 0;
        recipients[0] = recipient;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        uint256 amount = 100 ether;
        uint256 fee    = (amount * FEE_NUM) / FEE_DEN;
        token.mint(address(agentWallet), amount + fee);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
        _agentExec(agent1, address(token), 0, cd);
        assertEq(token.balanceOf(recipient), amount, "token transfer to whitelisted recipient allowed");
    }

    function test_Recipient_TokenTransferToNonWhitelistedBlocked() public {
        address allowed   = makeAddr("allowed");
        address forbidden = makeAddr("forbidden");

        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = address(token);
        amounts[0]    = 0;
        recipients[0] = allowed;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        token.mint(address(agentWallet), 1000 ether);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", forbidden, 100 ether);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.RecipientNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    // approve(spender, amount): spender gated by the same whitelist, token gated by allowedTokens.
    function test_Approve_ToWhitelistedSpender() public {
        address spender = makeAddr("spender");

        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = address(token);
        amounts[0]    = 0;
        recipients[0] = spender;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        bytes memory cd = abi.encodeWithSignature("approve(address,uint256)", spender, 500 ether);
        _agentExec(agent1, address(token), 0, cd);
        assertEq(token.allowance(address(agentWallet), spender), 500 ether, "approve to whitelisted spender allowed");
    }

    function test_Approve_ToNonWhitelistedSpenderBlocked() public {
        address allowed   = makeAddr("allowed");
        address forbidden = makeAddr("forbidden");

        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = address(token);
        amounts[0]    = 0;
        recipients[0] = allowed;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        bytes memory cd = abi.encodeWithSignature("approve(address,uint256)", forbidden, 500 ether);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.RecipientNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Approve_NonWhitelistedTokenBlocked() public {
        address spender = makeAddr("spender");

        // Only a different token is whitelisted; approving `token` must fail.
        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = makeAddr("otherToken");
        amounts[0]    = 0;
        recipients[0] = spender;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        bytes memory cd = abi.encodeWithSignature("approve(address,uint256)", spender, 500 ether);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Approve_RespectsTokenAmountCap() public {
        address spender = makeAddr("spender");

        address[] memory tokens     = new address[](1);
        uint128[] memory amounts    = new uint128[](1);
        address[] memory recipients = new address[](1);
        tokens[0]     = address(token);
        amounts[0]    = 100 ether; // per-tx cap
        recipients[0] = spender;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), recipients, 0);

        bytes memory cd = abi.encodeWithSignature("approve(address,uint256)", spender, 101 ether);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.ExceedsTokenMaxAmount.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Recipient_TooMany() public {
        address[] memory recipients = new address[](21);
        for (uint256 i = 0; i < 21; i++) recipients[i] = address(uint160(i + 200));

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV3.TooManyRecipients.selector);
        agentWallet.authorizeAgent(_ap(
            agent1, 0, 0, 0, 0, 0,
            new address[](0), new uint128[](0), new address[](0), recipients, 0
        ));
    }

    function test_Token_BatchBypassBlocked() public {
        // Agent tries to bypass tokenMaxAmounts by batching multiple transfers
        // Each individual transfer is within limit, but total exceeds it
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        uint256 limit = 600 ether; // 600 token units
        uint256 fee   = (limit * 2 * FEE_NUM) / FEE_DEN;
        token.mint(address(agentWallet), limit * 2 + fee);

        address[] memory tokens  = new address[](1);
        uint128[] memory amounts = new uint128[](1);
        tokens[0]  = address(token);
        amounts[0] = uint128(limit);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), 0);

        // Two transfers of 500 each — each passes per-item check (500 ≤ 600)
        // but cumulative 1000 > 600 → must revert
        bytes memory cd1 = abi.encodeWithSignature("transfer(address,uint256)", r1, 500 ether);
        bytes memory cd2 = abi.encodeWithSignature("transfer(address,uint256)", r2, 500 ether);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: address(token), value: 0, callData: cd1});
        b[1] = Execution({target: address(token), value: 0, callData: cd2});
        bytes memory batchData = abi.encode(b);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenBatchLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, batchData);
    }

    function test_Token_BatchWithinLimitPasses() public {
        // Two transfers that together are within the limit should succeed
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        uint256 limit = 1000 ether;
        uint256 total = 900 ether; // 450 + 450
        uint256 fee   = (total * FEE_NUM) / FEE_DEN;
        token.mint(address(agentWallet), total + fee);

        address[] memory tokens  = new address[](1);
        uint128[] memory amounts = new uint128[](1);
        tokens[0]  = address(token);
        amounts[0] = uint128(limit);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, new address[](0), 0);

        bytes memory cd1 = abi.encodeWithSignature("transfer(address,uint256)", r1, 450 ether);
        bytes memory cd2 = abi.encodeWithSignature("transfer(address,uint256)", r2, 450 ether);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: address(token), value: 0, callData: cd1});
        b[1] = Execution({target: address(token), value: 0, callData: cd2});

        vm.prank(agent1);
        agentWallet.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(token.balanceOf(r1), 450 ether, "r1 received tokens");
        assertEq(token.balanceOf(r2), 450 ether, "r2 received tokens");
    }

    function test_Recipient_TooManyProtocols() public {
        address[] memory protocols = new address[](21);
        for (uint256 i = 0; i < 21; i++) protocols[i] = address(uint160(i + 300));

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV3.TooManyProtocols.selector);
        agentWallet.authorizeAgent(_ap(
            agent1, 0, 0, 0, 0, 0,
            new address[](0), new uint128[](0), protocols, new address[](0), 0
        ));
    }

    // =========================================================================
    // Category L — Global pause
    // =========================================================================

    function test_Pause_OnlyWalletCanPause() public {
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.OnlyWallet.selector);
        agentWallet.pauseAgents();
    }

    function test_Pause_OnlyWalletCanUnpause() public {
        vm.prank(address(agentWallet));
        agentWallet.pauseAgents();

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.OnlyWallet.selector);
        agentWallet.unpauseAgents();
    }

    function test_Pause_BlocksExecuteAsAgent() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(address(agentWallet));
        agentWallet.pauseAgents();

        assertTrue(agentWallet.paused(), "should be paused");

        vm.prank(agent1);
        vm.expectRevert();
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    function test_Pause_CanUnpause() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(address(agentWallet));
        agentWallet.pauseAgents();

        vm.prank(address(agentWallet));
        agentWallet.unpauseAgents();

        assertFalse(agentWallet.paused(), "should be unpaused");
        _agentExec(agent1, recipient, 0.1 ether, "");
        assertGt(recipient.balance, 0, "execution works after unpause");
    }

    function test_Pause_OwnerExecUnaffected() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;

        vm.prank(address(agentWallet));
        agentWallet.pauseAgents();

        vm.prank(ENTRY_POINT);
        agentWallet.execute{value: 0}(BATCH_MODE, _batch(recipient, amount, ""));

        assertEq(recipient.balance, amount - fee, "owner execute unaffected by pause");
    }

    function test_Pause_PauseViaSelfCallExecute() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0);

        bytes memory cd = abi.encodeWithSignature("pauseAgents()");
        vm.prank(ENTRY_POINT);
        agentWallet.execute{value: 0}(BATCH_MODE, _batch(address(agentWallet), 0, cd));

        assertTrue(agentWallet.paused(), "paused via owner execute");

        vm.prank(agent1);
        vm.expectRevert();
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    // =========================================================================
    // Wallet type identifier
    // =========================================================================

    function test_WalletType_IsAgent() public view {
        assertEq(agentWallet.walletType(), 1, "BVCCAgentWalletV3 should return type 1 (AGENT)");
    }

    // =========================================================================
    // Regression — approve must respect token daily/total budgets
    //
    // Vuln: approve was only per-tx capped; its amount was never accumulated into
    // the per-token daily/total spend, so an agent could approve(spender, amount)
    // and drain via an external transferFrom, bypassing tokenDailyLimits /
    // tokenTotalBudgets. Fix: count approve amounts like transfer in executeAsAgent.
    // The tests below FAIL on the pre-fix code and PASS after.
    // =========================================================================

    /// @dev Authorize `agent` for `token` only, with explicit per-token caps and no ETH caps.
    function _authorizeTokenCaps(
        address agent, uint128 perTxToken, uint128 dailyToken, uint128 totalToken
    ) internal {
        address[] memory tokens  = new address[](1); tokens[0]  = address(token);
        uint128[] memory maxAmts = new uint128[](1); maxAmts[0] = perTxToken;
        uint128[] memory dailyLs = new uint128[](1); dailyLs[0] = dailyToken;
        uint128[] memory totalBs = new uint128[](1); totalBs[0] = totalToken;

        BVCCAgentWalletV3.AuthorizeParams memory ap;
        ap.agent             = agent;
        ap.allowedTokens     = tokens;
        ap.tokenMaxAmounts   = maxAmts;
        ap.tokenDailyLimits  = dailyLs;
        ap.tokenTotalBudgets = totalBs;
        ap.allowedProtocols  = new address[](0);
        ap.allowedRecipients = new address[](0);

        vm.prank(address(agentWallet));
        agentWallet.authorizeAgent(ap);
    }

    function _approveCd(address spender, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("approve(address,uint256)", spender, amount);
    }

    function _transferCd(address to, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("transfer(address,uint256)", to, amount);
    }

    function test_Approve_CountsTowardTokenDailyLimit() public {
        _authorizeTokenCaps(agent1, 100, 100, 0); // perTx 100, daily 100, total unlimited
        _agentExec(agent1, address(token), 0, _approveCd(agent1, 100)); // daily -> 100/100

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenDailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _approveCd(agent1, 1)));
    }

    function test_Approve_CountsTowardTokenTotalBudget() public {
        _authorizeTokenCaps(agent1, 100, 0, 100); // daily unlimited, total 100
        _agentExec(agent1, address(token), 0, _approveCd(agent1, 100)); // total -> 100/100

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenTotalBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _approveCd(agent1, 1)));
    }

    function test_Approve_UpdatesSpentCounters() public {
        _authorizeTokenCaps(agent1, 100, 1000, 1000);
        _agentExec(agent1, address(token), 0, _approveCd(agent1, 30));

        (uint128 daily, uint128 total) = agentWallet.getTokenSpent(agent1, address(token));
        assertEq(daily, 30, "approve should increment daily token spent");
        assertEq(total, 30, "approve should increment total token spent");
    }

    /// @dev Mirrors the PoC: exhaust the token daily budget with a transfer, then a
    ///      within-per-tx approve must revert (previously it slipped through).
    function test_ApproveBypassClosed_ExhaustViaTransfer_ThenApproveReverts() public {
        _authorizeTokenCaps(agent1, 200, 200, 0); // perTx 200, daily 200
        address recipient = makeAddr("recipient");
        token.mint(address(agentWallet), 200);    // fee is 0 at this size (200*1500/1e6 -> 0)

        _agentExec(agent1, address(token), 0, _transferCd(recipient, 200)); // daily -> 200/200

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenDailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _approveCd(agent1, 1)));
    }

    /// @dev Per-tx cap on approve is unchanged.
    function test_Approve_PerTxCapStillApplies() public {
        _authorizeTokenCaps(agent1, 100, 0, 0);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.ExceedsTokenMaxAmount.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _approveCd(agent1, 101)));
    }

    /// @dev A batch mixing transfer + approve of the same token sums both amounts
    ///      against the daily limit (per-tx cap left unlimited to isolate the daily check).
    function test_Batch_TransferPlusApprove_SameToken_Sums() public {
        _authorizeTokenCaps(agent1, 0, 150, 0); // per-tx unlimited, daily 150
        address recipient = makeAddr("recipient");
        token.mint(address(agentWallet), 100);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: address(token), value: 0, callData: _transferCd(recipient, 100)});
        b[1] = Execution({target: address(token), value: 0, callData: _approveCd(agent1, 100)});

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV3.TokenDailyLimitExceeded.selector); // 100 + 100 > 150
        agentWallet.executeAsAgent(BATCH_MODE, abi.encode(b));
    }
}
