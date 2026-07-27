// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV3} from "../src/BVCCAgentWallet.sol";
import {BVCCValidatorRegistry} from "../src/BVCCValidatorRegistry.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

// ---------------------------------------------------------------------------
// Mocks — protocol targets whose calls the policy layer must gate
// ---------------------------------------------------------------------------

contract MockERC20Pol {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
}

/// @dev Aave Pool surface used by the SDK builders. No-op counters — the policy
///      battery proves the wallet gates the CALL; token movement is Aave-fork territory.
contract MockAavePool {
    uint256 public calls;
    function supply(address, uint256, address, uint16) external { calls++; }
    function withdraw(address, uint256, address) external returns (uint256) { calls++; return 0; }
    function borrow(address, uint256, uint256, uint16, address) external { calls++; }
    function repay(address, uint256, uint256, address) external returns (uint256) { calls++; return 0; }
}

struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24  fee;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

contract MockRouter {
    uint256 public calls;
    function exactInputSingle(ExactInputSingleParams calldata) external returns (uint256) { calls++; return 0; }
}

contract MockPermit2 {
    uint256 public calls;
    function approve(address, address, uint160, uint48) external { calls++; }
}

// Deep-validation registry behaviours, etched at the wallet's fixed REGISTRY address.
contract RegTrue  { function validate(address, address, uint256, bytes calldata) external pure returns (bool) { return true; } }
contract RegFalse { function validate(address, address, uint256, bytes calldata) external pure returns (bool) { return false; } }
contract RegRevert{ function validate(address, address, uint256, bytes calldata) external pure returns (bool) { revert("registry says no"); } }
contract RegBadData { fallback() external { assembly { return(0, 1) } } } // 1-byte returndata → bool decode reverts

// ---------------------------------------------------------------------------
// Adversarial battery for the V3 call-policy layer (executeAsAgent, Case 3)
// ---------------------------------------------------------------------------
contract CallPolicyAdversarialTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    // Frozen VALIDATOR_REGISTRY constant compiled into BVCCAgentWalletV3
    // (test/Create2Consistency.t.sol proves the wallet uses exactly this address).
    address constant REGISTRY = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2;

    // Policy word field helpers (mirror the contract layout).
    uint256 constant ALLOWED = 1 << 255;
    uint256 constant DEEP    = 1 << 254;
    function pinW(uint256 w) internal pure returns (uint256) { return uint256(1) << (192 + w); }
    function pinP(uint256 w) internal pure returns (uint256) { return uint256(1) << (160 + w); }

    // Selectors
    bytes4 constant SUPPLY   = bytes4(keccak256("supply(address,uint256,address,uint16)"));
    bytes4 constant WITHDRAW = bytes4(keccak256("withdraw(address,uint256,address)"));
    bytes4 constant BORROW   = bytes4(keccak256("borrow(address,uint256,uint256,uint16,address)"));
    bytes4 constant REPAY    = bytes4(keccak256("repay(address,uint256,uint256,address)"));
    bytes4 constant EXACT_IN = bytes4(keccak256("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))"));
    bytes4 constant P2_APPROVE = bytes4(keccak256("approve(address,address,uint160,uint48)"));

    BVCCAgentWalletV3 wallet;
    MockAavePool pool;
    MockRouter   router;
    MockPermit2  permit2;
    MockERC20Pol asset;
    address agent;
    address attacker;

    function setUp() public {
        wallet = new BVCCAgentWalletV3(P256_GX, P256_GY);
        wallet.setGuardians([address(10), address(11), address(12)]);
        vm.deal(address(wallet), 100 ether);
        pool = new MockAavePool();
        router = new MockRouter();
        permit2 = new MockPermit2();
        asset = new MockERC20Pol();
        agent = makeAddr("agent");
        attacker = makeAddr("attacker");
        vm.deal(agent, 1 ether);

        address[] memory protos = new address[](3);
        protos[0] = address(pool);
        protos[1] = address(router);
        protos[2] = address(permit2);
        _authorize(protos);
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _authorize(address[] memory protocols) internal {
        BVCCAgentWalletV3.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = protocols;
        ap.allowedRecipients = new address[](0);
        vm.prank(address(wallet));
        wallet.authorizeAgent(ap);
    }

    function _setPolicy(address target, bytes4 sel, uint256 policy) internal {
        vm.prank(address(wallet));
        wallet.setCallPolicy(target, sel, policy);
    }

    function _exec(address target, uint256 value, bytes memory data) internal {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: value, callData: data});
        vm.prank(agent);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));
    }

    /// @dev Overwrite calldata word `w` (post-selector) with a raw 256-bit value.
    function _patchWord(bytes memory cd, uint256 w, uint256 val) internal pure {
        uint256 off = 0x20 + 4 + 32 * w;
        assembly { mstore(add(cd, off), val) }
    }

    function _swapCd(address recipient) internal view returns (bytes memory) {
        return abi.encodeWithSelector(EXACT_IN, ExactInputSingleParams({
            tokenIn: address(asset), tokenOut: address(asset), fee: 3000,
            recipient: recipient, amountIn: 1e18, amountOutMinimum: 1, sqrtPriceLimitX96: 0
        }));
    }

    // ==================================================================
    // 1. Aave withdraw(to) — the flagship V3 fix
    // ==================================================================

    function test_Withdraw_ToAttacker_Reverts() public {
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, attacker);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_Withdraw_ToWallet_Succeeds() public {
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet));
        _exec(address(pool), 0, cd);
        assertEq(pool.calls(), 1, "legit withdraw must reach the pool");
    }

    // ==================================================================
    // 2. Aave supply / borrow / repay onBehalfOf pinning
    // ==================================================================

    function test_Supply_OnBehalfExternal_Reverts() public {
        _setPolicy(address(pool), SUPPLY, ALLOWED | pinW(2));
        bytes memory cd = abi.encodeWithSignature("supply(address,uint256,address,uint16)", address(asset), 1e18, attacker, uint16(0));
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_Supply_OnBehalfWallet_Succeeds() public {
        _setPolicy(address(pool), SUPPLY, ALLOWED | pinW(2));
        bytes memory cd = abi.encodeWithSignature("supply(address,uint256,address,uint16)", address(asset), 1e18, address(wallet), uint16(0));
        _exec(address(pool), 0, cd);
        assertEq(pool.calls(), 1);
    }

    function test_Borrow_OnBehalfExternal_Reverts() public {
        _setPolicy(address(pool), BORROW, ALLOWED | pinW(4));
        bytes memory cd = abi.encodeWithSignature("borrow(address,uint256,uint256,uint16,address)", address(asset), 1e18, uint256(2), uint16(0), attacker);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_Borrow_OnBehalfWallet_Succeeds() public {
        _setPolicy(address(pool), BORROW, ALLOWED | pinW(4));
        bytes memory cd = abi.encodeWithSignature("borrow(address,uint256,uint256,uint16,address)", address(asset), 1e18, uint256(2), uint16(0), address(wallet));
        _exec(address(pool), 0, cd);
        assertEq(pool.calls(), 1);
    }

    function test_Repay_OnBehalfExternal_Reverts() public {
        _setPolicy(address(pool), REPAY, ALLOWED | pinW(3));
        bytes memory cd = abi.encodeWithSignature("repay(address,uint256,uint256,address)", address(asset), 1e18, uint256(2), attacker);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_Repay_OnBehalfWallet_Succeeds() public {
        _setPolicy(address(pool), REPAY, ALLOWED | pinW(3));
        bytes memory cd = abi.encodeWithSignature("repay(address,uint256,uint256,address)", address(asset), 1e18, uint256(2), address(wallet));
        _exec(address(pool), 0, cd);
        assertEq(pool.calls(), 1);
    }

    // ==================================================================
    // 3. SwapRouter02 recipient pinning
    // ==================================================================

    function test_Swap_RecipientAttacker_Reverts() public {
        _setPolicy(address(router), EXACT_IN, ALLOWED | pinW(3));
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(router), 0, _swapCd(attacker));
    }

    function test_Swap_RecipientWallet_Succeeds() public {
        _setPolicy(address(router), EXACT_IN, ALLOWED | pinW(3));
        _exec(address(router), 0, _swapCd(address(wallet)));
        assertEq(router.calls(), 1);
    }

    // ==================================================================
    // 4. Unregistered selector denied even on a whitelisted protocol
    // ==================================================================

    function test_UnregisteredSelector_OnWhitelistedProtocol_Reverts() public {
        // pool IS in allowedProtocols, but WITHDRAW has no policy registered.
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet));
        vm.expectRevert(BVCCAgentWalletV3.SelectorNotAllowed.selector);
        _exec(address(pool), 0, cd);
    }

    function test_RegisteredSelector_Succeeds() public {
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        _exec(address(pool), 0, abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet)));
        assertEq(pool.calls(), 1);
    }

    // ==================================================================
    // 5. PIN_PROTOCOL: Permit2.approve spender must be a whitelisted protocol
    // ==================================================================

    function test_Permit2Approve_UnauthorizedSpender_Reverts() public {
        _setPolicy(address(permit2), P2_APPROVE, ALLOWED | pinP(1));
        bytes memory cd = abi.encodeWithSignature("approve(address,address,uint160,uint48)", address(asset), attacker, uint160(1e18), uint48(0));
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(permit2), 0, cd);
    }

    function test_Permit2Approve_AuthorizedSpender_Succeeds() public {
        // router is in allowedProtocols → a valid PIN_PROTOCOL target.
        _setPolicy(address(permit2), P2_APPROVE, ALLOWED | pinP(1));
        bytes memory cd = abi.encodeWithSignature("approve(address,address,uint160,uint48)", address(asset), address(router), uint160(1e18), uint48(0));
        _exec(address(permit2), 0, cd);
        assertEq(permit2.calls(), 1);
    }

    // ==================================================================
    // 6. DEEP_VALIDATION registry outcomes (all fail-closed but success)
    // ==================================================================

    function _deepSwap(address recipient) internal {
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        _exec(address(router), 0, _swapCd(recipient));
    }

    function test_Deep_ValidatorTrue_Succeeds() public {
        vm.etch(REGISTRY, address(new RegTrue()).code);
        _deepSwap(address(wallet));
        assertEq(router.calls(), 1, "deep-validated call reaches target when validator approves");
    }

    function test_Deep_ValidatorFalse_Reverts() public {
        vm.etch(REGISTRY, address(new RegFalse()).code);
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        vm.expectRevert(BVCCAgentWalletV3.PolicyValidationFailed.selector);
        _exec(address(router), 0, _swapCd(address(wallet)));
    }

    function test_Deep_NoRegistryCode_Reverts() public {
        vm.etch(REGISTRY, ""); // codeless → high-level call reverts (extcodesize guard)
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        vm.expectRevert();
        _exec(address(router), 0, _swapCd(address(wallet)));
    }

    function test_Deep_ValidatorReverts_Reverts() public {
        vm.etch(REGISTRY, address(new RegRevert()).code);
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        vm.expectRevert();
        _exec(address(router), 0, _swapCd(address(wallet)));
    }

    function test_Deep_ValidatorBadData_Reverts() public {
        vm.etch(REGISTRY, address(new RegBadData()).code);
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        vm.expectRevert();
        _exec(address(router), 0, _swapCd(address(wallet)));
    }

    function test_Deep_RealRegistryNoValidatorRegistered_Reverts() public {
        // Real registry code, but no validator mapped for this target → validate() = false.
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(0xABCD));
        vm.etch(REGISTRY, address(reg).code);
        _setPolicy(address(router), EXACT_IN, ALLOWED | DEEP);
        vm.expectRevert(BVCCAgentWalletV3.PolicyValidationFailed.selector);
        _exec(address(router), 0, _swapCd(address(wallet)));
    }

    // ==================================================================
    // 7. Registry governance — timelock to allow, immediate to deny
    // ==================================================================

    function test_Registry_ProposeActivateRespectsTimelock() public {
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        address v = address(new RegTrue());
        reg.proposeValidator(address(pool), v);
        assertEq(reg.validators(address(pool)), address(0), "not active before timelock");

        vm.expectRevert(BVCCValidatorRegistry.TimelockActive.selector);
        reg.activateValidator(address(pool));

        vm.warp(block.timestamp + 48 hours);
        reg.activateValidator(address(pool));
        assertEq(reg.validators(address(pool)), v, "active after 48h");
    }

    function test_Registry_FreezeIsImmediate() public {
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        address v = address(new RegTrue());
        reg.proposeValidator(address(pool), v);
        vm.warp(block.timestamp + 48 hours);
        reg.activateValidator(address(pool));

        reg.freezeValidator(address(pool));
        assertEq(reg.validators(address(pool)), address(0), "freeze removes validator immediately");
        assertFalse(reg.validate(address(this), address(pool), 0, ""), "frozen target validates false");
    }

    function test_Registry_CancelProposal() public {
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        reg.proposeValidator(address(pool), address(new RegTrue()));
        reg.cancelProposal(address(pool));
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(BVCCValidatorRegistry.NothingPending.selector);
        reg.activateValidator(address(pool));
    }

    function test_Registry_OnlyOwner() public {
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        address v = address(new RegTrue()); // hoist deploy: prank/expectRevert gate the CALL, not the CREATE
        vm.prank(attacker);
        vm.expectRevert(BVCCValidatorRegistry.NotOwner.selector);
        reg.proposeValidator(address(pool), v);

        vm.prank(attacker);
        vm.expectRevert(BVCCValidatorRegistry.NotOwner.selector);
        reg.freezeValidator(address(pool));
    }

    function test_Registry_DispatchesToRegisteredValidator() public {
        BVCCValidatorRegistry reg = new BVCCValidatorRegistry(address(this));
        reg.proposeValidator(address(pool), address(new RegTrue()));
        vm.warp(block.timestamp + 48 hours);
        reg.activateValidator(address(pool));
        assertTrue(reg.validate(address(this), address(pool), 0, ""), "dispatches to active validator");
        assertFalse(reg.validate(address(this), address(router), 0, ""), "unmapped target = false");
    }

    // ==================================================================
    // 8. policy = 0 revokes
    // ==================================================================

    function test_PolicyZero_Revokes() public {
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        _exec(address(pool), 0, abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet)));
        assertEq(pool.calls(), 1);

        _setPolicy(address(pool), WITHDRAW, 0); // revoke
        vm.expectRevert(BVCCAgentWalletV3.SelectorNotAllowed.selector);
        _exec(address(pool), 0, abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet)));
    }

    // ==================================================================
    // 9. Malformed calldata / wrong word / dirty high bits
    // ==================================================================

    function test_ShortCalldata_Reverts() public {
        _setPolicy(address(pool), bytes4(0x12345678), ALLOWED);
        vm.expectRevert(BVCCAgentWalletV3.CalldataTooShort.selector);
        _exec(address(pool), 0, hex"1234"); // 2 bytes < 4
    }

    function test_PinReadingPastCalldataEnd_Reverts() public {
        // withdraw has 3 words; pinning word 6 reads past the end → 0 → mismatch.
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(6));
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet));
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_MispinnedWord_Reverts() public {
        // Pins are strict about the EXACT word index: pinning word 1 (the amount,
        // 1e18) as PIN_WALLET requires that word to equal the wallet address. It
        // doesn't, so even an otherwise-legit call reverts — a policy must target
        // the right word. The shipped presets pin the correct one (word 2 = `to`).
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(1));
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, attacker);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_DirtyHighBits_PinWallet_Reverts() public {
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        bytes memory cd = abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet));
        // word 2 = wallet in low 160 bits, but with dirty high bits → full-word compare fails.
        uint256 dirty = uint256(uint160(address(wallet))) | (uint256(1) << 200);
        _patchWord(cd, 2, dirty);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(pool), 0, cd);
    }

    function test_DirtyHighBits_PinProtocol_Reverts() public {
        _setPolicy(address(permit2), P2_APPROVE, ALLOWED | pinP(1));
        bytes memory cd = abi.encodeWithSignature("approve(address,address,uint160,uint48)", address(asset), address(router), uint160(1e18), uint48(0));
        uint256 dirty = uint256(uint160(address(router))) | (uint256(1) << 200);
        _patchWord(cd, 1, dirty);
        vm.expectRevert(BVCCAgentWalletV3.PinnedArgMismatch.selector);
        _exec(address(permit2), 0, cd);
    }

    // ==================================================================
    // 10. Atomicity — one bad item reverts the whole batch
    // ==================================================================

    function test_Batch_OneBadItem_RevertsAll() public {
        address r1 = makeAddr("r1");
        // item 0: legit ETH send (Case 1). item 1: unregistered selector on pool (Case 3).
        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: r1, value: 0.1 ether, callData: ""});
        b[1] = Execution({
            target: address(pool),
            value: 0,
            callData: abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet))
        });
        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV3.SelectorNotAllowed.selector);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(r1.balance, 0, "legit item 0 rolled back with the batch");
        assertEq(pool.calls(), 0, "bad item never reached the pool");
    }

    function test_Batch_AllValid_Succeeds() public {
        address r1 = makeAddr("r1");
        _setPolicy(address(pool), WITHDRAW, ALLOWED | pinW(2));
        Execution[] memory b = new Execution[](2);
        b[0] = Execution({target: r1, value: 0.1 ether, callData: ""});
        b[1] = Execution({
            target: address(pool),
            value: 0,
            callData: abi.encodeWithSignature("withdraw(address,uint256,address)", address(asset), 1e18, address(wallet))
        });
        vm.prank(agent);
        wallet.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(pool.calls(), 1, "valid batch reaches the pool");
        assertGt(r1.balance, 0, "valid ETH send applied");
    }

    // ==================================================================
    // 11. Only the wallet can set policies
    // ==================================================================

    function test_SetCallPolicy_OnlyWallet() public {
        vm.prank(attacker);
        vm.expectRevert(BVCCAgentWalletV3.OnlyWallet.selector);
        wallet.setCallPolicy(address(pool), WITHDRAW, ALLOWED);

        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV3.OnlyWallet.selector);
        wallet.setCallPolicy(address(pool), WITHDRAW, ALLOWED);
    }
}
