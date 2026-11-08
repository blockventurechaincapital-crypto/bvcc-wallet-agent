// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCPositionManagerValidatorV5} from "../../src/validators/BVCCPositionManagerValidatorV5.sol";

interface IAuditLivePositionManager {
    function ownerOf(uint256 tokenId) external view returns (address);
    function approve(address operator, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128);
    function nextTokenId() external view returns (uint256);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (BVCCPositionManagerValidatorV5.PoolKey memory, uint256);
}

contract AuditPositionManagerForkV5Test is V5Base {
    address private constant PM = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
    address private constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address private constant AGENT = address(0xA6E);
    uint256 private constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        super.setUp();
    }

    /// @dev Audit V5-R2-H01. Uses a real Arbitrum v4 NFT whose owner grants the wallet
    ///      ERC-721 operator approval: the agent must not fund it from the wallet.
    function test_Fork_PM_ForeignOwnedNFTRejected() public {
        if (block.chainid != 42161) return;
        IAuditLivePositionManager live = IAuditLivePositionManager(PM);
        BVCCPositionManagerValidatorV5.PoolKey memory key;
        (key,) = live.getPoolAndPositionInfo(1);
        assertEq(key.hooks, address(0), "position 1 must have no hook");
        BVCCAgentWalletV5 wallet = _createAgent();
        address foreignOwner = live.ownerOf(1);
        assertTrue(foreignOwner != address(wallet));
        vm.prank(foreignOwner);
        live.approve(address(wallet), 1);
        uint128 liquidityBefore = live.getPositionLiquidity(1);
        deal(key.currency0, address(wallet), 1e24);
        deal(key.currency1, address(wallet), 1e18);
        _asOwner(address(wallet), key.currency0, 0, abi.encodeCall(IERC20.approve, (PERMIT2, type(uint256).max)));
        _asOwner(address(wallet), key.currency1, 0, abi.encodeCall(IERC20.approve, (PERMIT2, type(uint256).max)));
        _asOwner(
            address(wallet),
            PERMIT2,
            0,
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)", key.currency0, PM, type(uint160).max, uint48(block.timestamp + 30 days)
            )
        );
        _asOwner(
            address(wallet),
            PERMIT2,
            0,
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)", key.currency1, PM, type(uint160).max, uint48(block.timestamp + 30 days)
            )
        );

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = key.currency0;
        p.allowedTokens[1] = key.currency1;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i; i < 2; i++) {
            p.tokenMaxAmounts[i] = type(uint128).max;
            p.tokenDailyLimits[i] = type(uint128).max;
            p.tokenTotalBudgets[i] = type(uint128).max;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = PM;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));

        BVCCPositionManagerValidatorV5 validator = new BVCCPositionManagerValidatorV5(PM, address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(PM, address(validator));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(PM);
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, PM, bytes4(0xdd46508f), ALLOWED_DEEP))
        );

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(uint256(1), uint256(1e12), type(uint128).max, type(uint128).max, bytes(""));
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
        bytes memory data = abi.encodeWithSelector(
            bytes4(0xdd46508f), abi.encode(hex"001212", params), block.timestamp + 1 days
        );
        (bool accepted,,,,) = validator.validate(AGENT, address(wallet), PM, 0, data);
        assertFalse(accepted, "validator rejects foreign NFT");
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(PM, 0, data));
        assertEq(live.getPositionLiquidity(1), liquidityBefore, "foreign NFT not funded");
    }

    /// @dev Audit V5-R2-H01. Decreasing a wallet position and increasing a foreign one in
    ///      one call nets inside the PositionManager without a matching token outflow:
    ///      it must be rejected.
    function test_Fork_PM_LiquidityMoveToForeignNFTRejected() public {
        if (block.chainid != 42161) return;
        IAuditLivePositionManager live = IAuditLivePositionManager(PM);
        (BVCCPositionManagerValidatorV5.PoolKey memory key, uint256 info) = live.getPoolAndPositionInfo(1);
        assertEq(key.hooks, address(0));
        int24 lower = int24(uint24(info >> 8));
        int24 upper = int24(uint24(info >> 32));
        BVCCAgentWalletV5 wallet = _createAgent();
        address attacker = address(0xBAD);
        uint256 amount = 1e12;

        deal(key.currency0, address(wallet), 1e24);
        deal(key.currency1, address(wallet), 1e18);
        deal(key.currency0, attacker, 1e24);
        deal(key.currency1, attacker, 1e18);
        _approvePermit2(address(wallet), key.currency0);
        _approvePermit2(address(wallet), key.currency1);
        _approvePermit2(attacker, key.currency0);
        _approvePermit2(attacker, key.currency1);

        uint256 walletNft = live.nextTokenId();
        bytes memory walletMint = _mintCall(key, lower, upper, amount, address(wallet));
        _asOwner(address(wallet), PM, 0, walletMint);
        assertEq(live.ownerOf(walletNft), address(wallet));
        assertEq(live.getPositionLiquidity(walletNft), amount);

        uint256 attackerNft = live.nextTokenId();
        vm.prank(attacker);
        live.modifyLiquidities(_mintActions(key, lower, upper, amount, attacker), block.timestamp + 1 days);
        assertEq(live.ownerOf(attackerNft), attacker);
        vm.prank(attacker);
        live.approve(address(wallet), attackerNft);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = key.currency0;
        p.allowedTokens[1] = key.currency1;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i; i < 2; i++) {
            p.tokenMaxAmounts[i] = 2;
            p.tokenDailyLimits[i] = 2;
            p.tokenTotalBudgets[i] = 2;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = PM;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        BVCCPositionManagerValidatorV5 validator = new BVCCPositionManagerValidatorV5(PM, address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(PM, address(validator));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(PM);
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, PM, bytes4(0xdd46508f), ALLOWED_DEEP))
        );

        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(walletNft, amount, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(attackerNft, amount, type(uint128).max, type(uint128).max, bytes(""));
        params[2] = abi.encode(key.currency0);
        params[3] = abi.encode(key.currency1);
        bytes memory move = abi.encodeWithSelector(
            bytes4(0xdd46508f), abi.encode(hex"01001212", params), vm.getBlockTimestamp() + 1 days
        );
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(PM, 0, move));

        assertEq(live.getPositionLiquidity(walletNft), amount, "wallet NFT keeps its liquidity");
        assertEq(live.getPositionLiquidity(attackerNft), amount, "attacker NFT gains nothing");
    }

    /// @dev Audit V5-R3-H01. Both NFTs belong to the wallet, but the destination already
    ///      has a single-token approval to a third party: moving liquidity into it must fail.
    function test_Fork_PM_LiquidityMoveToApprovedWalletNFTRejected() public {
        if (block.chainid != 42161) return;
        IAuditLivePositionManager live = IAuditLivePositionManager(PM);
        (BVCCPositionManagerValidatorV5.PoolKey memory key, uint256 info) = live.getPoolAndPositionInfo(1);
        assertEq(key.hooks, address(0));
        int24 lower = int24(uint24(info >> 8));
        int24 upper = int24(uint24(info >> 32));
        BVCCAgentWalletV5 wallet = _createAgent();
        address attacker = address(0xBAD);
        uint256 moved = 1e12;
        uint256 small = 1e9;

        deal(key.currency0, address(wallet), 1e24);
        deal(key.currency1, address(wallet), 1e18);
        _approvePermit2(address(wallet), key.currency0);
        _approvePermit2(address(wallet), key.currency1);

        uint256 fundingBefore0 = IERC20(key.currency0).balanceOf(address(wallet));
        uint256 fundingBefore1 = IERC20(key.currency1).balanceOf(address(wallet));
        uint256 sourceNft = live.nextTokenId();
        _asOwner(address(wallet), PM, 0, _mintCall(key, lower, upper, moved, address(wallet)));
        uint256 sourceFunding0 = fundingBefore0 - IERC20(key.currency0).balanceOf(address(wallet));
        uint256 sourceFunding1 = fundingBefore1 - IERC20(key.currency1).balanceOf(address(wallet));
        assertTrue(sourceFunding0 > 100 || sourceFunding1 > 100, "source NFT has material token value");
        uint256 destinationNft = live.nextTokenId();
        _asOwner(address(wallet), PM, 0, _mintCall(key, lower, upper, small, address(wallet)));
        assertEq(live.getPositionLiquidity(sourceNft), moved);
        assertEq(live.getPositionLiquidity(destinationNft), small);
        _asOwner(address(wallet), PM, 0, abi.encodeCall(IAuditLivePositionManager.approve, (attacker, destinationNft)));

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = key.currency0;
        p.allowedTokens[1] = key.currency1;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i; i < 2; i++) {
            p.tokenMaxAmounts[i] = 2;
            p.tokenDailyLimits[i] = 2;
            p.tokenTotalBudgets[i] = 2;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = PM;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        BVCCPositionManagerValidatorV5 validator = new BVCCPositionManagerValidatorV5(PM, address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(PM, address(validator));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(PM);
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, PM, bytes4(0xdd46508f), ALLOWED_DEEP))
        );

        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(sourceNft, moved, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(destinationNft, moved, type(uint128).max, type(uint128).max, bytes(""));
        params[2] = abi.encode(key.currency0);
        params[3] = abi.encode(key.currency1);
        bytes memory move = abi.encodeWithSelector(
            bytes4(0xdd46508f), abi.encode(hex"01001212", params), vm.getBlockTimestamp() + 1 days
        );
        (bool accepted,,,,) = validator.validate(AGENT, address(wallet), PM, 0, move);
        assertFalse(accepted, "remove + add in one call");
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(PM, 0, move));
        assertEq(live.getPositionLiquidity(sourceNft), moved, "source keeps its liquidity");
        assertEq(live.getPositionLiquidity(destinationNft), small, "approved NFT gains nothing");

        // Adding fresh liquidity to the approved NFT alone is rejected too.
        bytes[] memory add = new bytes[](3);
        add[0] = params[1];
        add[1] = params[2];
        add[2] = params[3];
        (accepted,,,,) = validator.validate(
            AGENT,
            address(wallet),
            PM,
            0,
            abi.encodeWithSelector(bytes4(0xdd46508f), abi.encode(hex"001212", add), vm.getBlockTimestamp() + 1 days)
        );
        assertFalse(accepted, "approved NFT");
    }

    function _approvePermit2(address payer, address token) private {
        vm.prank(payer);
        IERC20(token).approve(PERMIT2, type(uint256).max);
        vm.prank(payer);
        (bool ok,) = PERMIT2.call(
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)", token, PM, type(uint160).max, uint48(block.timestamp + 30 days)
            )
        );
        require(ok, "permit2 approval");
    }

    function _mintActions(
        BVCCPositionManagerValidatorV5.PoolKey memory key,
        int24 lower,
        int24 upper,
        uint256 amount,
        address owner
    ) private pure returns (bytes memory) {
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(key, lower, upper, amount, type(uint128).max, type(uint128).max, owner, bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        return abi.encode(hex"020d", params);
    }

    function _mintCall(
        BVCCPositionManagerValidatorV5.PoolKey memory key,
        int24 lower,
        int24 upper,
        uint256 amount,
        address owner
    ) private view returns (bytes memory) {
        return abi.encodeWithSelector(
            bytes4(0xdd46508f), _mintActions(key, lower, upper, amount, owner), block.timestamp + 1 days
        );
    }
}
