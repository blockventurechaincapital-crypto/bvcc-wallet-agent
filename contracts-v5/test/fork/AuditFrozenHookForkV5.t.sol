// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCPositionManagerValidatorV5} from "../../src/validators/BVCCPositionManagerValidatorV5.sol";

interface IRound4PM {
    function initialize(BVCCPositionManagerValidatorV5.PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24);
    function nextTokenId() external view returns (uint256);
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128);
}

contract FrozenRemovalDrainHook {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
    IERC20 public immutable TOKEN;
    address public immutable ATTACKER;
    uint256 public immutable AMOUNT;
    constructor(IERC20 token, address attacker, uint256 amount) {
        TOKEN = token;
        ATTACKER = attacker;
        AMOUNT = amount;
    }
    function beforeRemoveLiquidity(
        address,
        BVCCPositionManagerValidatorV5.PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata hookData
    ) external returns (bytes4) {
        require(msg.sender == 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32, "only PoolManager");
        address wallet = abi.decode(hookData, (address));
        require(TOKEN.transferFrom(wallet, ATTACKER, AMOUNT), "drain");
        return this.beforeRemoveLiquidity.selector;
    }
}

contract AuditRound4FrozenHookForkTest is V5Base {
    address constant PM = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
    address constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant AGENT = address(0xA6E);
    address constant ATTACKER = address(0xBAD);
    uint256 constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        super.setUp();
    }

    function _approvePermit2(address wallet, address token) private {
        _asOwner(wallet, token, 0, abi.encodeCall(IERC20.approve, (PERMIT2, type(uint256).max)));
        _asOwner(wallet, PERMIT2, 0, abi.encodeWithSignature(
            "approve(address,address,uint160,uint48)",
            token, PM, type(uint160).max, uint48(block.timestamp + 30 days)));
    }

    /// @dev Audit V5-R4-H01. v4 runs the hook on removals too: an agent may not remove
    ///      liquidity from a pool whose hook was frozen; the owner still can.
    function test_Fork_PM_FrozenHookAgentDecreaseRejected() public {
        if (block.chainid != 42161) return;
        BVCCAgentWalletV5 wallet = _createAgent();
        MockToken hidden = new MockToken("Hidden");
        MockToken a = new MockToken("A");
        MockToken b = new MockToken("B");
        hidden.mint(address(wallet), 1e18);
        address hook = address(uint160(0xA11C4200)); // beforeRemoveLiquidity flag
        FrozenRemovalDrainHook impl =
            new FrozenRemovalDrainHook(IERC20(address(hidden)), ATTACKER, 1e18);
        vm.etch(hook, address(impl).code);
        _asOwner(address(wallet), address(hidden), 0,
            abi.encodeCall(IERC20.approve, (hook, 1e18)));

        address c0 = address(a) < address(b) ? address(a) : address(b);
        address c1 = address(a) < address(b) ? address(b) : address(a);
        BVCCPositionManagerValidatorV5.PoolKey memory key =
            BVCCPositionManagerValidatorV5.PoolKey(c0, c1, 3000, 60, hook);
        IRound4PM(POOL_MANAGER).initialize(key, uint160(1) << 96);
        deal(c0, address(wallet), 1e24);
        deal(c1, address(wallet), 1e24);
        _approvePermit2(address(wallet), c0);
        _approvePermit2(address(wallet), c1);
        uint256 nft = IRound4PM(PM).nextTokenId();
        bytes[] memory mintParams = new bytes[](2);
        mintParams[0] = abi.encode(key, int24(-120), int24(120), uint256(1e12),
            type(uint128).max, type(uint128).max, address(wallet), bytes(""));
        mintParams[1] = abi.encode(c0, c1);
        bytes memory mint = abi.encodeWithSelector(bytes4(0xdd46508f),
            abi.encode(hex"020d", mintParams), block.timestamp + 1 days);
        _asOwner(address(wallet), PM, 0, mint);
        assertEq(IRound4PM(PM).getPositionLiquidity(nft), 1e12);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = c0; p.allowedTokens[1] = c1;
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

        BVCCPositionManagerValidatorV5 validator =
            new BVCCPositionManagerValidatorV5(PM, address(hookRegistry));
        vm.startPrank(ADMIN);
        registry.proposeValidator(PM, address(validator));
        hookRegistry.proposeHook(hook);
        vm.warp(block.timestamp + 48 hours);
        registry.activateValidator(PM);
        hookRegistry.activateHook(hook);
        hookRegistry.freezeHook(hook);
        vm.stopPrank();
        assertFalse(hookRegistry.isHookApproved(hook));
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy,
            (AGENT, PM, bytes4(0xdd46508f), ALLOWED_DEEP)));

        bytes[] memory decParams = new bytes[](3);
        decParams[0] = abi.encode(nft, uint256(1e12), uint128(0), uint128(0),
            abi.encode(address(wallet)));
        decParams[1] = abi.encode(c0);
        decParams[2] = abi.encode(c1);
        bytes memory decrease = abi.encodeWithSelector(bytes4(0xdd46508f),
            abi.encode(hex"011212", decParams), block.timestamp + 1 days);
        (bool accepted,,,,) = validator.validate(AGENT, address(wallet), PM, 0, decrease);
        assertFalse(accepted, "frozen hook rejected for an agent decrease");
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(PM, 0, decrease));
        assertEq(hidden.balanceOf(address(wallet)), 1e18, "hidden token stays");
        assertEq(IRound4PM(PM).getPositionLiquidity(nft), 1e12, "position untouched");

        // Leaving the frozen pool stays possible for the owner (here the hook still runs:
        // that is the owner's own decision).
        _asOwner(address(wallet), PM, 0, decrease);
        assertEq(IRound4PM(PM).getPositionLiquidity(nft), 0, "owner left the pool");
    }
}
