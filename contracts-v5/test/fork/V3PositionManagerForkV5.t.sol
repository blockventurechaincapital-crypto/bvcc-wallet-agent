// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCV3PositionManagerValidatorV5} from "../../src/validators/BVCCV3PositionManagerValidatorV5.sol";

interface INfpmV3 {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(MintParams calldata) external payable returns (uint256, uint128, uint256, uint256);
    function increaseLiquidity(IncreaseLiquidityParams calldata) external payable returns (uint128, uint256, uint256);
    function decreaseLiquidity(DecreaseLiquidityParams calldata) external payable returns (uint256, uint256);
    function collect(CollectParams calldata) external payable returns (uint256, uint256);
    function burn(uint256 tokenId) external payable;
    function ownerOf(uint256 tokenId) external view returns (address);
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory);
    function positions(uint256 tokenId)
        external
        view
        returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128);
}

interface IV3FactoryLite {
    function getPool(address, address, uint24) external view returns (address);
}

interface IV3PoolLite {
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool);
}

/// @notice The Uniswap v3 position validator against the real Arbitrum One
///         NonfungiblePositionManager and the WETH/USDC 0.05% pool.
contract V3PositionManagerForkV5Test is V5Base {
    address private constant NFPM = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address private constant V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address private constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address private constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    uint24 private constant POOL_FEE = 500;
    int24 private constant SPACING = 10;
    address private constant AGENT = address(0xA6E);
    address private constant STRANGER = address(0xBAD);
    uint256 private constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);
    uint128 private constant BUDGET = 1e30;

    BVCCAgentWalletV5 private wallet;
    BVCCV3PositionManagerValidatorV5 private validator;
    int24 private lower;
    int24 private upper;

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        super.setUp();

        (, int24 tick,,,,,) = IV3PoolLite(IV3FactoryLite(V3_FACTORY).getPool(WETH, USDC, POOL_FEE)).slot0();
        int24 aligned = (tick / SPACING) * SPACING;
        lower = aligned - 100 * SPACING;
        upper = aligned + 100 * SPACING;

        wallet = _createAgent();
        deal(WETH, address(wallet), 10 ether);
        deal(USDC, address(wallet), 100_000e6);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = WETH;
        p.allowedTokens[1] = USDC;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i; i < 2; i++) {
            p.tokenMaxAmounts[i] = BUDGET;
            p.tokenDailyLimits[i] = BUDGET;
            p.tokenTotalBudgets[i] = BUDGET;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = NFPM;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));

        validator = new BVCCV3PositionManagerValidatorV5(NFPM);
        vm.prank(ADMIN);
        registry.proposeValidator(NFPM, address(validator));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(NFPM);

        bytes4[9] memory selectors = [
            INfpmV3.mint.selector,
            INfpmV3.increaseLiquidity.selector,
            INfpmV3.decreaseLiquidity.selector,
            INfpmV3.collect.selector,
            INfpmV3.burn.selector,
            // Opened on purpose: the validator itself must refuse these.
            INfpmV3.multicall.selector,
            INfpmV3.approve.selector,
            INfpmV3.setApprovalForAll.selector,
            INfpmV3.transferFrom.selector
        ];
        for (uint256 i; i < selectors.length; i++) {
            _self(
                address(wallet),
                abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, NFPM, selectors[i], ALLOWED_DEEP))
            );
        }
    }

    function _live() private view returns (bool) {
        return block.chainid == 42161;
    }

    // ------------------------------------------------------------------ calldata

    function _mintData(address recipient) private view returns (bytes memory) {
        return abi.encodeCall(
            INfpmV3.mint,
            (
                INfpmV3.MintParams({
                    token0: WETH,
                    token1: USDC,
                    fee: POOL_FEE,
                    tickLower: lower,
                    tickUpper: upper,
                    amount0Desired: 1 ether,
                    amount1Desired: 5_000e6,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: recipient,
                    deadline: vm.getBlockTimestamp() + 1 hours
                })
            )
        );
    }

    function _mintBatch(address recipient) private view returns (bytes memory) {
        Execution[] memory b = new Execution[](3);
        b[0] = Execution(WETH, 0, abi.encodeCall(IERC20.approve, (NFPM, 1 ether)));
        b[1] = Execution(USDC, 0, abi.encodeCall(IERC20.approve, (NFPM, 5_000e6)));
        b[2] = Execution(NFPM, 0, _mintData(recipient));
        return _batch(b);
    }

    function _mint() private returns (uint256 tokenId) {
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _mintBatch(address(wallet)));
        tokenId = INfpmV3(NFPM).tokenOfOwnerByIndex(address(wallet), 0);
    }

    function _liquidity(uint256 tokenId) private view returns (uint128 liq) {
        (,,,,,,, liq,,,,) = INfpmV3(NFPM).positions(tokenId);
    }

    function _decrease(uint256 tokenId, uint128 liq) private view returns (bytes memory) {
        return abi.encodeCall(
            INfpmV3.decreaseLiquidity,
            (INfpmV3.DecreaseLiquidityParams(tokenId, liq, 0, 0, vm.getBlockTimestamp() + 1 hours))
        );
    }

    function _collect(uint256 tokenId, address recipient) private pure returns (bytes memory) {
        return abi.encodeCall(
            INfpmV3.collect, (INfpmV3.CollectParams(tokenId, recipient, type(uint128).max, type(uint128).max))
        );
    }

    function _expectRefused(bytes memory data) private {
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(NFPM, 0, data));
    }

    // ------------------------------------------------------------------ allowed path

    /// @notice Mint, increase, decrease + collect, burn — the whole life of a position.
    ///         The tokens that leave are charged; what comes back on collect is charged too.
    function test_Fork_V3_FullPositionLifecycle() public {
        if (!_live()) return;
        (uint128 wethDay0,) = wallet.getTokenSpent(AGENT, WETH);
        uint256 tokenId = _mint();
        assertEq(INfpmV3(NFPM).ownerOf(tokenId), address(wallet), "position minted to the wallet");
        uint128 liq = _liquidity(tokenId);
        assertGt(liq, 0, "liquidity added");
        (uint128 wethDay1,) = wallet.getTokenSpent(AGENT, WETH);
        assertGt(wethDay1, wethDay0, "WETH that left was charged");
        assertEq(IERC20(WETH).allowance(address(wallet), NFPM), 0, "agent approval reset after the batch");

        // increase
        Execution[] memory inc = new Execution[](3);
        inc[0] = Execution(WETH, 0, abi.encodeCall(IERC20.approve, (NFPM, 0.1 ether)));
        inc[1] = Execution(USDC, 0, abi.encodeCall(IERC20.approve, (NFPM, 500e6)));
        inc[2] = Execution(
            NFPM,
            0,
            abi.encodeCall(
                INfpmV3.increaseLiquidity,
                (INfpmV3.IncreaseLiquidityParams(tokenId, 0.1 ether, 500e6, 0, 0, vm.getBlockTimestamp() + 1 hours))
            )
        );
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _batch(inc));
        uint128 liq2 = _liquidity(tokenId);
        assertGt(liq2, liq, "liquidity increased");

        // decrease all + collect in one batch: what comes in is charged
        (uint128 usdcBefore,) = wallet.getTokenSpent(AGENT, USDC);
        uint256 balBefore = IERC20(USDC).balanceOf(address(wallet));
        Execution[] memory out = new Execution[](2);
        out[0] = Execution(NFPM, 0, _decrease(tokenId, liq2));
        out[1] = Execution(NFPM, 0, _collect(tokenId, address(wallet)));
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _batch(out));
        assertEq(_liquidity(tokenId), 0, "liquidity removed");
        uint256 received = IERC20(USDC).balanceOf(address(wallet)) - balBefore;
        (uint128 usdcAfter,) = wallet.getTokenSpent(AGENT, USDC);
        assertGt(received, 0, "USDC came back");
        assertGe(usdcAfter - usdcBefore, received, "collected USDC charged to the budget");

        // burn the empty position
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _one(NFPM, 0, abi.encodeCall(INfpmV3.burn, (tokenId))));
        vm.expectRevert();
        INfpmV3(NFPM).ownerOf(tokenId);
    }

    // ------------------------------------------------------------------ refusals

    function test_Fork_V3_MintToAnotherRecipientRefused() public {
        if (!_live()) return;
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _mintBatch(STRANGER));
    }

    function test_Fork_V3_MintWithValueRefused() public {
        if (!_live()) return;
        (bool ok,,,,) = validator.validate(AGENT, address(wallet), NFPM, 1, _mintData(address(wallet)));
        assertFalse(ok, "native value refused");
    }

    function test_Fork_V3_CollectToAnotherRecipientRefused() public {
        if (!_live()) return;
        uint256 tokenId = _mint();
        _expectRefused(_collect(tokenId, STRANGER));
        // address(0) makes the manager keep the tokens: refused as well
        _expectRefused(_collect(tokenId, address(0)));
    }

    /// @notice A stranger's position approved to the wallet: the agent may not touch it.
    function test_Fork_V3_ForeignPositionRefused() public {
        if (!_live()) return;
        deal(WETH, STRANGER, 10 ether);
        deal(USDC, STRANGER, 100_000e6);
        vm.startPrank(STRANGER);
        IERC20(WETH).approve(NFPM, type(uint256).max);
        IERC20(USDC).approve(NFPM, type(uint256).max);
        (bool ok, bytes memory ret) = NFPM.call(_mintData(STRANGER));
        require(ok, "stranger mint");
        uint256 foreign = abi.decode(ret, (uint256));
        INfpmV3(NFPM).approve(address(wallet), foreign);
        INfpmV3(NFPM).setApprovalForAll(address(wallet), true);
        vm.stopPrank();
        uint128 liq = _liquidity(foreign);

        _expectRefused(_decrease(foreign, liq));
        _expectRefused(_collect(foreign, address(wallet)));
        _expectRefused(abi.encodeCall(INfpmV3.burn, (foreign)));
        _expectRefused(
            abi.encodeCall(
                INfpmV3.increaseLiquidity,
                (INfpmV3.IncreaseLiquidityParams(foreign, 1, 1, 0, 0, vm.getBlockTimestamp() + 1 hours))
            )
        );
        assertEq(_liquidity(foreign), liq, "foreign position untouched");
    }

    /// @notice The wallet's own position, approved by the owner to a third party: the agent
    ///         must not add liquidity to it (the third party could take it away).
    function test_Fork_V3_IncreaseIntoApprovedPositionRefused() public {
        if (!_live()) return;
        uint256 tokenId = _mint();
        _asOwner(address(wallet), NFPM, 0, abi.encodeCall(INfpmV3.approve, (STRANGER, tokenId)));
        _expectRefused(
            abi.encodeCall(
                INfpmV3.increaseLiquidity,
                (INfpmV3.IncreaseLiquidityParams(tokenId, 1, 1, 0, 0, vm.getBlockTimestamp() + 1 hours))
            )
        );
    }

    /// @notice Every other manager function is refused, even with a policy opened for it.
    function test_Fork_V3_OtherFunctionsRefused() public {
        if (!_live()) return;
        uint256 tokenId = _mint();
        bytes[] memory inner = new bytes[](1);
        inner[0] = _collect(tokenId, address(wallet));
        _expectRefused(abi.encodeCall(INfpmV3.multicall, (inner)));
        // approve(address,uint256) shares its selector with ERC-20 approve: the wallet
        // treats it as a token approval and refuses it before any validator is asked.
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.TokenNotAllowed.selector);
        wallet.executeAsAgent(_mode(), _one(NFPM, 0, abi.encodeCall(INfpmV3.approve, (STRANGER, tokenId))));
        (bool ok,,,,) = validator.validate(AGENT, address(wallet), NFPM, 0, abi.encodeCall(INfpmV3.approve, (STRANGER, tokenId)));
        assertFalse(ok, "and the validator refuses it too");
        _expectRefused(abi.encodeCall(INfpmV3.setApprovalForAll, (STRANGER, true)));
        _expectRefused(abi.encodeCall(INfpmV3.transferFrom, (address(wallet), STRANGER, tokenId)));
        assertEq(INfpmV3(NFPM).ownerOf(tokenId), address(wallet), "position stays in the wallet");
    }

    function test_Fork_V3_BoundToItsManager() public {
        if (!_live()) return;
        (bool ok,,,,) = validator.validate(AGENT, address(wallet), STRANGER, 0, _mintData(address(wallet)));
        assertFalse(ok, "another target is refused");
    }

    function test_Fork_V3_NonexistentPositionRefused() public {
        if (!_live()) return;
        vm.expectRevert();
        validator.validate(AGENT, address(wallet), NFPM, 0, abi.encodeCall(INfpmV3.burn, (type(uint256).max)));
    }
}
