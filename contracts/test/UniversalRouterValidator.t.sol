// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCUniversalRouterValidator} from "../src/BVCCUniversalRouterValidator.sol";
import {BVCCValidatorRegistry} from "../src/BVCCValidatorRegistry.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/// @dev No-op Universal Router stand-in so the wallet's Case-3 call succeeds once
///      validation passes (the validator gates BEFORE this is ever reached).
contract MockUR {
    uint256 public calls;
    function execute(bytes calldata, bytes[] calldata, uint256) external payable { calls++; }
}

contract UniversalRouterValidatorTest is Test {
    BVCCUniversalRouterValidator val;

    address constant MSG_SENDER = address(1);
    address constant ADDRESS_THIS = address(2);
    address wallet = makeAddr("wallet");
    address attacker = makeAddr("attacker");
    address tokenIn = makeAddr("tokenIn");
    address tokenOut = makeAddr("tokenOut");
    address UR = makeAddr("universalRouter");

    // command bytes
    uint8 constant C_V3_IN  = 0x00;
    uint8 constant C_V3_OUT = 0x01;
    uint8 constant C_SWEEP  = 0x04;
    uint8 constant C_TRANSFER = 0x05;
    uint8 constant C_PAY_PORTION = 0x06;
    uint8 constant C_WRAP   = 0x0b;
    uint8 constant C_UNWRAP = 0x0c;
    uint8 constant C_V4     = 0x10;

    // Reference model of the deployed UR dispatcher (empirically confirmed on the
    // Arbitrum router 0x8b844f…1e6b): type = byte & 0x7f, allow-revert = byte & 0x80.
    uint8 constant ROUTER_MASK = 0x7f;
    uint8 constant ROUTER_FLAG = 0x80;

    function setUp() public {
        val = new BVCCUniversalRouterValidator(UR);
    }

    // ------------------------------------------------------------------
    // UR calldata builders (mirror the BVCC SDK layout)
    // ------------------------------------------------------------------

    function _execCd(bytes memory commands, bytes[] memory inputs) internal view returns (bytes memory) {
        return abi.encodeWithSignature("execute(bytes,bytes[],uint256)", commands, inputs, block.timestamp + 1200);
    }

    function _v3Input(address recipient) internal view returns (bytes memory) {
        bytes memory path = abi.encodePacked(tokenIn, uint24(3000), tokenOut);
        return abi.encode(recipient, uint256(1e18), uint256(1), path, true);
    }

    function _urV3(uint8 cmd, address recipient) internal view returns (bytes memory) {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = _v3Input(recipient);
        return _execCd(abi.encodePacked(cmd), inputs);
    }

    function _urV4(uint8[] memory actions, address takeRecipient) internal view returns (bytes memory) {
        bytes memory act = "";
        for (uint256 i = 0; i < actions.length; i++) act = abi.encodePacked(act, actions[i]);
        bytes[] memory params = new bytes[](actions.length);
        for (uint256 i = 0; i < actions.length; i++) {
            params[i] = actions[i] == 0x0e
                ? abi.encode(tokenOut, takeRecipient, uint256(0)) // TAKE
                : bytes(hex"00");                                 // SWAP/SETTLE ignored
        }
        bytes memory v4Input = abi.encode(act, params);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = v4Input;
        return _execCd(abi.encodePacked(C_V4), inputs);
    }

    function _v4Default(address takeRecipient) internal view returns (bytes memory) {
        uint8[] memory a = new uint8[](3);
        a[0] = 0x07; a[1] = 0x0b; a[2] = 0x0e; // SWAP, SETTLE, TAKE
        return _urV4(a, takeRecipient);
    }

    function _check(bytes memory cd) internal view returns (bool) {
        return val.validate(wallet, UR, 0, cd);
    }

    // external wrappers for try/catch fuzzing
    function checkV3(uint8 cmd, address r) external view returns (bool) { return _check(_urV3(cmd, r)); }
    function callValidate(bytes calldata cd) external view returns (bool) { return val.validate(wallet, UR, 0, cd); }

    // ==================================================================
    // POSITIVE — the SDK corpus must pass
    // ==================================================================

    function test_V3_RecipientWallet_Ok() public view { assertTrue(_check(_urV3(C_V3_IN, wallet))); }
    function test_V3_RecipientMsgSender_Ok() public view { assertTrue(_check(_urV3(C_V3_IN, MSG_SENDER))); }
    function test_V3_ExactOut_RecipientWallet_Ok() public view { assertTrue(_check(_urV3(C_V3_OUT, wallet))); }
    function test_V4_TakeWallet_Ok() public view { assertTrue(_check(_v4Default(wallet))); }
    function test_V4_TakeMsgSender_Ok() public view { assertTrue(_check(_v4Default(MSG_SENDER))); }

    function test_MultiV3_AllWallet_Ok() public view {
        bytes[] memory inputs = new bytes[](2);
        inputs[0] = _v3Input(wallet);
        inputs[1] = _v3Input(MSG_SENDER);
        assertTrue(_check(_execCd(abi.encodePacked(C_V3_IN, C_V3_IN), inputs)));
    }

    // ==================================================================
    // NEGATIVE — recipient theft
    // ==================================================================

    function test_V3_RecipientAttacker_Denied() public view { assertFalse(_check(_urV3(C_V3_IN, attacker))); }
    function test_V3_ExactOut_RecipientAttacker_Denied() public view { assertFalse(_check(_urV3(C_V3_OUT, attacker))); }
    function test_V3_RecipientAddressThis_Denied() public view {
        assertFalse(_check(_urV3(C_V3_IN, ADDRESS_THIS)), "ADDRESS_THIS (native-out) denied: sweepable");
    }
    function test_V4_TakeAttacker_Denied() public view { assertFalse(_check(_v4Default(attacker))); }
    function test_V4_TakeAddressThis_Denied() public view { assertFalse(_check(_v4Default(ADDRESS_THIS))); }

    function test_MultiV3_OneAttacker_Denied() public view {
        bytes[] memory inputs = new bytes[](2);
        inputs[0] = _v3Input(wallet);
        inputs[1] = _v3Input(attacker); // one bad leg taints the whole call
        assertFalse(_check(_execCd(abi.encodePacked(C_V3_IN, C_V3_IN), inputs)));
    }

    // ==================================================================
    // NEGATIVE — non-whitelisted commands
    // ==================================================================

    function test_Sweep_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(tokenOut, attacker, uint256(0));
        assertFalse(_check(_execCd(abi.encodePacked(C_SWEEP), inputs)));
    }
    function test_Transfer_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(tokenOut, attacker, uint256(1e18));
        assertFalse(_check(_execCd(abi.encodePacked(C_TRANSFER), inputs)));
    }
    function test_PayPortion_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(tokenOut, attacker, uint256(100));
        assertFalse(_check(_execCd(abi.encodePacked(C_PAY_PORTION), inputs)));
    }
    function test_WrapEth_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(ADDRESS_THIS, uint256(1e18));
        assertFalse(_check(_execCd(abi.encodePacked(C_WRAP), inputs)), "native-in wrap out of MVP scope");
    }
    function test_UnwrapWeth_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(wallet, uint256(1e18));
        assertFalse(_check(_execCd(abi.encodePacked(C_UNWRAP), inputs)), "native-out unwrap out of MVP scope");
    }

    // ==================================================================
    // NEGATIVE — mask / reserved / external-integration command bytes
    //            (the bug this validator was rewritten to close)
    // ==================================================================

    /// @dev On the deployed router 0x40 (ACROSS_V4_DEPOSIT_V3) is its OWN command,
    ///      NOT an alias of 0x00. A 0x3f mask would have accepted it as a v3 swap.
    function test_Cmd0x40_AcrossDeposit_Denied() public view { assertFalse(_check(_urV3(0x40, wallet))); }
    function test_Cmd0x41_Denied() public view { assertFalse(_check(_urV3(0x41, wallet))); }
    function test_Cmd0x7f_Denied() public view { assertFalse(_check(_urV3(0x7f, wallet))); }
    function test_Cmd0x80_AllowRevertFlagOnV3_Denied() public view { assertFalse(_check(_urV3(0x80, wallet))); }
    function test_Cmd0xc0_Denied() public view { assertFalse(_check(_urV3(0xc0, wallet))); }

    // ==================================================================
    // NEGATIVE — v4 action tampering
    // ==================================================================

    function test_V4_UnknownAction_Denied() public view {
        uint8[] memory a = new uint8[](3);
        a[0] = 0x07; a[1] = 0x0b; a[2] = 0x11; // TAKE_PORTION instead of TAKE
        assertFalse(_check(_urV4(a, wallet)));
    }
    function test_V4_ExtraTakeToAttacker_Denied() public view {
        bytes memory act = abi.encodePacked(uint8(0x07), uint8(0x0b), uint8(0x0e), uint8(0x0e));
        bytes[] memory params = new bytes[](4);
        params[0] = hex"00"; params[1] = hex"00";
        params[2] = abi.encode(tokenOut, wallet, uint256(0));
        params[3] = abi.encode(tokenOut, attacker, uint256(0));
        bytes memory v4Input = abi.encode(act, params);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = v4Input;
        assertFalse(_check(_execCd(abi.encodePacked(C_V4), inputs)));
    }
    function test_V4_ActionsParamsLengthMismatch_Denied() public view {
        bytes memory act = abi.encodePacked(uint8(0x07), uint8(0x0e)); // 2 actions
        bytes[] memory params = new bytes[](1);                        // 1 param
        params[0] = hex"00";
        bytes memory v4Input = abi.encode(act, params);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = v4Input;
        assertFalse(_check(_execCd(abi.encodePacked(C_V4), inputs)));
    }
    function test_V4_EmptyActions_Denied() public view {
        bytes memory v4Input = abi.encode(bytes(""), new bytes[](0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = v4Input;
        assertFalse(_check(_execCd(abi.encodePacked(C_V4), inputs)));
    }

    // ==================================================================
    // NEGATIVE — structural
    // ==================================================================

    function test_EmptyCommands_Denied() public view {
        assertFalse(_check(_execCd("", new bytes[](0))), "empty execute has no useful op - deny");
    }
    function test_CommandsInputsLengthMismatch_Denied() public view {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = _v3Input(wallet);
        assertFalse(_check(_execCd(abi.encodePacked(C_V3_IN, C_V3_IN), inputs)));
    }
    function test_TargetNotBoundRouter_Denied() public view {
        assertFalse(val.validate(wallet, attacker, 0, _urV3(C_V3_IN, wallet)), "validator is bound to one router");
    }
    function test_WrongSelector_Denied() public view {
        bytes memory cd = abi.encodeWithSignature("notExecute(bytes,bytes[],uint256)", "", new bytes[](0), uint256(0));
        assertFalse(_check(cd));
    }
    function test_TooShort_Denied() public view {
        assertFalse(_check(hex"1234"));
    }
    function test_MalformedBody_Reverts() public {
        bytes memory cd = abi.encodePacked(bytes4(keccak256("execute(bytes,bytes[],uint256)")), hex"deadbeef");
        vm.expectRevert();
        this.callValidate(cd);
    }

    // ==================================================================
    // GOLDEN — exact calldata the @bvcc/agent-sdk currently emits.
    //
    // These byte strings are produced by buildUniversalRouterSwap (v3) and
    // buildV4SwapExactIn (v4) for a fixed input set (wallet 0x…cafe, tokenIn 0x…a1,
    // tokenOut 0x…b2, amountIn 1e6, min 990000, fee 3000, tickSpacing 60, deadline
    // 1893456000). The SDK side locks the same vectors in
    // bvcc-agent-sdk/test/urEncoding.golden.test.ts. If the SDK encoding or the UR
    // version changes, that TS test fails first; regenerating these vectors then
    // FORCES a review here (do the new bytes still validate as wallet-pinned?).
    // ==================================================================

    address constant CAFE = address(0xCAFE); // = 0x…cafe, the golden recipient

    function test_Golden_SdkV3_Accepted() public view {
        bytes memory v3 = hex"3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000070dbd88000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000cafe00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000f1b3000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002b00000000000000000000000000000000000000a1000bb800000000000000000000000000000000000000b2000000000000000000000000000000000000000000";
        assertTrue(val.validate(CAFE, UR, 0, v3), "current SDK v3 UR calldata must validate (recipient pinned to wallet)");
    }

    function test_Golden_SdkV4_Accepted() public view {
        bytes memory v4 = hex"3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000070dbd880000000000000000000000000000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003070b0e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000f1b300000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000b20000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000000000000000000000000000000000000000003c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000b2000000000000000000000000000000000000000000000000000000000000cafe0000000000000000000000000000000000000000000000000000000000000000";
        assertTrue(val.validate(CAFE, UR, 0, v4), "current SDK v4 UR calldata must validate (TAKE pinned to wallet)");
    }

    function test_Golden_SdkV4Native_Accepted() public view {
        // Native-output swap (buildV4SwapExactIn nativeOut, fee 500 / tickSpacing 10):
        // output currency = address(0), the TAKE sends ETH straight to the wallet, and
        // there is NO UNWRAP_WETH command. Must validate — native output stays wallet-
        // pinned, unlike the WETH+unwrap route (which parks output in the router).
        bytes memory v4n = hex"3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000070dbd880000000000000000000000000000000000000000000000000000000000000000110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003070b0e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a1000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000f1b3000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000cafe0000000000000000000000000000000000000000000000000000000000000000";
        assertTrue(val.validate(CAFE, UR, 0, v4n), "SDK v4 native-out calldata must validate (TAKE native to wallet)");
    }

    // ==================================================================
    // FUZZ — validator vs the real router, over all 256 command bytes
    // ==================================================================

    function testFuzz_V3_RecipientPinnedExactly(address r) public view {
        bool expected = (r == wallet || r == MSG_SENDER);
        assertEq(_check(_urV3(C_V3_IN, r)), expected);
    }

    function testFuzz_V4_TakeRecipientPinnedExactly(address r) public view {
        bool expected = (r == wallet || r == MSG_SENDER);
        assertEq(_check(_v4Default(r)), expected);
    }

    /// @dev For every one of the 256 command bytes, the validator must never accept a
    ///      byte the bound router would dispatch to anything other than exactly the
    ///      intended swap (no masking aliases, no allow-revert). Compares against a
    ///      reference model of the router dispatcher (mask 0x7f, flag 0x80).
    function testFuzz_ValidatorMatchesRouter(uint8 b) public {
        uint8 routerType = b & ROUTER_MASK;
        bool routerFlag = (b & ROUTER_FLAG) != 0;
        bool routerTreatsAsSwap =
            !routerFlag && (routerType == C_V3_IN || routerType == C_V3_OUT || routerType == C_V4);

        bool accepted;
        if (b == C_V4) {
            accepted = _check(_v4Default(wallet));
        } else {
            try this.checkV3(b, wallet) returns (bool ok) { accepted = ok; } catch { accepted = false; }
        }

        if (accepted) {
            assertTrue(routerTreatsAsSwap, "validator accepted a byte the router dispatches elsewhere");
            assertEq(uint256(routerType), uint256(b), "accepted byte must equal its router type (no alias)");
        }
    }

    function testFuzz_GarbageNeverTrue(bytes calldata cd) public view {
        try this.callValidate(cd) returns (bool ok) {
            assertFalse(ok, "arbitrary calldata must never validate true");
        } catch {
            // revert = deny (fail-closed) — acceptable
        }
    }

    // ==================================================================
    // INTEGRATION — wallet → registry → validator, end to end
    // ==================================================================

    address constant REGISTRY = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2;
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    function _wireWalletWithValidator() internal returns (BVCCAgentWalletV4 w, MockUR ur, address agent, BVCCUniversalRouterValidator v) {
        w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        ur = new MockUR();
        v = new BVCCUniversalRouterValidator(address(ur)); // bound to THIS router
        agent = makeAddr("agentE2E");

        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        vm.etch(REGISTRY, address(reg).code);
        BVCCValidatorRegistry(REGISTRY).proposeValidator(address(ur), address(v));
        vm.warp(block.timestamp + 48 hours);
        BVCCValidatorRegistry(REGISTRY).activateValidator(address(ur));

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](1);
        ap.allowedProtocols[0] = address(ur);
        ap.allowedRecipients = new address[](0);
        vm.prank(address(w));
        w.authorizeAgent(ap);

        vm.prank(address(w));
        w.setCallPolicy(address(ur), bytes4(keccak256("execute(bytes,bytes[],uint256)")), (uint256(1) << 255) | (uint256(1) << 254));
    }

    function _agentExec(BVCCAgentWalletV4 w, address agent, address target, bytes memory data) internal {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: 0, callData: data});
        vm.prank(agent);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));
    }

    function _urV3For(address recipient) internal view returns (bytes memory) {
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = _v3Input(recipient);
        return _execCd(abi.encodePacked(C_V3_IN), inputs);
    }

    function test_E2E_ValidSwapToWallet_Passes() public {
        (BVCCAgentWalletV4 w, MockUR ur, address agent, ) = _wireWalletWithValidator();
        _agentExec(w, agent, address(ur), _urV3For(address(w)));
        assertEq(ur.calls(), 1, "validated UR swap reaches the router");
    }

    function test_E2E_SwapToAttacker_Reverts() public {
        (BVCCAgentWalletV4 w, MockUR ur, address agent, ) = _wireWalletWithValidator();
        vm.expectRevert(BVCCAgentWalletV4.PolicyValidationFailed.selector);
        _agentExec(w, agent, address(ur), _urV3For(attacker));
        assertEq(ur.calls(), 0, "attacker-recipient swap never reaches the router");
    }

    function test_E2E_AcrossCommand0x40_Reverts() public {
        // The exploit the mask bug would have allowed: byte 0x40 with a v3-swap-shaped
        // body. The validator denies it → PolicyValidationFailed, router never called.
        (BVCCAgentWalletV4 w, MockUR ur, address agent, ) = _wireWalletWithValidator();
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = _v3Input(attacker);
        bytes memory cd = _execCd(abi.encodePacked(uint8(0x40)), inputs);
        vm.expectRevert(BVCCAgentWalletV4.PolicyValidationFailed.selector);
        _agentExec(w, agent, address(ur), cd);
        assertEq(ur.calls(), 0);
    }
}
