// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV3} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 rateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256);
}

interface IPoolDataProvider {
    function getReserveTokensAddresses(address asset)
        external view returns (address aToken, address stableDebt, address variableDebt);
}

interface IERC20M {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/**
 * @notice C1-Core fork test: BVCCAgentWalletV3 call policies + BVCC fee logic against
 *         the REAL Aave v3 Pool on Arbitrum One. Needs network access (default public
 *         RPC, overridable via ARBITRUM_RPC_URL). Skips cleanly if forking fails.
 *
 *         Amounts are fixed so the BVCC fee (0.15%) equals an exact fraction of the
 *         withdraw/borrow increment, independent of the fork block.
 */
contract AaveIntegrationTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    address constant FEE_WALLET = 0x3e3eb089169a7315a994947465ce5f5FC3A307D4;
    uint256 constant FEE_NUM = 1500;      // agent wallet 0.15%
    uint256 constant FEE_DEN = 1_000_000;

    // Arbitrum One Aave v3
    IPool constant POOL = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
    IPoolDataProvider constant DATA = IPoolDataProvider(0x243Aa95cAC2a25651eda86e80bEe66114413c43b);
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    // Selectors
    bytes4 constant SUPPLY   = bytes4(keccak256("supply(address,uint256,address,uint16)"));
    bytes4 constant WITHDRAW = bytes4(keccak256("withdraw(address,uint256,address)"));
    bytes4 constant BORROW   = bytes4(keccak256("borrow(address,uint256,uint256,uint16,address)"));
    bytes4 constant REPAY    = bytes4(keccak256("repay(address,uint256,uint256,address)"));
    bytes4 constant FLASH    = bytes4(keccak256("flashLoanSimple(address,address,uint256,bytes,uint16)"));

    uint256 constant ALLOWED = 1 << 255;
    function pinW(uint256 w) internal pure returns (uint256) { return uint256(1) << (192 + w); }

    BVCCAgentWalletV3 wallet;
    address agent;
    address attacker;
    address aUSDC;
    address vdWETH;

    bool forked;

    function setUp() public {
        try vm.createSelectFork(vm.envOr("ARBITRUM_RPC_URL", string("https://arb1.arbitrum.io/rpc"))) {
            forked = true;
        } catch {
            forked = false;
            return;
        }

        wallet = new BVCCAgentWalletV3(P256_GX, P256_GY);
        wallet.setGuardians([address(10), address(11), address(12)]);
        agent = makeAddr("agent");
        attacker = makeAddr("attacker");
        vm.deal(agent, 1 ether);
        vm.deal(address(wallet), 1 ether);

        (aUSDC,, ) = DATA.getReserveTokensAddresses(USDC);
        (,, vdWETH) = DATA.getReserveTokensAddresses(WETH);

        // Fund the wallet with real underlying.
        deal(USDC, address(wallet), 20_000e6);
        deal(WETH, address(wallet), 1e18);

        _authorizeFull();
        _registerPolicies();
    }

    // ------------------------------------------------------------------
    // setup helpers
    // ------------------------------------------------------------------

    function _authorize(
        address[] memory tokens,
        address[] memory protocols,
        address[] memory recipients,
        uint128[] memory tokenTotalBudgets
    ) internal {
        BVCCAgentWalletV3.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = tokens;
        ap.tokenMaxAmounts = new uint128[](tokens.length);
        ap.tokenDailyLimits = new uint128[](tokens.length);
        ap.tokenTotalBudgets = tokenTotalBudgets;
        ap.allowedProtocols = protocols;
        ap.allowedRecipients = recipients;
        vm.prank(address(wallet));
        wallet.authorizeAgent(ap);
    }

    function _authorizeFull() internal {
        address[] memory tokens = new address[](2);
        tokens[0] = USDC; tokens[1] = WETH;
        address[] memory protos = new address[](1);
        protos[0] = address(POOL);
        _authorize(tokens, protos, new address[](0), new uint128[](2));
    }

    function _registerPolicies() internal {
        vm.startPrank(address(wallet));
        wallet.setCallPolicy(address(POOL), SUPPLY,   ALLOWED | pinW(2)); // onBehalfOf
        wallet.setCallPolicy(address(POOL), WITHDRAW, ALLOWED | pinW(2)); // to
        wallet.setCallPolicy(address(POOL), BORROW,   ALLOWED | pinW(4)); // onBehalfOf
        wallet.setCallPolicy(address(POOL), REPAY,    ALLOWED | pinW(3)); // onBehalfOf
        vm.stopPrank();
    }

    function _approveCd(address token, address spender, uint256 amt) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("approve(address,uint256)", spender, amt);
    }

    function _exec1(address target, bytes memory data) internal {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: 0, callData: data});
        vm.prank(agent);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));
    }

    function _exec2(address t1, bytes memory d1, address t2, bytes memory d2) internal {
        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: t1, value: 0, callData: d1});
        b[1] = Execution({target: t2, value: 0, callData: d2});
        vm.prank(agent);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));
    }

    function _bal(address token, address who) internal view returns (uint256) {
        return IERC20M(token).balanceOf(who);
    }

    modifier onlyForked() {
        if (!forked) return;
        _;
    }

    // ==================================================================
    // Full cycle + fee behaviour (balances before/after at each step)
    // ==================================================================

    function test_Fork_FullCycle_And_Fees() public onlyForked {
        uint256 SUP = 10_000e6;   // supply USDC
        uint256 BORROW_AMT = 0.05e18; // borrow WETH
        uint256 REPAY_AMT = 0.02e18;  // repay WETH
        uint256 WD = 5_000e6;     // withdraw USDC

        // ---- SUPPLY: USDC out, aUSDC in, NO fee ----
        uint256 wUSDC0 = _bal(USDC, address(wallet));
        uint256 aU0 = _bal(aUSDC, address(wallet));
        uint256 feeUSDC0 = _bal(USDC, FEE_WALLET);

        _exec2(USDC, _approveCd(USDC, address(POOL), SUP), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, SUP, address(wallet), uint16(0)));

        assertApproxEqAbs(_bal(USDC, address(wallet)), wUSDC0 - SUP, 2, "USDC leaves wallet on supply");
        assertApproxEqAbs(_bal(aUSDC, address(wallet)), aU0 + SUP, 2, "aUSDC minted ~= supplied");
        assertEq(_bal(USDC, FEE_WALLET), feeUSDC0, "NO BVCC fee on supply");

        // ---- BORROW: WETH in, variable debt in, fee = 0.15% of borrow ----
        uint256 wWETH0 = _bal(WETH, address(wallet));
        uint256 vd0 = _bal(vdWETH, address(wallet));
        uint256 feeWETH0 = _bal(WETH, FEE_WALLET);
        uint256 borrowFee = (BORROW_AMT * FEE_NUM) / FEE_DEN;

        _exec1(address(POOL),
            abi.encodeWithSignature("borrow(address,uint256,uint256,uint16,address)", WETH, BORROW_AMT, uint256(2), uint16(0), address(wallet)));

        assertEq(_bal(WETH, address(wallet)), wWETH0 + BORROW_AMT - borrowFee, "wallet nets borrow minus 0.15% fee");
        assertEq(_bal(WETH, FEE_WALLET), feeWETH0 + borrowFee, "fee wallet gets exactly 0.15% of borrow");
        assertApproxEqAbs(_bal(vdWETH, address(wallet)), vd0 + BORROW_AMT, 1e12, "variable WETH debt ~= borrowed");

        // ---- REPAY: WETH out, debt down, NO fee ----
        uint256 wWETH1 = _bal(WETH, address(wallet));
        uint256 feeWETH1 = _bal(WETH, FEE_WALLET);
        uint256 vd1 = _bal(vdWETH, address(wallet));

        _exec2(WETH, _approveCd(WETH, address(POOL), REPAY_AMT), address(POOL),
            abi.encodeWithSignature("repay(address,uint256,uint256,address)", WETH, REPAY_AMT, uint256(2), address(wallet)));

        assertApproxEqAbs(_bal(WETH, address(wallet)), wWETH1 - REPAY_AMT, 2, "WETH leaves wallet on repay");
        assertEq(_bal(WETH, FEE_WALLET), feeWETH1, "NO BVCC fee on repay");
        assertLt(_bal(vdWETH, address(wallet)), vd1, "debt decreased after repay");

        // ---- WITHDRAW: USDC in, aUSDC down, fee = 0.15% of withdraw ----
        uint256 wUSDC1 = _bal(USDC, address(wallet));
        uint256 feeUSDC1 = _bal(USDC, FEE_WALLET);
        uint256 aU1 = _bal(aUSDC, address(wallet));
        uint256 wdFee = (WD * FEE_NUM) / FEE_DEN;

        _exec1(address(POOL),
            abi.encodeWithSignature("withdraw(address,uint256,address)", USDC, WD, address(wallet)));

        assertEq(_bal(USDC, address(wallet)), wUSDC1 + WD - wdFee, "wallet nets withdraw minus 0.15% fee");
        assertEq(_bal(USDC, FEE_WALLET), feeUSDC1 + wdFee, "fee wallet gets exactly 0.15% of withdraw");
        assertApproxEqAbs(_bal(aUSDC, address(wallet)), aU1 - WD, 2, "aUSDC burned ~= withdrawn");
    }

    // ==================================================================
    // Policy blocks against the real Pool
    // ==================================================================

    function test_Fork_Withdraw_ToAttacker_Reverts() public onlyForked {
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec1(address(POOL), abi.encodeWithSignature("withdraw(address,uint256,address)", USDC, 1e6, attacker));
    }

    function test_Fork_Supply_OnBehalfExternal_Reverts() public onlyForked {
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec2(USDC, _approveCd(USDC, address(POOL), 1e6), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, 1e6, attacker, uint16(0)));
    }

    function test_Fork_Borrow_OnBehalfExternal_Reverts() public onlyForked {
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec1(address(POOL), abi.encodeWithSignature("borrow(address,uint256,uint256,uint16,address)", WETH, 1e15, uint256(2), uint16(0), attacker));
    }

    function test_Fork_Repay_OnBehalfExternal_Reverts() public onlyForked {
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec2(WETH, _approveCd(WETH, address(POOL), 1e15), address(POOL),
            abi.encodeWithSignature("repay(address,uint256,uint256,address)", WETH, 1e15, uint256(2), attacker));
    }

    function test_Fork_FlashLoanSimple_Reverts() public onlyForked {
        // Pool is whitelisted, but flashLoanSimple has no call policy → default-deny.
        vm.expectRevert(BVCCAgentWalletV3.SelectorNotAllowed.selector);
        _exec1(address(POOL),
            abi.encodeWithSignature("flashLoanSimple(address,address,uint256,bytes,uint16)", address(wallet), USDC, 1e6, bytes(""), uint16(0)));
    }

    function test_Fork_UnregisteredSetUserEMode_Reverts() public onlyForked {
        // setUserEMode(uint8) — a real Pool function, but no policy registered.
        vm.expectRevert(BVCCAgentWalletV3.SelectorNotAllowed.selector);
        _exec1(address(POOL), abi.encodeWithSignature("setUserEMode(uint8)", uint8(1)));
    }

    // ==================================================================
    // Budget consumed via approve to the Pool
    // ==================================================================

    function test_Fork_BudgetConsumedViaApprove() public onlyForked {
        // Re-authorize with a USDC lifetime budget of 15k; supplying 10k consumes 10k
        // (via the approve), a second 10k supply exceeds the budget.
        address[] memory tokens = new address[](2);
        tokens[0] = USDC; tokens[1] = WETH;
        address[] memory protos = new address[](1);
        protos[0] = address(POOL);
        uint128[] memory budgets = new uint128[](2);
        budgets[0] = 15_000e6; // USDC lifetime budget
        _authorize(tokens, protos, new address[](0), budgets);
        _registerPolicies();

        _exec2(USDC, _approveCd(USDC, address(POOL), 10_000e6), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, 10_000e6, address(wallet), uint16(0)));

        (, uint256 totalSpent) = wallet.getTokenSpent(agent, USDC);
        assertEq(totalSpent, 10_000e6, "approve to Pool consumes the token budget");

        // Second 10k supply → 20k > 15k budget → revert.
        vm.expectRevert(BVCCAgentWalletV3.TokenTotalBudgetExceeded.selector);
        _exec2(USDC, _approveCd(USDC, address(POOL), 10_000e6), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, 10_000e6, address(wallet), uint16(0)));
    }

    // ==================================================================
    // Pool absent from a non-empty allowedRecipients → approve spender blocked
    // ==================================================================

    function test_Fork_PoolMissingInAllowedRecipients_Reverts() public onlyForked {
        address[] memory tokens = new address[](2);
        tokens[0] = USDC; tokens[1] = WETH;
        address[] memory protos = new address[](1);
        protos[0] = address(POOL);
        address[] memory recips = new address[](1);
        recips[0] = makeAddr("someOtherRecipient"); // Pool intentionally NOT here
        _authorize(tokens, protos, recips, new uint128[](2));
        _registerPolicies();

        // The approve(USDC, Pool, amt) spender check fails (Pool not in recipients).
        vm.expectRevert(BVCCAgentWalletV3.RecipientNotAllowed.selector);
        _exec2(USDC, _approveCd(USDC, address(POOL), 1e6), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, 1e6, address(wallet), uint16(0)));
    }

    // ==================================================================
    // Atomicity: approve + supply, second item fails → whole batch rolls back
    // ==================================================================

    function test_Fork_ApproveSupplyAtomicity_Rollback() public onlyForked {
        uint256 allow0 = IERC20M(USDC).allowance(address(wallet), address(POOL));
        uint256 bal0 = _bal(USDC, address(wallet));

        // supply amount far exceeds the wallet's USDC → Pool.transferFrom reverts → whole tx reverts.
        uint256 tooMuch = 1_000_000_000e6;
        vm.expectRevert();
        _exec2(USDC, _approveCd(USDC, address(POOL), tooMuch), address(POOL),
            abi.encodeWithSignature("supply(address,uint256,address,uint16)", USDC, tooMuch, address(wallet), uint16(0)));

        assertEq(IERC20M(USDC).allowance(address(wallet), address(POOL)), allow0, "approve rolled back with the batch");
        assertEq(_bal(USDC, address(wallet)), bal0, "wallet USDC unchanged after reverted batch");
    }
}
