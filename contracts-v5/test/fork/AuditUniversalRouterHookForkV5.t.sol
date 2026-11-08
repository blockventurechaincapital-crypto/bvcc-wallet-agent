// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCUniversalRouterValidatorV5} from "../../src/validators/BVCCUniversalRouterValidatorV5.sol";
import {BVCCPositionManagerValidatorV5} from "../../src/validators/BVCCPositionManagerValidatorV5.sol";

interface IAuditPoolManager {
    function initialize(BVCCPositionManagerValidatorV5.PoolKey calldata key, uint160 sqrtPriceX96)
        external
        returns (int24);
}

contract AuditDrainHook {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    IERC20 public immutable TOKEN;
    address public immutable ATTACKER;
    uint256 public immutable AMOUNT;

    constructor(IERC20 token, address attacker, uint256 amount) {
        TOKEN = token;
        ATTACKER = attacker;
        AMOUNT = amount;
    }

    function beforeSwap(
        address,
        BVCCPositionManagerValidatorV5.PoolKey calldata,
        SwapParams calldata,
        bytes calldata hookData
    ) external returns (bytes4, int256, uint24) {
        address wallet = abi.decode(hookData, (address));
        require(TOKEN.transferFrom(wallet, ATTACKER, AMOUNT), "drain");
        return (this.beforeSwap.selector, 0, 0);
    }
}

contract AuditUniversalRouterHookForkV5Test is V5Base {
    struct PathKey {
        address intermediateCurrency;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bytes hookData;
    }

    struct ExactInputParams {
        address currencyIn;
        PathKey[] path;
        uint128 amountIn;
        uint128 amountOutMinimum;
    }

    address private constant UR = 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3;
    address private constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address private constant AGENT = address(0xA6E);
    address private constant ATTACKER = address(0xBAD);
    uint256 private constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        super.setUp();
    }

    struct Scenario {
        BVCCAgentWalletV5 wallet;
        MockToken hidden;
        address hook;
        BVCCUniversalRouterValidatorV5 validator;
        bytes data;
    }

    /// @dev A pool whose hook spends an old owner approval of a token the agent may not use.
    function _scenario() internal returns (Scenario memory sc) {
        BVCCAgentWalletV5 wallet = _createAgent();
        MockToken hidden = new MockToken("Hidden");
        MockToken a = new MockToken("A");
        MockToken b = new MockToken("B");
        hidden.mint(address(wallet), 1e18);
        address hook = address(uint160(0xA11C4080)); // only beforeSwap flag in low 14 bits
        AuditDrainHook implementation = new AuditDrainHook(IERC20(address(hidden)), ATTACKER, 1e18);
        vm.etch(hook, address(implementation).code);
        _asOwner(address(wallet), address(hidden), 0, abi.encodeCall(IERC20.approve, (hook, 1e18)));

        address c0 = address(a) < address(b) ? address(a) : address(b);
        address c1 = address(a) < address(b) ? address(b) : address(a);
        BVCCPositionManagerValidatorV5.PoolKey memory key =
            BVCCPositionManagerValidatorV5.PoolKey(c0, c1, 3000, 60, hook);
        IAuditPoolManager(POOL_MANAGER).initialize(key, uint160(1) << 96);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](0);
        p.tokenMaxAmounts = new uint128[](0);
        p.tokenDailyLimits = new uint128[](0);
        p.tokenTotalBudgets = new uint128[](0);
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = UR;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        BVCCUniversalRouterValidatorV5 validator = new BVCCUniversalRouterValidatorV5(UR, address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(UR, address(validator));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(UR);
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, UR, bytes4(0x3593564c), ALLOWED_DEEP))
        );

        PathKey[] memory path = new PathKey[](1);
        path[0] = PathKey(c1, 3000, 60, hook, abi.encode(address(wallet)));
        ExactInputParams memory swap = ExactInputParams(c0, path, 1, 0);
        bytes[] memory actions = new bytes[](1);
        actions[0] = abi.encode(swap);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(hex"07", actions);
        bytes memory data = abi.encodeWithSelector(bytes4(0x3593564c), hex"10", inputs, block.timestamp + 30 days);
        sc = Scenario(wallet, hidden, hook, validator, data);
    }

    /// @dev Audit V5-R3-H02. A v4 swap through a pool with an unapproved hook is rejected.
    function test_Fork_UR_V4UnapprovedHookRejected() public {
        if (block.chainid != 42161) return;
        Scenario memory sc = _scenario();
        (bool accepted,,,,) = sc.validator.validate(AGENT, address(sc.wallet), UR, 0, sc.data);
        assertFalse(accepted, "validator rejects unapproved hook path");
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        sc.wallet.executeAsAgent(_mode(), _one(UR, 0, sc.data));
        assertEq(sc.hidden.balanceOf(address(sc.wallet)), 1e18, "hidden token stays in the wallet");
        assertEq(sc.hidden.balanceOf(ATTACKER), 0, "attacker receives nothing");
    }

    /// @dev The same path is accepted once the hook is approved, and the real router then
    ///      runs that very hook: the validator reads the path as the deployed router does.
    ///      (Approving a hook is a trust decision: an approved hook runs with the wallet's
    ///      old approvals, which is why hooks go through the 48 h registry.)
    function test_Fork_UR_V4ApprovedHookPathMatchesRouter() public {
        if (block.chainid != 42161) return;
        Scenario memory sc = _scenario();
        vm.startPrank(ADMIN);
        hookRegistry.proposeHook(sc.hook);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        hookRegistry.activateHook(sc.hook);
        vm.stopPrank();
        (bool accepted,,,,) = sc.validator.validate(AGENT, address(sc.wallet), UR, 0, sc.data);
        assertTrue(accepted, "approved hook accepted");
        vm.prank(AGENT);
        sc.wallet.executeAsAgent(_mode(), _one(UR, 0, sc.data));
        assertEq(sc.hidden.balanceOf(ATTACKER), 1e18, "the router ran the hook the validator checked");
    }
}
