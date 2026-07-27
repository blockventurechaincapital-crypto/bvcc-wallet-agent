// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCPositionManagerValidator} from "../src/BVCCPositionManagerValidator.sol";
import {BVCCHookRegistry} from "../src/BVCCHookRegistry.sol";

/// @dev Golden vectors for the v4 PositionManager validator. Builds real
///      `modifyLiquidities` calldata and asserts the allow/deny decision.
contract BVCCPositionManagerValidatorTest is Test {
    BVCCPositionManagerValidator internal val;
    BVCCHookRegistry internal hooks;

    address internal constant PM = 0x1111111111111111111111111111111111111111;
    address internal constant WALLET = 0x2222222222222222222222222222222222222222;
    address internal constant ADMIN = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;
    address internal constant ATTACKER = 0x4444444444444444444444444444444444444444;
    address internal constant APPROVED_HOOK = 0x5555555555555555555555555555555555555555;
    address internal constant BAD_HOOK = 0x6666666666666666666666666666666666666666;
    address internal constant MSG_SENDER = address(1);
    address internal constant ADDRESS_THIS = address(2);
    address internal constant NATIVE = address(0);
    address internal constant TOKEN0 = address(0xAAAA);
    address internal constant TOKEN1 = address(0xBBBB);

    bytes4 internal constant SEL = bytes4(keccak256("modifyLiquidities(bytes,uint256)"));

    uint8 internal constant INCREASE = 0x00;
    uint8 internal constant DECREASE = 0x01;
    uint8 internal constant MINT = 0x02;
    uint8 internal constant BURN = 0x03;
    uint8 internal constant SETTLE = 0x0b;
    uint8 internal constant SETTLE_PAIR = 0x0d;
    uint8 internal constant TAKE = 0x0e;
    uint8 internal constant TAKE_PAIR = 0x11;
    uint8 internal constant CLOSE_CURRENCY = 0x12;
    uint8 internal constant SWEEP = 0x14;
    uint8 internal constant DONATE = 0x0a;
    uint8 internal constant TAKE_PORTION = 0x10;
    uint8 internal constant CLEAR_OR_TAKE = 0x13;

    function setUp() public {
        hooks = new BVCCHookRegistry(ADMIN);
        val = new BVCCPositionManagerValidator(PM, address(hooks));
        vm.startPrank(ADMIN);
        hooks.proposeHook(APPROVED_HOOK);
        vm.warp(block.timestamp + 48 hours);
        hooks.activateHook(APPROVED_HOOK);
        vm.stopPrank();
    }

    // ---- helpers -----------------------------------------------------------

    function _call(bytes memory actions, bytes[] memory params) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(SEL, abi.encode(actions, params), uint256(0));
    }

    function _mintParams(address hook, address owner) internal pure returns (bytes memory) {
        // (PoolKey{c0,c1,fee,tickSpacing,hooks}, tickLower, tickUpper, liquidity,
        //  amount0Max, amount1Max, owner, hookData) — static PoolKey inlined.
        return abi.encode(
            TOKEN0, TOKEN1, uint24(500), int24(10), hook,
            int24(-120), int24(120), uint256(1e18), uint128(1e18), uint128(1e18), owner, bytes("")
        );
    }

    function _one(uint8 a, bytes memory p) internal pure returns (bytes memory actions, bytes[] memory params) {
        actions = abi.encodePacked(a);
        params = new bytes[](1);
        params[0] = p;
    }

    function _v(uint256 value, bytes memory actions, bytes[] memory params) internal view returns (bool) {
        return val.validate(WALLET, PM, value, _call(actions, params));
    }

    // ---- MINT: hook + owner gates -----------------------------------------

    function test_mint_noHook_ownerWallet_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(address(0), WALLET));
        assertTrue(_v(0, a, p));
    }

    function test_mint_approvedHook_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(APPROVED_HOOK, WALLET));
        assertTrue(_v(0, a, p));
    }

    function test_mint_unapprovedHook_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(BAD_HOOK, WALLET));
        assertFalse(_v(0, a, p));
    }

    function test_mint_ownerNotWallet_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(address(0), ATTACKER));
        assertFalse(_v(0, a, p));
    }

    function test_mint_ownerMsgSenderSentinel_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(address(0), MSG_SENDER));
        assertTrue(_v(0, a, p));
    }

    function test_mint_frozenHook_denied() public {
        vm.prank(ADMIN);
        hooks.freezeHook(APPROVED_HOOK);
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(APPROVED_HOOK, WALLET));
        assertFalse(_v(0, a, p));
    }

    // ---- TAKE / SWEEP recipient pinning -----------------------------------

    function test_takePair_toWallet_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(TAKE_PAIR, abi.encode(TOKEN0, TOKEN1, WALLET));
        assertTrue(_v(0, a, p));
    }

    function test_takePair_toAttacker_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(TAKE_PAIR, abi.encode(TOKEN0, TOKEN1, ATTACKER));
        assertFalse(_v(0, a, p));
    }

    function test_take_toAddressThis_denied() public view {
        // ADDRESS_THIS parks funds in the PM → sweepable → denied.
        (bytes memory a, bytes[] memory p) = _one(TAKE, abi.encode(TOKEN0, ADDRESS_THIS, uint256(1)));
        assertFalse(_v(0, a, p));
    }

    function test_sweep_toWallet_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(SWEEP, abi.encode(NATIVE, WALLET));
        assertTrue(_v(0, a, p));
    }

    function test_sweep_toAttacker_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(SWEEP, abi.encode(NATIVE, ATTACKER));
        assertFalse(_v(0, a, p));
    }

    // ---- full flows --------------------------------------------------------

    function test_mint_then_settlePair_ok() public view {
        bytes memory actions = abi.encodePacked(MINT, SETTLE_PAIR);
        bytes[] memory params = new bytes[](2);
        params[0] = _mintParams(address(0), WALLET);
        params[1] = abi.encode(TOKEN0, TOKEN1);
        assertTrue(_v(0, actions, params));
    }

    function test_decrease_then_takePair_ok() public view {
        bytes memory actions = abi.encodePacked(DECREASE, TAKE_PAIR);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(123), uint256(1e17), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(TOKEN0, TOKEN1, WALLET);
        assertTrue(_v(0, actions, params));
    }

    function test_increase_burn_close_ok() public view {
        bytes memory actions = abi.encodePacked(INCREASE, BURN, CLOSE_CURRENCY);
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(uint256(1), uint256(1e17), uint128(1e18), uint128(1e18), bytes(""));
        params[1] = abi.encode(uint256(1), uint128(0), uint128(0), bytes(""));
        params[2] = abi.encode(TOKEN0);
        assertTrue(_v(0, actions, params));
    }

    // ---- native value sanity ----------------------------------------------

    function test_value_withNativeSettle_ok() public view {
        bytes memory actions = abi.encodePacked(MINT, SETTLE_PAIR);
        bytes[] memory params = new bytes[](2);
        params[0] = _mintParams(address(0), WALLET);
        params[1] = abi.encode(NATIVE, TOKEN1); // native currency0
        assertTrue(_v(1 ether, actions, params));
    }

    function test_value_withoutNativeSettle_denied() public view {
        bytes memory actions = abi.encodePacked(MINT, SETTLE_PAIR);
        bytes[] memory params = new bytes[](2);
        params[0] = _mintParams(address(0), WALLET);
        params[1] = abi.encode(TOKEN0, TOKEN1); // no native
        assertFalse(_v(1 ether, actions, params));
    }

    function test_value_singleNativeSettle_ok() public view {
        (bytes memory a, bytes[] memory p) = _one(SETTLE, abi.encode(NATIVE, uint256(1e18), true));
        assertTrue(_v(1 ether, a, p));
    }

    // ---- denied actions ----------------------------------------------------

    function test_donate_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(DONATE, abi.encode(TOKEN0, TOKEN1, uint256(1), uint256(1)));
        assertFalse(_v(0, a, p));
    }

    function test_takePortion_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(TAKE_PORTION, abi.encode(TOKEN0, WALLET, uint256(5000)));
        assertFalse(_v(0, a, p));
    }

    function test_clearOrTake_denied() public view {
        // CLEAR_OR_TAKE can forfeit a large delta to the pool → denied in the MVP.
        (bytes memory a, bytes[] memory p) = _one(CLEAR_OR_TAKE, abi.encode(TOKEN0, uint256(type(uint256).max)));
        assertFalse(_v(0, a, p));
    }

    function test_anyDeniedAction_taintsWholeBatch() public view {
        bytes memory actions = abi.encodePacked(MINT, SETTLE_PAIR, TAKE_PORTION);
        bytes[] memory params = new bytes[](3);
        params[0] = _mintParams(address(0), WALLET);
        params[1] = abi.encode(TOKEN0, TOKEN1);
        params[2] = abi.encode(TOKEN0, WALLET, uint256(1));
        assertFalse(_v(0, actions, params));
    }

    // ---- structural / fail-closed -----------------------------------------

    function test_wrongTarget_denied() public view {
        (bytes memory a, bytes[] memory p) = _one(MINT, _mintParams(address(0), WALLET));
        assertFalse(val.validate(WALLET, ATTACKER, 0, _call(a, p)));
    }

    function test_wrongSelector_denied() public view {
        bytes memory data = abi.encodeWithSelector(bytes4(0xdeadbeef), abi.encode(bytes(""), new bytes[](0)), uint256(0));
        assertFalse(val.validate(WALLET, PM, 0, data));
    }

    function test_emptyActions_denied() public view {
        assertFalse(_v(0, bytes(""), new bytes[](0)));
    }

    function test_lengthMismatch_denied() public view {
        bytes memory actions = abi.encodePacked(MINT, SETTLE_PAIR);
        bytes[] memory params = new bytes[](1);
        params[0] = _mintParams(address(0), WALLET);
        assertFalse(_v(0, actions, params));
    }

    function testFuzz_randomActionByte_onlyWhitelistPasses(uint8 b) public view {
        // A single unknown action with empty params must never pass; whitelisted
        // ones may (with wallet-safe params they do, but empty params revert-decode
        // → deny, which is the safe direction here).
        vm.assume(b != MINT && b != INCREASE && b != DECREASE && b != BURN);
        vm.assume(b != SETTLE && b != SETTLE_PAIR && b != TAKE && b != TAKE_PAIR);
        vm.assume(b != CLOSE_CURRENCY && b != SWEEP);
        (bytes memory a, bytes[] memory p) = _one(b, bytes(""));
        assertFalse(_v(0, a, p));
    }
}
