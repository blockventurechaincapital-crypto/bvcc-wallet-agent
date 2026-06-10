// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV2} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock
// ---------------------------------------------------------------------------
contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Mock swap target — when called, mints tokenOut to msg.sender (the wallet)
// ---------------------------------------------------------------------------
contract MockSwapTarget {
    function swap(address tokenOut, uint256 amountOut) external {
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }
}

// ---------------------------------------------------------------------------
// Mock reentrancy attacker
// ---------------------------------------------------------------------------
contract MockReentrant {
    BVCCAgentWalletV2 public target;
    bytes32 public mode;
    bytes public execData;

    function setup(BVCCAgentWalletV2 _target, bytes32 _mode, bytes calldata _execData) external {
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
// Test contract
// ---------------------------------------------------------------------------
contract BVCCAgentWalletV2Test is Test {
    using ERC7579Utils for *;

    address constant ENTRY_POINT   = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;
    bytes32 constant BATCH_MODE    = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX       = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY       = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);
    uint256 constant FEE_NUM       = 1500;
    uint256 constant FEE_DEN       = 1_000_000;
    address constant BVCC_FEE_WALLET = 0x3e3eb089169a7315a994947465ce5f5FC3A307D4;

    BVCCAgentWalletV2 agentWallet;
    MockERC20       token;
    MockSwapTarget  swapTarget;
    address         agent1;
    address         agent2;

    function setUp() public {
        agentWallet = new BVCCAgentWalletV2(P256_GX, P256_GY);
        token       = new MockERC20();
        swapTarget  = new MockSwapTarget();
        agentWallet.setGuardians([address(10), address(11), address(12)]);
        vm.deal(address(agentWallet), 100 ether);
        agent1 = makeAddr("agent1");
        agent2 = makeAddr("agent2");
        vm.deal(agent1, 1 ether);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _batch(address target, uint256 value, bytes memory data)
        internal pure returns (bytes memory)
    {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: value, callData: data});
        return abi.encode(b);
    }

    function _batch2(
        address t1, uint256 v1, bytes memory d1,
        address t2, uint256 v2, bytes memory d2
    ) internal pure returns (bytes memory) {
        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: t1, value: v1, callData: d1});
        b[1] = Execution({target: t2, value: v2, callData: d2});
        return abi.encode(b);
    }

    function _ownerExecute(address target, uint256 value, bytes memory data) internal {
        vm.prank(ENTRY_POINT);
        agentWallet.execute{value: 0}(BATCH_MODE, _batch(target, value, data));
    }

    function _authorize(
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
    ) internal pure returns (BVCCAgentWalletV2.AuthorizeParams memory ap) {
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

    /// Convenience: ETH-only agent, no period limits, no recipient whitelist.
    function _authorizeEthOnly(
        address agent,
        uint128 maxPerTx,
        uint128 daily,
        uint128 totalBudget
    ) internal {
        address[] memory tokens      = new address[](0);
        uint128[] memory amounts     = new uint128[](0);
        address[] memory protocols   = new address[](0);
        address[] memory recipients  = new address[](0);
        _authorize(agent, maxPerTx, daily, totalBudget, 0, 0, tokens, amounts, protocols, recipients, 0);
    }

    /// Convenience: ETH-only agent with period budget.
    function _authorizeWithPeriod(
        address agent,
        uint128 totalBudget,
        uint128 periodBudget,
        uint64  periodDuration
    ) internal {
        address[] memory tokens      = new address[](0);
        uint128[] memory amounts     = new uint128[](0);
        address[] memory protocols   = new address[](0);
        address[] memory recipients  = new address[](0);
        _authorize(agent, 0, 0, totalBudget, periodBudget, periodDuration, tokens, amounts, protocols, recipients, 0);
    }

    /// Convenience overload: _authorize without explicit recipients (passes empty array).
    function _authorize(
        address agent, uint128 maxPerTx, uint128 daily, uint128 totalBudget,
        uint128 periodBudget, uint64 periodDuration,
        address[] memory tokens, uint128[] memory tokenAmounts,
        address[] memory protocols, uint64 expiry
    ) internal {
        address[] memory recipients = new address[](0);
        _authorize(agent, maxPerTx, daily, totalBudget, periodBudget, periodDuration, tokens, tokenAmounts, protocols, recipients, expiry);
    }

    function _agentExec(address agent, address target, uint256 value, bytes memory data) internal {
        vm.prank(agent);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(target, value, data));
    }

    // =========================================================================
    // Category A — Authorization management
    // =========================================================================

    function test_Auth_OnlyWalletCanAuthorize() public {
        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](0);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.OnlyWallet.selector);
        agentWallet.authorizeAgent(_ap(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, new address[](0), 0));
    }

    function test_Auth_StoresAllFields() public {
        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](1);
        address[] memory protocols = new address[](1);
        tokens[0]    = address(token);
        amounts[0]   = 500;
        protocols[0] = address(swapTarget);

        vm.prank(address(agentWallet));
        agentWallet.authorizeAgent(_ap(
            agent1,
            1 ether,       // maxPerTx
            5 ether,       // daily
            10 ether,      // totalBudget
            2 ether,       // periodBudget
            7 days,        // periodDuration
            tokens,
            amounts,
            protocols,
            new address[](0), // allowedRecipients (empty = any)
            uint64(block.timestamp + 1 days)
        ));

        BVCCAgentWalletV2.AgentPermission memory perm = agentWallet.getAgentPermission(agent1);
        assertEq(perm.maxPerTxWei,    1 ether,                         "maxPerTxWei");
        assertEq(perm.dailyLimitWei,  5 ether,                         "dailyLimitWei");
        assertEq(perm.totalBudgetWei, 10 ether,                        "totalBudgetWei");
        assertEq(perm.totalSpentWei,  0,                                "totalSpentWei should be 0 for new agent");
        assertEq(perm.periodBudgetWei, 2 ether,                        "periodBudgetWei");
        assertEq(perm.periodSpentWei,  0,                               "periodSpentWei should be 0 for new agent");
        assertEq(perm.periodDuration,  uint64(7 days),                  "periodDuration");
        assertEq(perm.periodStart,     0,                               "periodStart should be 0 for new agent");
        assertEq(perm.expiry,          uint64(block.timestamp + 1 days),"expiry");
        assertTrue(perm.active,                                          "active");
        assertEq(perm.allowedTokens[0],    address(token),              "allowedToken");
        assertEq(perm.tokenMaxAmounts[0],  500,                         "tokenMaxAmount");
        assertEq(perm.allowedProtocols[0], address(swapTarget),         "allowedProtocol");
    }

    function test_Auth_ArrayLengthMismatch() public {
        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](2);
        address[] memory protocols = new address[](0);
        tokens[0]  = address(token);
        amounts[0] = 0;
        amounts[1] = 0;

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV2.ArrayLengthMismatch.selector);
        agentWallet.authorizeAgent(_ap(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, new address[](0), 0));
    }

    function test_Auth_TooManyTokens() public {
        address[] memory tokens  = new address[](21);
        uint128[] memory amounts = new uint128[](21);
        address[] memory protocols = new address[](0);
        for (uint256 i = 0; i < 21; i++) {
            tokens[i]  = address(uint160(i + 100));
            amounts[i] = 0;
        }

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV2.TooManyTokens.selector);
        agentWallet.authorizeAgent(_ap(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, new address[](0), 0));
    }

    function test_Auth_GetAgentsList() public {
        _authorizeEthOnly(agent1, 0, 0, 0);
        _authorizeEthOnly(agent2, 0, 0, 0);

        address[] memory agents = agentWallet.getAgents();
        assertEq(agents.length, 2, "Should have 2 agents");

        bool hasAgent1;
        bool hasAgent2;
        for (uint256 i = 0; i < agents.length; i++) {
            if (agents[i] == agent1) hasAgent1 = true;
            if (agents[i] == agent2) hasAgent2 = true;
        }
        assertTrue(hasAgent1, "agent1 in list");
        assertTrue(hasAgent2, "agent2 in list");
    }

    function test_Auth_NoDuplicateInList() public {
        _authorizeEthOnly(agent1, 0, 0, 0);
        _authorizeEthOnly(agent1, 0, 0, 0); // re-authorize same agent

        address[] memory agents = agentWallet.getAgents();
        assertEq(agents.length, 1, "Should not duplicate agent in list");
    }

    function test_Revoke_OnlyWalletCanRevoke() public {
        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.OnlyWallet.selector);
        agentWallet.revokeAgent(agent1);
    }

    function test_Revoke_SetsActiveFalse() public {
        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(address(agentWallet));
        agentWallet.revokeAgent(agent1);

        BVCCAgentWalletV2.AgentPermission memory perm = agentWallet.getAgentPermission(agent1);
        assertFalse(perm.active, "active should be false after revoke");
    }

    function test_Revoke_BlocksExecution() public {
        _authorizeEthOnly(agent1, 0, 0, 0);

        vm.prank(address(agentWallet));
        agentWallet.revokeAgent(agent1);

        address recipient = makeAddr("recipient");
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.NotAuthorizedAgent.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    function test_ReAuth_PreservesTotalSpent() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 2 ether);

        // Spend 0.5 ether
        _agentExec(agent1, recipient, 0.5 ether, "");
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 0.5 ether, "spent 0.5");

        // Re-authorize same agent — spending history must be preserved
        _authorizeEthOnly(agent1, 0, 0, 2 ether);

        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 0.5 ether, "totalSpentWei preserved after re-auth");
    }

    function test_IncreaseBudget_OnlyWallet() public {
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.OnlyWallet.selector);
        agentWallet.increaseBudget(agent1, 1 ether);
    }

    function test_IncreaseBudget_ZeroReverts() public {
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV2.ZeroAmount.selector);
        agentWallet.increaseBudget(agent1, 0);
    }

    function test_IncreaseBudget_Works() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        // Spend 0.9 ether — only 0.1 ether left
        _agentExec(agent1, recipient, 0.9 ether, "");

        // 0.2 ether would exceed budget
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.2 ether, ""));

        // Increase budget by 1 ether
        vm.prank(address(agentWallet));
        agentWallet.increaseBudget(agent1, 1 ether);

        // Now 0.2 ether should succeed
        _agentExec(agent1, recipient, 0.2 ether, "");
    }

    function test_IncreaseBudget_InactiveReverts() public {
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        vm.prank(address(agentWallet));
        agentWallet.revokeAgent(agent1);

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV2.AgentNotActive.selector);
        agentWallet.increaseBudget(agent1, 1 ether);
    }

    // =========================================================================
    // Category B — Happy paths
    // =========================================================================

    function test_ETHSend_WithinLimits() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 1 ether, 5 ether, 10 ether);

        uint256 amount = 0.5 ether;
        uint256 fee    = (amount * FEE_NUM) / FEE_DEN;

        uint256 feeBefore = BVCC_FEE_WALLET.balance;

        _agentExec(agent1, recipient, amount, "");

        assertEq(recipient.balance,                    amount - fee, "recipient balance");
        assertEq(BVCC_FEE_WALLET.balance - feeBefore, fee,          "fee wallet received fee");
        assertEq(agentWallet.getDailySpent(agent1),    amount,       "daily spent");
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, amount, "total spent");
    }

    function test_ERC20Transfer_WhitelistedToken() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1000 ether;
        uint256 fee    = (amount * FEE_NUM) / FEE_DEN;

        token.mint(address(agentWallet), amount + fee);

        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](1);
        address[] memory protocols = new address[](0);
        tokens[0]  = address(token);
        amounts[0] = 0; // no per-token max

        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
        _agentExec(agent1, address(token), 0, cd);

        assertEq(token.balanceOf(recipient),        amount, "recipient gets exact amount");
        assertEq(token.balanceOf(BVCC_FEE_WALLET), fee,    "fee wallet receives fee");
    }

    function test_DeFiCall_WhitelistedProtocol() public {
        uint256 swapOut = 1000 ether;
        uint256 fee     = (swapOut * FEE_NUM) / FEE_DEN;

        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](1);
        protocols[0] = address(swapTarget);

        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature(
            "swap(address,uint256)", address(token), swapOut
        );
        _agentExec(agent1, address(swapTarget), 0, cd);

        assertEq(token.balanceOf(address(agentWallet)), swapOut - fee, "wallet holds swapOut minus fee");
        assertEq(token.balanceOf(BVCC_FEE_WALLET),     fee,           "fee wallet receives fee");
    }

    function test_MultiBatch_TwoETHSends() public {
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        _authorizeEthOnly(agent1, 2 ether, 10 ether, 0);

        bytes memory execData = _batch2(r1, 1 ether, "", r2, 1.5 ether, "");
        vm.prank(agent1);
        agentWallet.executeAsAgent(BATCH_MODE, execData);

        uint256 fee1 = (1 ether   * FEE_NUM) / FEE_DEN;
        uint256 fee2 = (1.5 ether * FEE_NUM) / FEE_DEN;

        assertEq(r1.balance, 1 ether - fee1,   "r1 balance");
        assertEq(r2.balance, 1.5 ether - fee2, "r2 balance");
        assertEq(agentWallet.getDailySpent(agent1), 2.5 ether, "total daily spent");
    }

    // =========================================================================
    // Category C — Per-item enforcement
    // =========================================================================

    function test_PerTx_Reverts_WhenExceeded() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0.5 ether, 0, 0);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.ExceedsPerTxLimit.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 1 ether, ""));
    }

    function test_PerTx_ZeroIsUnlimited() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0); // maxPerTx = 0 = unlimited

        _agentExec(agent1, recipient, 50 ether, "");
        assertGt(recipient.balance, 0, "recipient received ETH");
    }

    function test_Token_NotWhitelisted() public {
        address recipient = makeAddr("recipient");
        // Authorize with empty allowedTokens
        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](0);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, 100);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.NoTokensWhitelisted.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Token_NotInWhitelist() public {
        address recipient  = makeAddr("recipient");
        MockERC20 token2   = new MockERC20();

        // Whitelist token2 only
        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](1);
        address[] memory protocols = new address[](0);
        tokens[0]  = address(token2);
        amounts[0] = 0;
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        // Try to transfer token (not token2)
        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, 100);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.TokenNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Token_AmountExceedsLimit() public {
        address recipient = makeAddr("recipient");
        uint256 limit     = 100 ether;
        token.mint(address(agentWallet), 300 ether);

        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](1);
        address[] memory protocols = new address[](0);
        tokens[0]  = address(token);
        amounts[0] = uint128(limit);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, 200 ether);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.ExceedsTokenMaxAmount.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, cd));
    }

    function test_Token_AmountZeroIsUnlimited() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 500 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;
        token.mint(address(agentWallet), amount + fee);

        address[] memory tokens    = new address[](1);
        uint128[] memory amounts   = new uint128[](1);
        address[] memory protocols = new address[](0);
        tokens[0]  = address(token);
        amounts[0] = 0; // 0 = unlimited
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
        _agentExec(agent1, address(token), 0, cd);

        assertEq(token.balanceOf(recipient), amount, "recipient got full amount");
    }

    // =========================================================================
    // Category — Per-token daily & total budget limits
    // =========================================================================

    /// @dev Authorize an agent with a single whitelisted token and its per-token caps.
    function _authorizeOneToken(
        address agent, address tk,
        uint128 maxPerTx, uint128 daily, uint128 total
    ) internal {
        address[] memory tokens = new address[](1);
        uint128[] memory mx = new uint128[](1);
        uint128[] memory dl = new uint128[](1);
        uint128[] memory tb = new uint128[](1);
        tokens[0] = tk; mx[0] = maxPerTx; dl[0] = daily; tb[0] = total;

        BVCCAgentWalletV2.AuthorizeParams memory ap;
        ap.agent             = agent;
        ap.allowedTokens     = tokens;
        ap.tokenMaxAmounts   = mx;
        ap.tokenDailyLimits  = dl;
        ap.tokenTotalBudgets = tb;
        ap.allowedProtocols  = new address[](0);
        ap.allowedRecipients = new address[](0);

        vm.prank(address(agentWallet));
        agentWallet.authorizeAgent(ap);
    }

    function _transfer(address to, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("transfer(address,uint256)", to, amount);
    }

    function test_TokenDaily_RevertsWhenExceeded() public {
        address rcpt = makeAddr("rcpt");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 100 ether, 0); // daily 100

        _agentExec(agent1, address(token), 0, _transfer(rcpt, 60 ether)); // ok
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.TokenDailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _transfer(rcpt, 50 ether)));
    }

    function test_TokenDaily_ResetsNextDay() public {
        address rcpt = makeAddr("rcpt");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 100 ether, 0);

        _agentExec(agent1, address(token), 0, _transfer(rcpt, 100 ether));
        vm.warp(block.timestamp + 1 days);
        _agentExec(agent1, address(token), 0, _transfer(rcpt, 100 ether)); // new UTC day → ok
        assertEq(token.balanceOf(rcpt), 200 ether, "two days of transfers succeeded");
    }

    function test_TokenTotal_RevertsWhenExceeded() public {
        address rcpt = makeAddr("rcpt");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 0, 100 ether); // total 100

        _agentExec(agent1, address(token), 0, _transfer(rcpt, 60 ether));
        vm.warp(block.timestamp + 2 days); // lifetime cap persists across days
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.TokenTotalBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _transfer(rcpt, 50 ether)));
    }

    function test_TokenTotal_PreservedOnReauth() public {
        address rcpt = makeAddr("rcpt");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 0, 100 ether);

        _agentExec(agent1, address(token), 0, _transfer(rcpt, 60 ether));
        // Re-authorize the same agent+token; per-token spent (60) must be preserved.
        _authorizeOneToken(agent1, address(token), 0, 0, 100 ether);
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.TokenTotalBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(token), 0, _transfer(rcpt, 50 ether)));
    }

    function test_TokenDaily_BatchCumulative() public {
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 100 ether, 0);

        // 60 + 50 = 110 > 100 daily → reverts (anti batch-bypass)
        bytes memory execData = _batch2(
            address(token), 0, _transfer(r1, 60 ether),
            address(token), 0, _transfer(r2, 50 ether)
        );
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.TokenDailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, execData);
    }

    function test_TokenSpent_Getter() public {
        address rcpt = makeAddr("rcpt");
        token.mint(address(agentWallet), 1000 ether);
        _authorizeOneToken(agent1, address(token), 0, 100 ether, 500 ether);

        _agentExec(agent1, address(token), 0, _transfer(rcpt, 40 ether));
        (uint128 daily, uint128 total) = agentWallet.getTokenSpent(agent1, address(token));
        assertEq(daily, 40 ether, "daily spent");
        assertEq(total, 40 ether, "total spent");
    }

    function test_TokenLimits_ArrayLengthMismatch() public {
        BVCCAgentWalletV2.AuthorizeParams memory ap;
        ap.agent = agent1;
        ap.allowedTokens = new address[](1);
        ap.allowedTokens[0] = address(token);
        ap.tokenMaxAmounts = new uint128[](1);
        ap.tokenDailyLimits = new uint128[](0); // mismatch vs allowedTokens
        ap.tokenTotalBudgets = new uint128[](1);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = new address[](0);

        vm.prank(address(agentWallet));
        vm.expectRevert(BVCCAgentWalletV2.ArrayLengthMismatch.selector);
        agentWallet.authorizeAgent(ap);
    }

    function test_Protocol_NotWhitelisted() public {
        // Authorize with empty allowedProtocols
        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](0);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature(
            "swap(address,uint256)", address(token), uint256(100)
        );

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.NoProtocolsWhitelisted.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(swapTarget), 0, cd));
    }

    function test_Protocol_NotInWhitelist() public {
        MockSwapTarget otherSwap = new MockSwapTarget();

        // Whitelist otherSwap only, try swapTarget
        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](1);
        protocols[0] = address(otherSwap);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, 0);

        bytes memory cd = abi.encodeWithSignature(
            "swap(address,uint256)", address(token), uint256(100)
        );

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.ProtocolNotAllowed.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(swapTarget), 0, cd));
    }

    function test_SelfCall_Reverts() public {
        _authorizeEthOnly(agent1, 0, 0, 0);

        // Try to call address(agentWallet) as the exec target
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentCannotCallWallet.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(address(agentWallet), 0, ""));
    }

    function test_UnauthorizedAgent_Reverts() public {
        // agent2 was never authorized
        address recipient = makeAddr("recipient");
        vm.prank(agent2);
        vm.expectRevert(BVCCAgentWalletV2.NotAuthorizedAgent.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    // =========================================================================
    // Category D — Daily limit
    // =========================================================================

    function test_Daily_Blocks_WhenExceeded() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 1 ether, 0);

        // First send: 0.7 ether — within limit
        _agentExec(agent1, recipient, 0.7 ether, "");

        // Second send: 0.4 ether — would push daily to 1.1 ether → reverts
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.DailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.4 ether, ""));
    }

    function test_Daily_ZeroIsUnlimited() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0); // dailyLimit = 0 = unlimited

        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");
        _agentExec(agent1, recipient, 10 ether, "");

        assertGt(recipient.balance, 0, "all sends succeeded");
    }

    function test_Daily_ResetsNextDay() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 1 ether, 0);

        // Day 1: spend 0.9 ether
        _agentExec(agent1, recipient, 0.9 ether, "");
        assertEq(agentWallet.getDailySpent(agent1), 0.9 ether, "day 1 spent");

        // Warp to next day
        vm.warp(block.timestamp + 86400);

        // Day 2: spend 0.9 ether again — should succeed
        _agentExec(agent1, recipient, 0.9 ether, "");
        assertEq(agentWallet.getDailySpent(agent1), 0.9 ether, "day 2 spent (reset)");
    }

    function test_Daily_BatchTotalAccumulates() public {
        address r1 = makeAddr("r1");
        address r2 = makeAddr("r2");
        _authorizeEthOnly(agent1, 0, 1 ether, 0);

        // Batch: 0.6 + 0.6 = 1.2 ether > 1 ether daily limit
        bytes memory execData = _batch2(r1, 0.6 ether, "", r2, 0.6 ether, "");
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.DailyLimitExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, execData);
    }

    // =========================================================================
    // Category E — Total budget
    // =========================================================================

    function test_Budget_TracksCumulative() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 2 ether);

        _agentExec(agent1, recipient, 0.5 ether, "");
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 0.5 ether, "spent after 1st");

        _agentExec(agent1, recipient, 0.7 ether, "");
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 1.2 ether, "spent after 2nd");
    }

    function test_Budget_BlocksAtLimit() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        // Spend 0.9 ether — succeeds
        _agentExec(agent1, recipient, 0.9 ether, "");

        // Try to spend 0.2 more — would exceed 1 ether budget
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.2 ether, ""));
    }

    function test_Budget_ZeroIsUnlimited() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0); // totalBudget = 0 = unlimited

        _agentExec(agent1, recipient, 5 ether, "");
        _agentExec(agent1, recipient, 5 ether, "");
        _agentExec(agent1, recipient, 5 ether, "");
        _agentExec(agent1, recipient, 5 ether, "");

        assertGt(recipient.balance, 0, "all sends succeeded");
    }

    function test_Budget_IncreasedAllowsMoreSpend() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0.5 ether);

        // Spend entire budget
        _agentExec(agent1, recipient, 0.5 ether, "");

        // Next send fails
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));

        // Increase budget by 1 ether
        vm.prank(address(agentWallet));
        agentWallet.increaseBudget(agent1, 1 ether);

        // Now 0.5 ether send succeeds
        _agentExec(agent1, recipient, 0.5 ether, "");
    }

    function test_Budget_ReAuth_PreservesSpent() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 1 ether);

        // Spend 0.8 ether
        _agentExec(agent1, recipient, 0.8 ether, "");
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 0.8 ether, "pre-reauth spent");

        // Re-authorize with same budget — spending history preserved
        _authorizeEthOnly(agent1, 0, 0, 1 ether);
        assertEq(agentWallet.getAgentPermission(agent1).totalSpentWei, 0.8 ether, "totalSpentWei preserved after re-auth");

        // Only 0.2 ether remaining in budget
        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentBudgetExceeded.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.5 ether, ""));

        // Must use increaseBudget to allow more spending
        vm.prank(address(agentWallet));
        agentWallet.increaseBudget(agent1, 1 ether);
        _agentExec(agent1, recipient, 0.5 ether, "");
    }

    // =========================================================================
    // Category F — Expiry
    // =========================================================================

    function test_Expiry_BlocksAfterExpiry() public {
        address recipient = makeAddr("recipient");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](0);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, expiry);

        vm.warp(block.timestamp + 2 hours);

        vm.prank(agent1);
        vm.expectRevert(BVCCAgentWalletV2.AgentPermissionsExpired.selector);
        agentWallet.executeAsAgent(BATCH_MODE, _batch(recipient, 0.1 ether, ""));
    }

    function test_Expiry_ZeroNeverExpires() public {
        address recipient = makeAddr("recipient");
        _authorizeEthOnly(agent1, 0, 0, 0); // expiry = 0

        vm.warp(block.timestamp + 365 days * 10);

        _agentExec(agent1, recipient, 0.1 ether, "");
        assertGt(recipient.balance, 0, "still works after 10 years");
    }

    function test_Expiry_WorksBeforeExpiry() public {
        address recipient = makeAddr("recipient");
        uint64 expiry = uint64(block.timestamp + 1 days);

        address[] memory tokens    = new address[](0);
        uint128[] memory amounts   = new uint128[](0);
        address[] memory protocols = new address[](0);
        _authorize(agent1, 0, 0, 0, 0, 0, tokens, amounts, protocols, expiry);

        // Execute immediately — still within expiry
        _agentExec(agent1, recipient, 0.1 ether, "");
        assertGt(recipient.balance, 0, "executed before expiry");
    }

    // =========================================================================
    // Category G — Owner unaffected
    // =========================================================================

    function test_Owner_EntryPointCanStillExecute() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;

        vm.prank(ENTRY_POINT);
        agentWallet.execute{value: 0}(BATCH_MODE, _batch(recipient, amount, ""));

        assertEq(recipient.balance, amount - fee, "owner execute still works");
    }

    function test_Owner_SelfCallStillWorks() public {
        // Owner (via EntryPoint) calls cancelRecovery on the wallet via execute
        // First set up a recovery so cancelRecovery doesn't revert "No recovery in progress"
        vm.prank(address(10)); // guardian[0]
        agentWallet.initiateRecovery(
            uint256(P256_GX),
            uint256(P256_GY)
        );

        // Owner cancels via execute → self-call to cancelRecovery
        bytes memory cd = abi.encodeWithSignature("cancelRecovery()");
        vm.prank(ENTRY_POINT);
        agentWallet.execute{value: 0}(BATCH_MODE, _batch(address(agentWallet), 0, cd));

        assertFalse(agentWallet.recoveryInProgress(), "recovery cancelled via owner self-call");
    }

    // =========================================================================
    // Wallet type identifier
    // =========================================================================

    function test_WalletType_IsAgent_Basic() public view {
        assertEq(agentWallet.walletType(), 1, "BVCCAgentWalletV2 should return type 1 (AGENT)");
    }
}
