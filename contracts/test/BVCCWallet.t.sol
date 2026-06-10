// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCSmartWalletV2} from "../src/BVCCWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

// ---------------------------------------------------------------------------
// Minimal ERC-20 mock — supports mint, transfer, balanceOf
// ---------------------------------------------------------------------------
contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Mock swap target — when called, mints tokenOut to msg.sender (wallet)
// Calldata contains address(tokenOut), which the snapshot scanner picks up.
// ---------------------------------------------------------------------------
contract MockSwapTarget {
    function swap(address tokenOut, uint256 amountOut) external {
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }
}

// ---------------------------------------------------------------------------
// Mock gas-burner — simulates an Arbitrum precompile (e.g. 0x64): reports
// bytecode (so the code-length guard does not filter it) and consumes ALL
// forwarded gas on any call. _tryBalanceOf must cap gas so this cannot drain
// the swap's gas budget. Deployed at a low precompile-like address via etch.
// ---------------------------------------------------------------------------
contract MockGasBurner {
    fallback() external {
        // Infinite loop — burns every wei of gas it is given
        while (true) {}
    }
}

// Swap target whose calldata embeds a gas-burner address as a candidate token,
// then mints tokenOut. Mirrors the real bug: a small uint in calldata matched a
// precompile address and the snapshot probe burned the gas budget.
contract MockSwapWithTrap {
    function swap(address trap, address tokenOut, uint256 amountOut) external {
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }
}

// balanceOf that returns 64 bytes (a uint + garbage). The fix decodes the first
// word, so it must be treated as a valid token (abi.decode reads 32 bytes).
contract MockFatReturnToken {
    mapping(address => uint256) public bal;
    function mint(address to, uint256 a) external { bal[to] += a; }
    function balanceOf(address a) external view returns (uint256, uint256) {
        return (bal[a], 12345); // 64-byte return
    }
    function transfer(address to, uint256 a) external returns (bool) {
        require(bal[msg.sender] >= a, "insufficient");
        bal[msg.sender] -= a;
        bal[to] += a;
        return true;
    }
    function swapMint(address tokenOut, uint256 amt) external {
        MockFatReturnToken(tokenOut).mint(msg.sender, amt);
    }
}

// balanceOf that reverts — must be filtered out (not treated as a token).
contract MockRevertingBalanceToken {
    function balanceOf(address) external pure returns (uint256) {
        revert("nope");
    }
}

contract BVCCSmartWalletV2Test is Test {
    using ERC7579Utils for *;

    address constant ENTRY_POINT = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;

    bytes32 constant BATCH_MODE =
        0x0100000000000000000000000000000000000000000000000000000000000000;

    // P-256 generator point G — valid public key
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    uint256 constant FEE_NUM = 500;
    uint256 constant FEE_DEN = 1_000_000;

    BVCCSmartWalletV2 wallet;
    MockERC20  token;
    MockSwapTarget swapTarget;

    bytes32 newSignerX;
    bytes32 newSignerY;

    address g1 = address(1);
    address g2 = address(2);
    address g3 = address(3);

    function setUp() public {
        wallet     = new BVCCSmartWalletV2(P256_GX, P256_GY);
        token      = new MockERC20();
        swapTarget = new MockSwapTarget();

        vm.deal(address(wallet), 10 ether);

        (uint256 nx, uint256 ny) = vm.publicKeyP256(0xDEADBEEF);
        newSignerX = bytes32(nx);
        newSignerY = bytes32(ny);
    }

    // -------------------------------------------------------------------------
    // Helper: build single-item batch executionData
    // -------------------------------------------------------------------------
    function _batch(address target, uint256 value, bytes memory data)
        internal pure returns (bytes memory)
    {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: value, callData: data});
        return abi.encode(b);
    }

    function _execute(address target, uint256 value, bytes memory data) internal {
        vm.prank(ENTRY_POINT);
        wallet.execute{value: 0}(BATCH_MODE, _batch(target, value, data));
    }

    function _setGuardians() internal {
        wallet.setGuardians([g1, g2, g3]);
    }

    // =========================================================================
    // CASE 1 — ETH send fee
    // =========================================================================

    function test_Case1_ETHFeeDeductedAndForwarded() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;

        address feeWallet = wallet.BVCC_FEE_WALLET();
        uint256 feeBefore = feeWallet.balance;

        _execute(recipient, amount, "");

        assertEq(feeWallet.balance - feeBefore, fee, "Fee wallet should receive 0.05%");
        assertEq(recipient.balance, amount - fee,    "Recipient receives amount minus fee");
    }

    function test_Case1_OnlyAppliesWhenNoCalldata() public {
        // ETH + calldata → NOT Case 1, goes to Case 3
        // Use a target that accepts ETH and has a simple fallback
        // We just verify it doesn't double-fee via Case 1 logic
        address recipient = makeAddr("recipient");
        uint256 amount    = 1 ether;

        // Encode some calldata so it goes to Case 3 (no ERC-20, so no fee collected)
        bytes memory cd = hex"deadbeef";
        vm.prank(ENTRY_POINT);
        // Should not revert — Case 3 handles it, no token found, no fee
        wallet.execute{value: 0}(BATCH_MODE, _batch(recipient, amount, cd));
    }

    // =========================================================================
    // CASE 2 — ERC-20 transfer fee
    // =========================================================================

    function test_Case2_ERC20TransferFeeCharged() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1000 ether;
        uint256 fee       = (amount * FEE_NUM) / FEE_DEN;

        // Fund wallet with enough tokens for amount + fee
        token.mint(address(wallet), amount + fee);

        address feeWallet = wallet.BVCC_FEE_WALLET();
        uint256 feeBalBefore = token.balanceOf(feeWallet);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);
        _execute(address(token), 0, cd);

        // Recipient gets exact amount
        assertEq(token.balanceOf(recipient), amount, "Recipient should get exact amount");
        // Fee wallet gets 0.05% fee
        assertEq(token.balanceOf(feeWallet) - feeBalBefore, fee, "Fee wallet should get 0.05%");
    }

    function test_Case2_RevertsIfInsufficientBalanceForFee() public {
        address recipient = makeAddr("recipient");
        uint256 amount    = 1000 ether;

        // Only fund exactly `amount` — not enough to cover fee
        token.mint(address(wallet), amount);

        bytes memory cd = abi.encodeWithSignature("transfer(address,uint256)", recipient, amount);

        vm.prank(ENTRY_POINT);
        vm.expectRevert("Insufficient balance for fee");
        wallet.execute{value: 0}(BATCH_MODE, _batch(address(token), 0, cd));
    }

    // =========================================================================
    // CASE 3 — DeFi / swap fee on balance increase
    // =========================================================================

    function test_Case3_SwapFeeCollectedOnTokenIncrease() public {
        uint256 swapOut = 1000 ether;
        uint256 fee     = (swapOut * FEE_NUM) / FEE_DEN;

        address feeWallet = wallet.BVCC_FEE_WALLET();

        // calldata: swap(address(token), swapOut)
        // scanner finds address(token) in calldata → snapshots balanceOf(wallet)=0
        bytes memory cd = abi.encodeWithSignature(
            "swap(address,uint256)", address(token), swapOut
        );

        _execute(address(swapTarget), 0, cd);

        // Wallet received swapOut, paid fee
        assertEq(token.balanceOf(address(wallet)), swapOut - fee, "Wallet should hold swapOut minus fee");
        assertEq(token.balanceOf(feeWallet), fee, "Fee wallet should receive 0.05% of increase");
    }

    // Regression: a gas-burning candidate (Arbitrum precompile pattern) in the
    // Case-3 calldata must NOT starve the swap of gas. Before the fix,
    // _tryBalanceOf forwarded all gas to the candidate; the precompile burned it
    // and the swap reverted with out-of-gas (UserOp success=false on-chain).
    function test_Case3_GasBurnerCandidateDoesNotStarveSwap() public {
        // Etch the gas-burner at a precompile-like low address so the snapshot
        // scanner finds it via the calldata word and probes its balanceOf.
        address trap = address(0x0000000000000000000000000000000000000064);
        vm.etch(trap, address(new MockGasBurner()).code);

        MockSwapWithTrap target = new MockSwapWithTrap();
        uint256 swapOut = 1000 ether;
        uint256 fee     = (swapOut * FEE_NUM) / FEE_DEN;
        address feeWallet = wallet.BVCC_FEE_WALLET();

        // calldata embeds: trap (0x..64), token, swapOut → scanner probes both
        bytes memory cd = abi.encodeWithSignature(
            "swap(address,address,uint256)", trap, address(token), swapOut
        );

        // Give the outer call a realistic budget. With the gas cap the swap
        // succeeds; without it the trap would consume the whole budget.
        vm.prank(ENTRY_POINT);
        wallet.execute{value: 0, gas: 2_000_000}(
            BATCH_MODE, _batch(address(target), 0, cd)
        );

        assertEq(token.balanceOf(address(wallet)), swapOut - fee, "Swap should complete despite gas-burner in calldata");
        assertEq(token.balanceOf(feeWallet), fee, "Fee still collected on the increase");
    }

    // A token whose balanceOf returns more than 32 bytes must still be detected
    // (abi.decode reads the first word) and have its fee collected.
    function test_Case3_FatReturnTokenStillSnapshotted() public {
        MockFatReturnToken fat = new MockFatReturnToken();
        uint256 swapOut = 1000 ether;
        uint256 fee     = (swapOut * FEE_NUM) / FEE_DEN;
        address feeWallet = wallet.BVCC_FEE_WALLET();

        bytes memory cd = abi.encodeWithSignature(
            "swapMint(address,uint256)", address(fat), swapOut
        );
        _execute(address(fat), 0, cd);

        assertEq(fat.bal(feeWallet), fee, "Fee collected from 64-byte-return token");
    }

    // A candidate whose balanceOf reverts must be filtered (no fee, no revert of
    // the whole batch) — confirms the staticcall failure path matches old catch.
    function test_Case3_RevertingBalanceOfIsFilteredNotFatal() public {
        MockRevertingBalanceToken bad = new MockRevertingBalanceToken();
        uint256 swapOut = 1000 ether;
        uint256 fee     = (swapOut * FEE_NUM) / FEE_DEN;
        address feeWallet = wallet.BVCC_FEE_WALLET();

        // calldata embeds both the reverting candidate and the real token
        bytes memory cd = abi.encodeWithSignature(
            "swap(address,address,uint256)", address(bad), address(token), swapOut
        );
        MockSwapWithTrap target = new MockSwapWithTrap();
        _execute(address(target), 0, cd);

        // Real token's fee still collected; reverting candidate simply ignored
        assertEq(token.balanceOf(feeWallet), fee, "Real token fee collected, bad candidate ignored");
    }

    function test_Case3_NoFeeIfBalanceDoesNotIncrease() public {
        address feeWallet = wallet.BVCC_FEE_WALLET();

        // Call swap with 0 output — no balance increase, no fee
        bytes memory cd = abi.encodeWithSignature(
            "swap(address,uint256)", address(token), uint256(0)
        );

        _execute(address(swapTarget), 0, cd);

        assertEq(token.balanceOf(feeWallet), 0, "No fee should be collected when balance unchanged");
    }

    // =========================================================================
    // RECOVERY — happy path
    // =========================================================================

    function test_RecoveryFullFlow() public {
        _setGuardians();

        vm.prank(g1);
        wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        assertTrue(wallet.recoveryInProgress());
        assertEq(wallet.recoveryApprovals(), 1);

        vm.prank(g2);
        wallet.approveRecovery();
        assertEq(wallet.recoveryApprovals(), 2);

        // Timelock not expired yet — reverts
        vm.prank(g1);
        vm.expectRevert(BVCCSmartWalletV2.TimelockNotExpired.selector);
        wallet.executeRecovery();

        vm.warp(block.timestamp + 48 hours);

        vm.prank(g1);
        wallet.executeRecovery();

        assertFalse(wallet.recoveryInProgress());
        assertEq(wallet.recoveryApprovals(), 0);
        assertEq(wallet.recoveryReadyAt(), 0);
    }

    function test_RecoveryChangesSignerAfterExecute() public {
        _setGuardians();

        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(g2); wallet.approveRecovery();
        vm.warp(block.timestamp + 48 hours);
        vm.prank(g1); wallet.executeRecovery();

        // Verify signer updated to new key
        (bytes32 qx, bytes32 qy) = wallet.signer();
        assertEq(qx, newSignerX, "Signer X should be updated");
        assertEq(qy, newSignerY, "Signer Y should be updated");
    }

    // =========================================================================
    // RECOVERY — access control
    // =========================================================================

    function test_NonGuardianCannotInitiateRecovery() public {
        _setGuardians();
        vm.prank(makeAddr("random"));
        vm.expectRevert("Not a guardian");
        wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
    }

    function test_NonGuardianCannotExecuteRecovery() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(g2); wallet.approveRecovery();
        vm.warp(block.timestamp + 48 hours);

        vm.prank(makeAddr("random"));
        vm.expectRevert("Not a guardian");
        wallet.executeRecovery();
    }

    function test_RecoveryRevertsWithInsufficientApprovals() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));

        vm.prank(g1);
        vm.expectRevert(BVCCSmartWalletV2.InsufficientApprovals.selector);
        wallet.executeRecovery();
    }

    function test_ApproveRevertsWhenNoRecoveryInProgress() public {
        _setGuardians();
        vm.prank(g1);
        vm.expectRevert(BVCCSmartWalletV2.NoRecoveryInProgress.selector);
        wallet.approveRecovery();
    }

    function test_DoubleApproveReverts() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(g2); wallet.approveRecovery();

        vm.prank(g2);
        vm.expectRevert(BVCCSmartWalletV2.AlreadyApproved.selector);
        wallet.approveRecovery();
    }

    // =========================================================================
    // RECOVERY — cancel
    // =========================================================================

    function test_OwnerCanCancelRecovery() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(g2); wallet.approveRecovery();

        vm.prank(address(wallet));
        wallet.cancelRecovery();

        assertFalse(wallet.recoveryInProgress());
        assertEq(wallet.recoveryApprovals(), 0);
        assertEq(wallet.recoveryReadyAt(), 0);
    }

    function test_CancelRecoveryRevertsIfCalledByEOA() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));

        vm.prank(g1);
        vm.expectRevert(BVCCSmartWalletV2.OnlyWalletCanCancel.selector);
        wallet.cancelRecovery();
    }

    function test_AfterCancelGuardianCanReinitiateRecovery() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(address(wallet)); wallet.cancelRecovery();

        // Can start again
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        assertTrue(wallet.recoveryInProgress());
        assertEq(wallet.recoveryApprovals(), 1);
    }

    // =========================================================================
    // RECOVERY — guardian management
    // =========================================================================

    function test_SetGuardiansOnlyOnce() public {
        _setGuardians();
        vm.expectRevert(BVCCSmartWalletV2.GuardiansAlreadySet.selector);
        wallet.setGuardians([address(4), address(5), address(6)]);
    }

    function test_SetGuardiansRejectsZeroAddress() public {
        vm.expectRevert("Invalid guardian address");
        wallet.setGuardians([address(1), address(0), address(3)]);
    }

    function test_CannotResetRecoveryAfterThreshold() public {
        _setGuardians();
        vm.prank(g1); wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
        vm.prank(g2); wallet.approveRecovery();

        // Guardian 3 tries to override — must revert
        vm.prank(g3);
        vm.expectRevert(BVCCSmartWalletV2.RecoveryAlreadyApproved.selector);
        wallet.initiateRecovery(uint256(newSignerX), uint256(newSignerY));
    }

    // =========================================================================
    // Wallet type identifier
    // =========================================================================

    function test_WalletType_IsStandard() public view {
        assertEq(wallet.walletType(), 0, "BVCCSmartWalletV2 should return type 0 (STANDARD)");
    }
}
