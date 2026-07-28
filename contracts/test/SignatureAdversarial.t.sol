// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {BVCCSmartWalletV4} from "../src/BVCCWallet.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {ERC7739Utils} from "@openzeppelin/contracts/utils/cryptography/draft-ERC7739Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";

/**
 * Adversarial battery for the ERC-7739 / WebAuthn signature path.
 *
 * The existing suite proves a real Permit2 signature validates. This one tries to make a
 * signature validate where it must not: on another chain, on the owner's other wallet,
 * with a malleated s, or with the authenticator payload tampered with.
 */
contract SignatureAdversarialTest is Test {
    using MessageHashUtils for bytes32;

    bytes4 constant MAGIC = 0x1626ba7e;
    bytes4 constant FAIL  = 0xffffffff;
    uint256 constant PK = 0xA11CE;

    BVCCSmartWalletV4 wallet;
    BVCCAgentWalletV4 agentWallet;

    function setUp() public {
        (uint256 qx, uint256 qy) = vm.publicKeyP256(PK);
        wallet = new BVCCSmartWalletV4(bytes32(qx), bytes32(qy));
        agentWallet = new BVCCAgentWalletV4(bytes32(qx), bytes32(qy));   // same passkey, other address
    }

    // ------------------------------------------------------------------ helpers

    function _appSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("Permit2")), block.chainid,
            0x000000000022D473030F116dDEE9F6B43aC78BA3
        ));
    }

    function _contentsHash() internal pure returns (bytes32) {
        return keccak256(abi.encode(keccak256("Thing(uint256 v)"), uint256(42)));
    }

    string constant DESCR = "Thing(uint256 v)";

    /// @dev The nested digest the passkey must sign, for a given verifier wallet.
    function _nestedDigest(address verifier, bytes32 appSep) internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address vc, bytes32 salt,) =
            IERC5267(verifier).eip712Domain();
        bytes memory domainBytes =
            abi.encode(keccak256(bytes(name)), keccak256(bytes(version)), chainId, vc, salt);
        bytes32 structHash = this.tdStructHash(DESCR, _contentsHash(), domainBytes);
        return appSep.toTypedDataHash(structHash);
    }

    function tdStructHash(string calldata d, bytes32 h, bytes memory db) external pure returns (bytes32) {
        return ERC7739Utils.typedDataSignStructHash(d, h, db);
    }

    struct Sig { bytes32 r; bytes32 s; bytes authData; string clientData; }

    function _sign(bytes32 digest) internal view returns (Sig memory sg) {
        sg.authData = abi.encodePacked(bytes32(0), bytes1(0x05), bytes4(0));
        sg.clientData = string.concat(
            '{"type":"webauthn.get","challenge":"', Base64.encodeURL(abi.encodePacked(digest)), '"}'
        );
        bytes32 messageHash = sha256(abi.encodePacked(sg.authData, sha256(bytes(sg.clientData))));
        (bytes32 r, bytes32 s) = vm.signP256(PK, messageHash);
        sg.r = r;
        sg.s = bytes32(Math.min(uint256(s), P256.N - uint256(s)));
    }

    function _wrap(Sig memory sg, bytes32 appSep) internal pure returns (bytes memory) {
        bytes memory raw = abi.encode(sg.r, sg.s, uint256(23), uint256(1), sg.authData, sg.clientData);
        return abi.encodePacked(raw, appSep, _contentsHash(), bytes(DESCR), uint16(bytes(DESCR).length));
    }

    function _check(address verifier, Sig memory sg, bytes32 appSep) internal view returns (bytes4) {
        return IERC1271(verifier).isValidSignature(appSep.toTypedDataHash(_contentsHash()), _wrap(sg, appSep));
    }

    // ------------------------------------------------------------------ baseline

    function test_Baseline_ValidSignatureIsAccepted() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        assertEq(_check(address(wallet), sg, appSep), MAGIC);
    }

    // ------------------------------------------------------------------ 1
    /**
     * Cross-chain replay. The wallet address is identical on every network by design, so
     * a signature that travelled to another chain must be rejected there by the chainId
     * inside the verifier's own domain.
     */
    function test_CrossChainReplayRejected() public {
        vm.chainId(42161);
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        assertEq(_check(address(wallet), sg, appSep), MAGIC, "valid on the chain it was signed for");

        vm.chainId(8453);                                   // same address, different chain
        assertEq(_check(address(wallet), sg, _appSeparator()), FAIL, "must not replay across chains");
    }

    // ------------------------------------------------------------------ 2
    /**
     * Cross-wallet replay. One passkey backs both a smart wallet and an agent wallet at
     * different addresses. A signature for one must not authorize the other.
     */
    function test_CrossWalletReplayRejected() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        assertEq(_check(address(wallet), sg, appSep), MAGIC, "valid on its own wallet");
        assertEq(_check(address(agentWallet), sg, appSep), FAIL,
            "same passkey, other wallet: must not validate");
    }

    // ------------------------------------------------------------------ 3
    /// @dev Malleated signature: s replaced by N - s. Must be rejected.
    function test_HighSMalleabilityRejected() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        sg.s = bytes32(P256.N - uint256(sg.s));
        assertEq(_check(address(wallet), sg, appSep), FAIL, "high-s must not validate");
    }

    /// @dev A zeroed s is not a shortcut either.
    function test_ZeroSignatureRejected() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        sg.r = bytes32(0);
        sg.s = bytes32(0);
        assertEq(_check(address(wallet), sg, appSep), FAIL);
    }

    // ------------------------------------------------------------------ 4
    /// @dev The signature is bound to the contents: signing a different struct fails.
    function test_SignatureOverDifferentContentsRejected() public view {
        bytes32 appSep = _appSeparator();
        bytes32 otherDigest = appSep.toTypedDataHash(keccak256(abi.encode(keccak256("Thing(uint256 v)"), uint256(43))));
        Sig memory sg = _sign(otherDigest);
        assertEq(_check(address(wallet), sg, appSep), FAIL, "signed the wrong contents");
    }

    /// @dev And to the app domain: a signature for another dApp's domain does not carry over.
    function test_SignatureFromAnotherAppDomainRejected() public view {
        bytes32 otherApp = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("EvilApp")), block.chainid, address(0xBAD)
        ));
        Sig memory sg = _sign(_nestedDigest(address(wallet), otherApp));
        assertEq(_check(address(wallet), sg, _appSeparator()), FAIL, "app domain is bound");
    }

    // ------------------------------------------------------------------ 5
    /// @dev Tampering with the authenticator payload after signing must break it.
    function test_TamperedAuthenticatorDataRejected() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        sg.authData = abi.encodePacked(bytes32(0), bytes1(0x01), bytes4(0));   // drop the UV flag
        assertEq(_check(address(wallet), sg, appSep), FAIL, "authenticatorData is signed over");
    }

    /// @dev Swapping the challenge for another digest must break it: this is the binding
    ///      that stops a signature harvested for one operation authorizing another.
    function test_TamperedChallengeRejected() public view {
        bytes32 appSep = _appSeparator();
        Sig memory sg = _sign(_nestedDigest(address(wallet), appSep));
        sg.clientData = string.concat(
            '{"type":"webauthn.get","challenge":"', Base64.encodeURL(abi.encodePacked(keccak256("other"))), '"}'
        );
        assertEq(_check(address(wallet), sg, appSep), FAIL, "challenge binds the signature");
    }

    /// @dev webauthn.create must not be accepted where webauthn.get is required.
    function test_WrongClientDataTypeRejected() public view {
        bytes32 appSep = _appSeparator();
        bytes32 digest = _nestedDigest(address(wallet), appSep);
        Sig memory sg = _sign(digest);
        sg.clientData = string.concat(
            '{"type":"webauthn.create","challenge":"', Base64.encodeURL(abi.encodePacked(digest)), '"}'
        );
        assertEq(_check(address(wallet), sg, appSep), FAIL, "only webauthn.get is valid");
    }
}
