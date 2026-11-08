// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {DeployV5} from "../../script/DeployV5.s.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import {BVCCUniversalRouterValidatorV5} from "../../src/validators/BVCCUniversalRouterValidatorV5.sol";
import {BVCCAaveV3ValidatorV5} from "../../src/validators/BVCCAaveV3ValidatorV5.sol";

interface IEntryPointV09 {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);
    function getNonce(address sender, uint192 key) external view returns (uint256);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IAavePool {
    function getUserAccountData(address user)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256);
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)
        external;
    function ADDRESSES_PROVIDER() external view returns (address);
}

interface IAddressesProvider {
    function getPriceOracle() external view returns (address);
}

interface IAaveOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

/// @dev Runs against a fork of Arbitrum One. Set ARBITRUM_RPC to run (FORK_BLOCK optional,
///      latest by default; a public RPC only serves recent blocks). Skipped otherwise.
contract ArbitrumForkV5Test is V5Base {
    address internal constant ENTRYPOINT = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;
    address internal constant UR = 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address internal constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;

    address internal constant FEE_SAFE = address(0xFEE5AFE);
    address internal constant ADMIN_SAFE = address(0xAD5AFE);
    uint256 internal constant ALLOWED = 1 << 255;
    uint256 internal constant DEEP = 1 << 254;

    bool internal forked;
    DeployV5.Addresses internal a;
    BVCCAgentWalletV5 internal wallet;
    address internal agent = address(0xA6E);

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        uint256 forkBlock = vm.envOr("FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);
        forked = true;
        DeployV5 d = new DeployV5();
        a = d.deployAll(FEE_SAFE, ADMIN_SAFE);
        d.verify(a, FEE_SAFE, ADMIN_SAFE);
        (uint256 x, uint256 y) = vm.publicKeyP256(PK);
        qx = bytes32(x);
        qy = bytes32(y);
        BVCCWalletFactoryV5 f = BVCCWalletFactoryV5(a.agentFactory);
        address predicted = f.getWalletAddress(qx, qy);
        wallet = BVCCAgentWalletV5(payable(f.createWallet(qx, qy, CRED, _credentialSig(PK, predicted, CRED))));
        vm.deal(address(wallet), 1 ether);
    }

    modifier onlyFork() {
        if (!forked) {
            vm.skip(true);
        }
        _;
    }

    // ------------------------------------------------------------ ERC-4337 with the real EntryPoint

    function _userOp(bytes memory callData) internal view returns (PackedUserOperation memory op) {
        op.sender = address(wallet);
        op.nonce = IEntryPointV09(ENTRYPOINT).getNonce(address(wallet), 0);
        op.callData = callData;
        op.accountGasLimits = bytes32((uint256(2_000_000) << 128) | uint256(500_000));
        op.preVerificationGas = 100_000;
        op.gasFees = bytes32((uint256(0.01 gwei) << 128) | uint256(1 gwei));
    }

    function _signOp(PackedUserOperation memory op, uint48 validUntil, uint256 pk) internal view {
        op.signature = "";
        bytes32 h = IEntryPointV09(ENTRYPOINT).getUserOpHash(op);
        op.signature = abi.encode(validUntil, _webauthn(pk, keccak256(abi.encode(h, validUntil))));
    }

    function _handle(PackedUserOperation memory op) internal {
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        address bundler = address(0xB0DD1E);
        vm.prank(bundler, bundler);
        IEntryPointV09(ENTRYPOINT).handleOps(ops, payable(bundler));
    }

    function test_Fork_EntryPoint_OwnerOperation() public onlyFork {
        bytes memory call = abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(address(0xCAFE), 0.1 ether, "")));
        PackedUserOperation memory op = _userOp(call);
        _signOp(op, uint48(vm.getBlockTimestamp() + 900), PK);
        _handle(op);
        assertEq(address(0xCAFE).balance, 0.1 ether - 0.00015 ether, "recipient gets value minus 0.15%");
        assertEq(FEE_SAFE.balance, 0.00015 ether);
    }

    function test_Fork_EntryPoint_ExpiredSignatureRejected() public onlyFork {
        bytes memory call = abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(address(0xCAFE), 0.1 ether, "")));
        PackedUserOperation memory op = _userOp(call);
        _signOp(op, uint48(vm.getBlockTimestamp() + 900), PK);
        vm.warp(vm.getBlockTimestamp() + 901);
        vm.expectRevert();
        _handle(op);
    }

    function test_Fork_EntryPoint_WrongKeyRejected() public onlyFork {
        bytes memory call = abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(address(0xCAFE), 0.1 ether, "")));
        PackedUserOperation memory op = _userOp(call);
        _signOp(op, uint48(vm.getBlockTimestamp() + 900), PK2);
        vm.expectRevert();
        _handle(op);
    }

    function test_Fork_EntryPoint_ConfiguresAgentByUserOp() public onlyFork {
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.maxPerTxWei = 0.1 ether;
        p.dailyLimitWei = 0.1 ether;
        p.totalBudgetWei = 0.1 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = address(0xCAFE);
        bytes memory inner = abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p));
        bytes memory call = abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(address(wallet), 0, inner)));
        PackedUserOperation memory op = _userOp(call);
        _signOp(op, uint48(vm.getBlockTimestamp() + 900), PK);
        _handle(op);
        assertTrue(wallet.getAgentPermission(agent).active);
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(address(0xCAFE), 0.05 ether, ""));
    }

    // ------------------------------------------------------------ Uniswap Universal Router

    function _registerValidator(address target, address validator) internal {
        vm.prank(ADMIN_SAFE);
        BVCCValidatorRegistryV5(a.registry).proposeValidator(target, validator);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN_SAFE);
        BVCCValidatorRegistryV5(a.registry).activateValidator(target);
    }

    function _authorizeSwapAgent() internal {
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = USDC;
        p.allowedTokens[1] = WETH;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        p.tokenMaxAmounts[0] = 100e6;
        p.tokenDailyLimits[0] = 100e6;
        p.tokenTotalBudgets[0] = 100e6;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = UR;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, UR, bytes4(0x3593564c), ALLOWED | DEEP))
        );
    }

    /// @dev The owner left an unlimited Permit2 allowance to the router (the V4 case-3 hole).
    function _ownerPermit2(address token) internal {
        _asOwner(address(wallet), token, 0, abi.encodeCall(IERC20.approve, (PERMIT2, type(uint256).max)));
        _asOwner(
            address(wallet),
            PERMIT2,
            0,
            abi.encodeCall(IPermit2.approve, (token, UR, type(uint160).max, uint48(vm.getBlockTimestamp() + 365 days)))
        );
    }

    function _swapCall(address recipient, address tokenIn, uint256 amountIn) internal view returns (bytes memory) {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(recipient, amountIn, uint256(1), abi.encodePacked(tokenIn, uint24(500), WETH), true);
        return abi.encodeWithSelector(bytes4(0x3593564c), hex"00", inputs, vm.getBlockTimestamp() + 600);
    }

    function test_Fork_UR_AgentSwapChargedThroughOwnerAllowance() public onlyFork {
        deal(USDC, address(wallet), 1_000e6);
        _ownerPermit2(USDC);
        _authorizeSwapAgent();
        _registerValidator(UR, address(new BVCCUniversalRouterValidatorV5(UR, a.hookRegistry)));

        uint256 wethBefore = IERC20(WETH).balanceOf(address(wallet));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(UR, 0, _swapCall(address(wallet), USDC, 60e6)));
        (, uint128 total) = wallet.getTokenSpent(agent, USDC);
        assertEq(total, 60e6 + 0.09e6, "USDC pulled by the router + agent fee are charged");
        assertGt(IERC20(WETH).balanceOf(address(wallet)), wethBefore, "WETH received");
        // The agent fee is taken on what left (USDC), even though the router packs
        // the tokens inside the path.
        assertEq(IERC20(USDC).balanceOf(FEE_SAFE), 0.09e6, "agent fee in USDC");
        assertEq(IERC20(WETH).balanceOf(FEE_SAFE), 0, "no fee on the WETH received");

        // 39.9 + fee = 39.95985 > 39.91 left today.
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.TokenDailyLimitExceeded.selector);
        wallet.executeAsAgent(_mode(), _one(UR, 0, _swapCall(address(wallet), USDC, 39.9e6)));
        // 39.85 + fee = 39.909775 fits.
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(UR, 0, _swapCall(address(wallet), USDC, 39.85e6)));
    }

    function test_Fork_UR_ForeignRecipientRejected() public onlyFork {
        deal(USDC, address(wallet), 1_000e6);
        _ownerPermit2(USDC);
        _authorizeSwapAgent();
        _registerValidator(UR, address(new BVCCUniversalRouterValidatorV5(UR, a.hookRegistry)));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(UR, 0, _swapCall(address(0xBAD), USDC, 10e6)));
    }

    function test_Fork_UR_NotAllowedTokenRejected() public onlyFork {
        deal(ARB, address(wallet), 1_000e18);
        _ownerPermit2(ARB);
        _authorizeSwapAgent();
        _registerValidator(UR, address(new BVCCUniversalRouterValidatorV5(UR, a.hookRegistry)));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(wallet), 10e18, uint256(1), abi.encodePacked(ARB, uint24(500), WETH), true);
        bytes memory call = abi.encodeWithSelector(bytes4(0x3593564c), hex"00", inputs, vm.getBlockTimestamp() + 600);
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.TokenNotAllowed.selector);
        wallet.executeAsAgent(_mode(), _one(UR, 0, call));
    }

    // ------------------------------------------------------------ SwapRouter02 (what the app uses)

    address internal constant SWAP_ROUTER02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @dev Audit V5-H-02 / V5-H-03: anchors alone are no longer enough; with no
    ///      validator for SwapRouter02, an agent cannot call it.
    function test_Fork_SwapRouter02_NeedsValidator() public onlyFork {
        deal(USDC, address(wallet), 1_000e6);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = USDC;
        p.allowedTokens[1] = WETH;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        p.tokenMaxAmounts[0] = 100e6;
        p.tokenDailyLimits[0] = 100e6;
        p.tokenTotalBudgets[0] = 100e6;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = SWAP_ROUTER02;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        // exactInputSingle: word 0 tokenIn (T), word 1 tokenOut (T), word 3 recipient (W).
        uint256 policy = ALLOWED | (uint256(1 << 3) << 192) | (uint256(0x3) << 128);
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, SWAP_ROUTER02, bytes4(0x04e45aaf), policy))
        );

        ExactInputSingleParams memory sp = ExactInputSingleParams(USDC, WETH, 500, address(wallet), 50e6, 1, 0);
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(USDC, 0, abi.encodeCall(IERC20.approve, (SWAP_ROUTER02, 50e6)));
        b[1] = Execution(SWAP_ROUTER02, 0, abi.encodeWithSelector(bytes4(0x04e45aaf), sp));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.CallNeedsValidator.selector);
        wallet.executeAsAgent(_mode(), _batch(b));
    }

    // ------------------------------------------------------------ Aave v3

    function _authorizeAaveAgent() internal {
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = USDC;
        p.allowedTokens[1] = WETH;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i = 0; i < 2; i++) {
            p.tokenMaxAmounts[i] = type(uint128).max;
            p.tokenDailyLimits[i] = type(uint128).max;
            p.tokenTotalBudgets[i] = type(uint128).max;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = AAVE_POOL;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, AAVE_POOL, bytes4(0x617ba037), ALLOWED | DEEP))
        );
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, AAVE_POOL, bytes4(0xa415bcad), ALLOWED | DEEP))
        );
        _registerValidator(AAVE_POOL, address(new BVCCAaveV3ValidatorV5(AAVE_POOL)));
    }

    function _wethFor(uint256 baseAmount) internal view returns (uint256) {
        address oracle = IAddressesProvider(IAavePool(AAVE_POOL).ADDRESSES_PROVIDER()).getPriceOracle();
        return baseAmount * 1e18 / IAaveOracle(oracle).getAssetPrice(WETH);
    }

    function test_Fork_Aave_SupplyBorrowAndHealthMinimum() public onlyFork {
        // 10,000 to supply + 15 of agent fee on top.
        deal(USDC, address(wallet), 10_015e6);
        _authorizeAaveAgent();

        Execution[] memory b = new Execution[](2);
        b[0] = Execution(USDC, 0, abi.encodeCall(IERC20.approve, (AAVE_POOL, 10_000e6)));
        b[1] = Execution(AAVE_POOL, 0, abi.encodeCall(IAavePool.supply, (USDC, 10_000e6, address(wallet), 0)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        assertEq(IERC20(USDC).allowance(address(wallet), AAVE_POOL), 0, "approval restored");
        (, uint128 usdcCharged) = wallet.getTokenSpent(agent, USDC);
        assertEq(usdcCharged, 10_015e6, "supply is an outflow, with the agent fee");
        assertEq(IERC20(USDC).balanceOf(FEE_SAFE), 15e6);

        (,, uint256 available,,,) = IAavePool(AAVE_POOL).getUserAccountData(address(wallet));
        uint256 big = _wethFor(available * 95 / 100);
        bytes memory borrowBig = abi.encodeCall(IAavePool.borrow, (WETH, big, 2, 0, address(wallet)));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.PostCheckFailed.selector);
        wallet.executeAsAgent(_mode(), _one(AAVE_POOL, 0, borrowBig));

        uint256 small = _wethFor(available * 30 / 100);
        vm.prank(agent);
        wallet.executeAsAgent(
            _mode(), _one(AAVE_POOL, 0, abi.encodeCall(IAavePool.borrow, (WETH, small, 2, 0, address(wallet))))
        );
        (, uint128 wethCharged) = wallet.getTokenSpent(agent, WETH);
        uint256 wethFee = small * 1500 / 1_000_000;
        assertEq(wethCharged, small + wethFee, "debt + fee charged to the WETH budget");
        assertEq(IERC20(WETH).balanceOf(FEE_SAFE), wethFee, "fee paid in WETH");
        (,,,,, uint256 hf) = IAavePool(AAVE_POOL).getUserAccountData(address(wallet));
        assertGe(hf, 1.2e18);
    }

    /// @dev Audit V5-H-04 on the real Aave v3 Pool: withdrawing collateral and forwarding
    ///      it in the same batch is charged to the USDC caps; a withdrawal pays the fee.
    function test_Fork_Aave_WithdrawIsChargedAndCapped() public onlyFork {
        address recipient = address(0xCAFE);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = USDC;
        p.tokenMaxAmounts = new uint128[](1);
        p.tokenDailyLimits = new uint128[](1);
        p.tokenTotalBudgets = new uint128[](1);
        p.tokenMaxAmounts[0] = 10e6;
        p.tokenDailyLimits[0] = 10e6;
        p.tokenTotalBudgets[0] = 10e6;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = AAVE_POOL;
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = recipient;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, AAVE_POOL, bytes4(0x69328dec), ALLOWED | DEEP))
        );
        _registerValidator(AAVE_POOL, address(new BVCCAaveV3ValidatorV5(AAVE_POOL)));

        // The owner holds 100 USDC as Aave collateral and 1 USDC liquid.
        deal(USDC, address(wallet), 101e6);
        vm.startPrank(address(wallet));
        IERC20(USDC).approve(AAVE_POOL, 100e6);
        IAavePool(AAVE_POOL).supply(USDC, 100e6, address(wallet), 0);
        vm.stopPrank();

        Execution[] memory b = new Execution[](2);
        b[0] = Execution(AAVE_POOL, 0, abi.encodeWithSelector(bytes4(0x69328dec), USDC, 99e6, address(wallet)));
        b[1] = Execution(USDC, 0, abi.encodeCall(IERC20.transfer, (recipient, 99e6)));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.TokenBatchLimitExceeded.selector);
        wallet.executeAsAgent(_mode(), _batch(b));

        b[0] = Execution(AAVE_POOL, 0, abi.encodeWithSelector(bytes4(0x69328dec), USDC, 5e6, address(wallet)));
        b[1] = Execution(USDC, 0, abi.encodeCall(IERC20.transfer, (recipient, 5e6)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        (, uint128 charged) = wallet.getTokenSpent(agent, USDC);
        assertEq(charged, 5e6 + 0.0075e6, "withdrawn, forwarded, charged once with the fee");
        assertEq(IERC20(USDC).balanceOf(recipient), 5e6);
        assertEq(IERC20(USDC).balanceOf(FEE_SAFE), 0.0075e6);
    }

    function test_Fork_Aave_BorrowOnBehalfOfOtherRejected() public onlyFork {
        _authorizeAaveAgent();
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(
            _mode(), _one(AAVE_POOL, 0, abi.encodeCall(IAavePool.borrow, (WETH, 1, 2, 0, address(0xBAD))))
        );
    }
}
