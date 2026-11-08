// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {BVCCUniversalRouterValidatorV5} from "../src/validators/BVCCUniversalRouterValidatorV5.sol";
import {BVCCPositionManagerValidatorV5} from "../src/validators/BVCCPositionManagerValidatorV5.sol";
import {BVCCAaveV3ValidatorV5} from "../src/validators/BVCCAaveV3ValidatorV5.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev PositionManager double: answers the pool key of a position.
contract MockPositionManager {
    BVCCPositionManagerValidatorV5.PoolKey internal _key;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;

    function setOwner(uint256 tokenId, address owner) external {
        ownerOf[tokenId] = owner;
    }

    function setApproved(uint256 tokenId, address operator) external {
        getApproved[tokenId] = operator;
    }

    function setKey(BVCCPositionManagerValidatorV5.PoolKey memory key) external {
        _key = key;
    }

    function getPoolAndPositionInfo(uint256)
        external
        view
        returns (BVCCPositionManagerValidatorV5.PoolKey memory, uint256)
    {
        return (_key, 0);
    }
}

contract ValidatorsV5Test is V5Base {
    address internal constant ROUTER = address(0x7777);
    address internal constant PM = address(0x8888);
    address internal constant W = address(0x1234);
    address internal constant TA = address(0xAAAA);
    address internal constant TB = address(0xBBBB);
    address internal constant TC = address(0xCCCC);

    BVCCUniversalRouterValidatorV5 internal ur;
    BVCCPositionManagerValidatorV5 internal pm;
    BVCCAaveV3ValidatorV5 internal aave;
    MockLendingPool internal pool;

    function setUp() public override {
        super.setUp();
        ur = new BVCCUniversalRouterValidatorV5(ROUTER, address(hookRegistry));
        pm = new BVCCPositionManagerValidatorV5(PM, address(hookRegistry));
        pool = new MockLendingPool();
        aave = new BVCCAaveV3ValidatorV5(address(pool));
    }

    // ---------------------------------------------------------------- Universal Router

    function _urCall(bytes memory commands, bytes[] memory inputs) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(0x3593564c), commands, inputs, uint256(0));
    }

    function _v3Input(address recipient, bytes memory path) internal pure returns (bytes memory) {
        return abi.encode(recipient, uint256(1e18), uint256(1), path, true);
    }

    function test_UR_V3SwapDeclaresPathTokens() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = _v3Input(W, abi.encodePacked(TA, uint24(500), TB, uint24(3000), TC));
        (bool ok, address[] memory tokens,, bool post, bool inflow) =
            ur.validate(address(0), W, ROUTER, 0, _urCall(hex"00", inputs));
        assertTrue(ok);
        assertFalse(post);
        assertFalse(inflow, "a swap output is not charged");
        assertEq(tokens.length, 3);
        assertEq(tokens[0], TA);
        assertEq(tokens[1], TB);
        assertEq(tokens[2], TC);
    }

    function test_UR_DeniesForeignRecipientBridgeAndValue() public view {
        bytes[] memory inputs = new bytes[](1);
        bytes memory path = abi.encodePacked(TA, uint24(500), TB);
        inputs[0] = _v3Input(address(0xBAD), path);
        (bool ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _urCall(hex"00", inputs));
        assertFalse(ok, "foreign recipient");

        inputs[0] = _v3Input(W, path);
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _urCall(hex"40", inputs));
        assertFalse(ok, "0x40 cross-chain deposit");
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _urCall(hex"80", inputs));
        assertFalse(ok, "allow-revert flag");
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 1, _urCall(hex"00", inputs));
        assertFalse(ok, "native value");
        (ok,,,,) = ur.validate(address(0), W, address(0x9999), 0, _urCall(hex"00", inputs));
        assertFalse(ok, "other router");
    }

    function _v4Swap(address currencyIn, address intermediate, address hook) internal pure returns (bytes memory) {
        BVCCUniversalRouterValidatorV5.PathKey[] memory path = new BVCCUniversalRouterValidatorV5.PathKey[](1);
        path[0] = BVCCUniversalRouterValidatorV5.PathKey(intermediate, 3000, 60, hook, abi.encode(W));
        return abi.encode(BVCCUniversalRouterValidatorV5.ExactInputParams(currencyIn, path, 1e18, 1));
    }

    function _v4SwapCall(bytes memory swap) internal pure returns (bytes memory) {
        bytes[] memory params = new bytes[](3);
        params[0] = swap;
        params[1] = abi.encode(TA, uint256(1e18), true);
        params[2] = abi.encode(TB, W, uint256(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(hex"070b0e", params);
        return _urCall(hex"10", inputs);
    }

    /// @dev Audit V5-R3-H02: a v4 swap hop runs its pool hook, so every hop's hook must be
    ///      none or approved, and every path currency is measured.
    function test_UR_V4SwapChecksHooksAndDeclaresPath() public {
        address hook = address(0x4080);
        (bool ok, address[] memory tokens,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(TA, TC, address(0))));
        assertTrue(ok, "no hook");
        assertEq(tokens.length, 3, "TA, TC, TB");
        assertEq(tokens[1], TC, "intermediate currency declared");

        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(TA, TB, hook)));
        assertFalse(ok, "hook never approved");

        vm.startPrank(ADMIN);
        hookRegistry.proposeHook(hook);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        hookRegistry.activateHook(hook);
        vm.stopPrank();
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(TA, TB, hook)));
        assertTrue(ok, "hook approved");

        vm.prank(ADMIN);
        hookRegistry.freezeHook(hook);
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(TA, TB, hook)));
        assertFalse(ok, "hook frozen");

        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(address(0), TB, address(0))));
        assertFalse(ok, "native input");
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _v4SwapCall(_v4Swap(TA, address(0), address(0))));
        assertFalse(ok, "native hop");
    }

    function test_UR_V4SwapDeclaresSettleAndTake() public view {
        bytes memory actions = hex"070b0e";
        bytes[] memory params = new bytes[](3);
        params[0] = _v4Swap(TA, TB, address(0));
        params[1] = abi.encode(TA, uint256(1e18), true);
        params[2] = abi.encode(TB, W, uint256(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        (bool ok, address[] memory tokens,,,) = ur.validate(address(0), W, ROUTER, 0, _urCall(hex"10", inputs));
        assertTrue(ok);
        assertEq(tokens.length, 2);
        params[2] = abi.encode(TB, address(0xBAD), uint256(0));
        inputs[0] = abi.encode(actions, params);
        (ok,,,,) = ur.validate(address(0), W, ROUTER, 0, _urCall(hex"10", inputs));
        assertFalse(ok);
    }

    function test_UR_ConstructorRejectsZero() public {
        vm.expectRevert(BVCCUniversalRouterValidatorV5.ZeroAddress.selector);
        new BVCCUniversalRouterValidatorV5(address(0), address(hookRegistry));
        vm.expectRevert(BVCCUniversalRouterValidatorV5.ZeroAddress.selector);
        new BVCCUniversalRouterValidatorV5(ROUTER, address(0));
    }

    // ---------------------------------------------------------------- PositionManager

    function _mintParams(address hook, address owner) internal pure returns (bytes memory) {
        BVCCPositionManagerValidatorV5.PoolKey memory key =
            BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, hook);
        return abi.encode(key, int24(-100), int24(100), uint256(1), uint128(1), uint128(1), owner, bytes(""));
    }

    function _pmCall(bytes memory actions, bytes[] memory params) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(0xdd46508f), abi.encode(actions, params), uint256(0));
    }

    function test_PM_MintDeclaresCurrencies() public view {
        bytes[] memory params = new bytes[](2);
        params[0] = _mintParams(address(0), W);
        params[1] = abi.encode(TA, TB);
        (bool ok, address[] memory tokens,,,) = pm.validate(address(0), W, PM, 0, _pmCall(hex"020d", params));
        assertTrue(ok);
        assertEq(tokens.length, 2);
    }

    function test_PM_DeniesForeignOwnerAndUnapprovedHook() public {
        bytes[] memory params = new bytes[](1);
        params[0] = _mintParams(address(0), address(0xBAD));
        (bool ok,,,,) = pm.validate(address(0), W, PM, 0, _pmCall(hex"02", params));
        assertFalse(ok, "owner");
        params[0] = _mintParams(address(0x4007), W);
        (ok,,,,) = pm.validate(address(0), W, PM, 0, _pmCall(hex"02", params));
        assertFalse(ok, "hook not approved");
        vm.startPrank(ADMIN);
        hookRegistry.proposeHook(address(0x4007));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        hookRegistry.activateHook(address(0x4007));
        vm.stopPrank();
        (ok,,,,) = pm.validate(address(0), W, PM, 0, _pmCall(hex"02", params));
        assertTrue(ok, "hook approved");
    }

    /// @dev Audit V5-H-04: whatever a PositionManager call brings in comes out of positions.
    function test_PM_ChargesInflow() public {
        MockPositionManager real = new MockPositionManager();
        BVCCPositionManagerValidatorV5 v = new BVCCPositionManagerValidatorV5(address(real), address(hookRegistry));
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, address(0)));
        real.setOwner(1, W);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(1), uint256(1), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(TA, TB, W);
        (bool ok, address[] memory tokens,,, bool inflow) =
            v.validate(address(0), W, address(real), 0, _pmCall(hex"0111", params));
        assertTrue(ok);
        assertEq(tokens.length, 2);
        assertTrue(inflow);

        // The position's pool currencies are declared even without a TAKE naming them.
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TC, TB, 500, 10, address(0)));
        (ok, tokens,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"0111", params));
        assertTrue(ok);
        assertEq(tokens.length, 3, "TC, TB from the position, TA from the take");
        assertEq(tokens[0], TC);
    }

    /// @dev Audit V5-M-03 / V5-R4-H01: adding to or removing from an existing position
    ///      checks its pool hook; after a freeze only the owner can leave the pool.
    /// @dev Red team RT-01 / round 5: DECREASE and BURN of the same position in one call,
    ///      in both orders. Allowed for the wallet's own position, rejected for a foreign
    ///      one that approved the wallet, whatever the order.
    function test_PM_DecreaseAndBurnSamePositionBothOrders() public {
        MockPositionManager real = new MockPositionManager();
        BVCCPositionManagerValidatorV5 v = new BVCCPositionManagerValidatorV5(address(real), address(hookRegistry));
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, address(0)));
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(uint256(1), uint256(1), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(uint256(1), uint128(0), uint128(0), bytes(""));
        params[2] = abi.encode(TA);
        params[3] = abi.encode(TB);
        bytes[] memory reversed = new bytes[](4);
        reversed[0] = params[1];
        reversed[1] = params[0];
        reversed[2] = params[2];
        reversed[3] = params[3];
        bytes memory decreaseThenBurn = _pmCall(hex"01031212", params);
        bytes memory burnThenDecrease = _pmCall(hex"03011212", reversed);

        real.setOwner(1, W);
        (bool ok,,,,) = v.validate(address(0), W, address(real), 0, decreaseThenBurn);
        assertTrue(ok, "own position: decrease then burn");
        (ok,,,,) = v.validate(address(0), W, address(real), 0, burnThenDecrease);
        assertTrue(ok, "own position: burn then decrease (the PositionManager itself rejects it)");

        real.setOwner(1, address(0xF00));
        real.setApproved(1, W);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, decreaseThenBurn);
        assertFalse(ok, "foreign position: decrease then burn");
        (ok,,,,) = v.validate(address(0), W, address(real), 0, burnThenDecrease);
        assertFalse(ok, "foreign position: burn then decrease");
    }

    function test_PM_IncreaseChecksHook() public {
        MockPositionManager real = new MockPositionManager();
        BVCCPositionManagerValidatorV5 v = new BVCCPositionManagerValidatorV5(address(real), address(hookRegistry));
        address hook = address(0x4007);
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, hook));
        real.setOwner(1, W);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(1), uint256(1), uint128(1), uint128(1), bytes(""));
        params[1] = abi.encode(TA, TB);
        bytes memory increase = _pmCall(hex"000d", params);
        (bool ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertFalse(ok, "hook never approved");

        vm.startPrank(ADMIN);
        hookRegistry.proposeHook(hook);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        hookRegistry.activateHook(hook);
        vm.stopPrank();
        (ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertTrue(ok, "hook approved");

        vm.prank(ADMIN);
        hookRegistry.freezeHook(hook);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertFalse(ok, "hook frozen");

        params[0] = abi.encode(uint256(1), uint256(1), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(TA, TB, W);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"0111", params));
        assertFalse(ok, "no agent decrease with a frozen hook either (audit V5-R4-H01)");

        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, address(0)));
        params[0] = abi.encode(uint256(1), uint256(1), uint128(1), uint128(1), bytes(""));
        params[1] = abi.encode(TA, TB);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertTrue(ok, "no hook");
    }

    /// @dev Audit V5-R2-H01: the PositionManager accepts approved operators, so liquidity
    ///      may only be added to a position the wallet owns.
    function test_PM_IncreaseNeedsWalletOwnedPosition() public {
        MockPositionManager real = new MockPositionManager();
        BVCCPositionManagerValidatorV5 v = new BVCCPositionManagerValidatorV5(address(real), address(hookRegistry));
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, address(0)));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(1), uint256(1), uint128(1), uint128(1), bytes(""));
        params[1] = abi.encode(TA, TB);
        bytes memory increase = _pmCall(hex"000d", params);

        real.setOwner(1, address(0xBAD));
        (bool ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertFalse(ok, "foreign position");

        real.setOwner(1, W);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertTrue(ok, "wallet position");

        real.setApproved(1, address(0xBAD));
        (ok,,,,) = v.validate(address(0), W, address(real), 0, increase);
        assertFalse(ok, "wallet position approved to someone else (audit V5-R3-H01)");
    }

    /// @dev Audit V5-R3-H01: taking liquidity out and putting it in within one call nets
    ///      inside the PositionManager, so it is denied; each part alone stays allowed.
    function test_PM_NoRemoveAndAddInOneCall() public {
        MockPositionManager real = new MockPositionManager();
        BVCCPositionManagerValidatorV5 v = new BVCCPositionManagerValidatorV5(address(real), address(hookRegistry));
        real.setKey(BVCCPositionManagerValidatorV5.PoolKey(TA, TB, 500, 10, address(0)));
        real.setOwner(1, W);
        real.setOwner(2, W);
        bytes memory dec1 = abi.encode(uint256(1), uint256(1), uint128(0), uint128(0), bytes(""));
        bytes memory inc2 = abi.encode(uint256(2), uint256(1), uint128(1), uint128(1), bytes(""));
        bytes memory closeA = abi.encode(TA);
        bytes memory closeB = abi.encode(TB);

        bytes[] memory params = new bytes[](4);
        params[0] = dec1;
        params[1] = inc2;
        params[2] = closeA;
        params[3] = closeB;
        (bool ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"01001212", params));
        assertFalse(ok, "decrease + increase");

        params[0] = abi.encode(uint256(1), uint128(0), uint128(0), bytes(""));
        (ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"03001212", params));
        assertFalse(ok, "burn + increase");

        params[0] = dec1;
        params[1] = _mintParams(address(0), W);
        (ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"01021212", params));
        assertFalse(ok, "decrease + mint");

        bytes[] memory one = new bytes[](3);
        one[0] = dec1;
        one[1] = closeA;
        one[2] = closeB;
        (ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"011212", one));
        assertTrue(ok, "decrease alone");
        one[0] = inc2;
        (ok,,,,) = v.validate(address(0), W, address(real), 0, _pmCall(hex"001212", one));
        assertTrue(ok, "increase alone");
    }

    function test_PM_DeniesUnknownActionsAndStrandedValue() public view {
        bytes[] memory params = new bytes[](1);
        params[0] = abi.encode(TA, W, uint256(1));
        (bool ok,,,,) = pm.validate(address(0), W, PM, 0, _pmCall(hex"0f", params));
        assertFalse(ok, "TAKE_ALL style action");
        (ok,,,,) = pm.validate(address(0), W, PM, 1, _pmCall(hex"0e", params));
        assertFalse(ok, "value without native settle");
    }

    // ---------------------------------------------------------------- Aave v3

    function test_Aave_BorrowCostAndPostCheck() public view {
        bytes memory data = abi.encodeWithSelector(bytes4(0xa415bcad), TA, uint256(5e18), uint256(2), uint16(0), W);
        (bool ok, address[] memory tokens, IBVCCValidatorV5.Cost[] memory costs, bool post, bool inflow) =
            aave.validate(address(0), W, address(pool), 0, data);
        assertTrue(ok);
        assertTrue(post);
        assertEq(tokens[0], TA);
        assertEq(costs[0].token, TA);
        assertEq(costs[0].amount, 5e18);
        assertFalse(inflow, "a borrow is a cost, not an inflow");
    }

    /// @dev Audit V5-H-04: what a withdrawal brings in is charged.
    function test_Aave_WithdrawChargesInflow() public view {
        bytes memory data = abi.encodeWithSelector(bytes4(0x69328dec), TA, uint256(1e18), W);
        (bool ok, address[] memory tokens,,, bool inflow) = aave.validate(address(0), W, address(pool), 0, data);
        assertTrue(ok);
        assertEq(tokens[0], TA);
        assertTrue(inflow);
        data = abi.encodeWithSelector(bytes4(0x617ba037), TA, uint256(1), W, uint16(0));
        (ok,,,, inflow) = aave.validate(address(0), W, address(pool), 0, data);
        assertTrue(ok);
        assertFalse(inflow, "supply");
    }

    function test_Aave_DeniesOtherBeneficiaryStableRateAndValue() public view {
        bytes memory data =
            abi.encodeWithSelector(bytes4(0xa415bcad), TA, uint256(5e18), uint256(2), uint16(0), address(0xBAD));
        (bool ok,,,,) = aave.validate(address(0), W, address(pool), 0, data);
        assertFalse(ok);
        data = abi.encodeWithSelector(bytes4(0xa415bcad), TA, uint256(5e18), uint256(1), uint16(0), W);
        (ok,,,,) = aave.validate(address(0), W, address(pool), 0, data);
        assertFalse(ok, "stable rate");
        data = abi.encodeWithSelector(bytes4(0x69328dec), TA, uint256(1), address(0xBAD));
        (ok,,,,) = aave.validate(address(0), W, address(pool), 0, data);
        assertFalse(ok, "withdraw elsewhere");
        data = abi.encodeWithSelector(bytes4(0x617ba037), TA, uint256(1), W, uint16(0));
        (ok,,,,) = aave.validate(address(0), W, address(pool), 1, data);
        assertFalse(ok, "value");
        (ok,,,,) = aave.validate(address(0), W, address(pool), 0, abi.encodeWithSelector(bytes4(0xc04a8a10), W, 1));
        assertFalse(ok, "credit delegation");
    }

    function test_Aave_HealthFactorMinimum() public {
        assertTrue(aave.validateAfter(address(0), W, address(pool), ""), "no debt");
        pool.setHealth(1, 1.2e18);
        assertTrue(aave.validateAfter(address(0), W, address(pool), ""));
        pool.setHealth(1, 1.2e18 - 1);
        assertFalse(aave.validateAfter(address(0), W, address(pool), ""));
    }

    // ---------------------------------------------------------------- registry

    function test_Registry_TimelockFreezeAndOwnership() public {
        MockValidator v = new MockValidator();
        vm.prank(address(0xBAD));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(0xBAD)));
        registry.proposeValidator(ROUTER, address(v));

        vm.startPrank(ADMIN);
        registry.proposeValidator(ROUTER, address(v));
        vm.expectRevert(BVCCValidatorRegistryV5.TimelockActive.selector);
        registry.activateValidator(ROUTER);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        registry.activateValidator(ROUTER);
        (bool ok,,,,) = registry.validate(address(0), W, ROUTER, 0, "");
        assertTrue(ok);

        registry.proposeValidator(ROUTER, address(ur));
        registry.freezeValidator(ROUTER);
        (ok,,,,) = registry.validate(address(0), W, ROUTER, 0, "");
        assertFalse(ok, "frozen");
        assertEq(registry.pendingValidator(ROUTER), address(0), "freeze cancels the pending proposal");
        assertFalse(registry.validateAfter(address(0), W, ROUTER, ""));

        registry.transferOwnership(address(0xBEEF));
        vm.expectRevert();
        registry.renounceOwnership();
        vm.stopPrank();
        vm.prank(address(0xBEEF));
        registry.acceptOwnership();
        assertEq(registry.owner(), address(0xBEEF));
    }
}
