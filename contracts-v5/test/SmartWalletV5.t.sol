// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SmartWalletV5Test is V5Base {
    BVCCSmartWalletV5 internal wallet;
    MockToken internal token;

    function setUp() public override {
        super.setUp();
        wallet = _createSmart();
        token = new MockToken("T");
    }

    // ------------------------------------------------------------ creation

    function test_CreateWallet_StoresKeyAndCredential() public view {
        assertEq(address(wallet), smartFactory.getWalletAddress(qx, qy));
        (bytes32 x, bytes32 y) = wallet.signer();
        assertEq(x, qx);
        assertEq(y, qy);
        assertEq(wallet.credentialId(), CRED);
        assertTrue(smartFactory.isDeployed(address(wallet)));
    }

    function test_CreateWallet_IsIdempotent() public {
        assertEq(smartFactory.createWallet(qx, qy, "", ""), address(wallet));
    }

    function test_CreateWallet_RequiresPasskeySignature() public {
        (uint256 x, uint256 y) = vm.publicKeyP256(PK2);
        address predicted = smartFactory.getWalletAddress(bytes32(x), bytes32(y));
        // Signed by another key.
        bytes memory sig = _credentialSig(PK, predicted, CRED);
        vm.expectRevert(BVCCSmartWalletV5.InvalidCredentialSignature.selector);
        smartFactory.createWallet(bytes32(x), bytes32(y), CRED, sig);
        // Right key, other credential id than the one signed.
        sig = _credentialSig(PK2, predicted, CRED);
        vm.expectRevert(BVCCSmartWalletV5.InvalidCredentialSignature.selector);
        smartFactory.createWallet(bytes32(x), bytes32(y), hex"dead", sig);
        // Right key, signature bound to another wallet address.
        sig = _credentialSig(PK2, address(wallet), CRED);
        vm.expectRevert(BVCCSmartWalletV5.InvalidCredentialSignature.selector);
        smartFactory.createWallet(bytes32(x), bytes32(y), CRED, sig);
        // Correct.
        sig = _credentialSig(PK2, predicted, CRED);
        assertEq(smartFactory.createWallet(bytes32(x), bytes32(y), CRED, sig), predicted);
    }

    function test_SameKeySameAddressAcrossChains() public {
        address a = smartFactory.getWalletAddress(qx, qy);
        vm.chainId(8453);
        assertEq(smartFactory.getWalletAddress(qx, qy), a);
    }

    function test_InitializeCannotRunTwice() public {
        bytes memory sig = _credentialSig(PK, address(wallet), CRED);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        wallet.initialize(qx, qy, CRED, sig);
    }

    function test_LogicContractCannotBeInitialized() public {
        bytes memory sig = _credentialSig(PK, address(smartLogic), CRED);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        smartLogic.initialize(qx, qy, CRED, sig);
        sig = _credentialSig(PK, address(agentLogic), CRED);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        agentLogic.initialize(qx, qy, CRED, sig);
    }

    function test_InvalidPublicKeyRejected() public {
        vm.expectRevert();
        smartFactory.createWallet(bytes32(uint256(1)), bytes32(uint256(2)), CRED, "");
    }

    function test_FactoryKill() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        smartFactory.kill();
        vm.prank(ADMIN);
        smartFactory.kill();
        (uint256 x, uint256 y) = vm.publicKeyP256(PK2);
        vm.expectRevert(BVCCWalletFactoryV5.FactoryKilledError.selector);
        smartFactory.createWallet(bytes32(x), bytes32(y), CRED, "");
    }

    function test_FactoryOwnershipTwoStep() public {
        vm.prank(ADMIN);
        smartFactory.transferOwnership(address(0xBEEF));
        assertEq(smartFactory.owner(), ADMIN);
        vm.prank(address(0xBEEF));
        smartFactory.acceptOwnership();
        assertEq(smartFactory.owner(), address(0xBEEF));
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        smartFactory.renounceOwnership();
    }

    // ------------------------------------------------------------ ERC-4337

    function _userOp() internal view returns (PackedUserOperation memory op) {
        op.sender = address(wallet);
    }

    function test_UserOp_ExpiryIsPackedIntoValidationData() public {
        bytes32 h = keccak256("op");
        uint48 until = uint48(vm.getBlockTimestamp() + 900);
        PackedUserOperation memory op = _userOp();
        op.signature = abi.encode(until, _webauthn(PK, keccak256(abi.encode(h, until))));
        vm.prank(address(wallet.entryPoint()));
        uint256 data = wallet.validateUserOp(op, h, 0);
        assertEq(data & 1, 0, "signature valid");
        assertEq(uint48(data >> 160), until, "validUntil");
    }

    function test_UserOp_RejectsZeroExpiryAndWrongBinding() public {
        bytes32 h = keccak256("op");
        PackedUserOperation memory op = _userOp();
        op.signature = abi.encode(uint48(0), _webauthn(PK, keccak256(abi.encode(h, uint48(0)))));
        vm.prank(address(wallet.entryPoint()));
        assertEq(wallet.validateUserOp(op, h, 0), 1);

        uint48 until = uint48(vm.getBlockTimestamp() + 900);
        // Signed with one expiry, presented with another.
        op.signature = abi.encode(until + 1, _webauthn(PK, keccak256(abi.encode(h, until))));
        vm.prank(address(wallet.entryPoint()));
        assertEq(wallet.validateUserOp(op, h, 0) & 1, 1);

        // Plain V4-style signature (no expiry wrapper).
        op.signature = _webauthn(PK, h);
        vm.prank(address(wallet.entryPoint()));
        assertEq(wallet.validateUserOp(op, h, 0) & 1, 1);
    }

    function test_UserOp_OnlyEntryPoint() public {
        PackedUserOperation memory op = _userOp();
        vm.expectRevert();
        wallet.validateUserOp(op, bytes32(0), 0);
    }

    // ------------------------------------------------------------ execute and fees

    function test_Execute_OnlySelfOrEntryPoint() public {
        vm.expectRevert();
        wallet.execute(_mode(), _one(address(1), 0, ""));
    }

    function test_Fee_NativeSend() public {
        vm.deal(address(wallet), 1 ether);
        _asOwner(address(wallet), address(0xCAFE), 1 ether, "");
        assertEq(FEE.balance, 0.0005 ether);
        assertEq(address(0xCAFE).balance, 0.9995 ether);
    }

    function test_Fee_TokenTransferOnTop() public {
        token.mint(address(wallet), 1000e18);
        _asOwner(address(wallet), address(token), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 100e18)));
        assertEq(token.balanceOf(address(0xCAFE)), 100e18);
        assertEq(token.balanceOf(FEE), 0.05e18);
    }

    function test_Fee_TokenTransferNeedsBalanceForFee() public {
        token.mint(address(wallet), 100e18);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCSmartWalletV5.InsufficientBalanceForFee.selector);
        wallet.execute(_mode(), _one(address(token), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 100e18))));
    }

    function test_Fee_FalseReturningTokenReverts() public {
        FalseToken f = new FalseToken();
        f.mint(address(wallet), 1000e18);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCSmartWalletV5.TokenCallFailed.selector);
        wallet.execute(_mode(), _one(address(f), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 1e18))));
    }

    function test_Fee_OnBalanceIncrease() public {
        Puller p = new Puller();
        token.mint(address(p), 1000e18);
        _asOwner(address(wallet), address(p), 0, abi.encodeCall(Puller.give, (address(token), 100e18)));
        assertEq(token.balanceOf(FEE), 0.05e18);
        assertEq(token.balanceOf(address(wallet)), 100e18 - 0.05e18);
    }

    function test_Credential_SetByOwnerOnly() public {
        vm.expectRevert(BVCCSmartWalletV5.OnlyWallet.selector);
        wallet.setCredentialId(hex"01");
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.setCredentialId, (hex"0102")));
        assertEq(wallet.credentialId(), hex"0102");
    }
}
