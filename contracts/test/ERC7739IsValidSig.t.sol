// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {BVCCSmartWalletV3} from "../src/BVCCWallet.sol";
import {BVCCAgentWalletV3} from "../src/BVCCAgentWallet.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {ERC7739Utils} from "@openzeppelin/contracts/utils/cryptography/draft-ERC7739Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";

/// @dev End-to-end exercise of the full ERC-7739 isValidSignature path with a REAL
///      WebAuthn signature and the OZ wrapped-signature format produced by viem's
///      wrapTypedDataSignature. Reproduces the Uniswap Permit2 PermitSingle case that
///      the WalletConnect flow signs (the "second signature" in a token->token swap).
contract ERC7739IsValidSigTest is Test {
    using MessageHashUtils for bytes32;

    bytes4 constant MAGIC = 0x1626ba7e;
    uint256 constant PK = 0xA11CE;

    BVCCSmartWalletV3 wallet;
    BVCCAgentWalletV3 agentWallet;

    function setUp() public {
        (uint256 qx, uint256 qy) = vm.publicKeyP256(PK);
        wallet = new BVCCSmartWalletV3(bytes32(qx), bytes32(qy));
        agentWallet = new BVCCAgentWalletV3(bytes32(qx), bytes32(qy));
    }

    function test_isValidSignature_permitSingle_smartWallet() public view {
        _assertPermitSingleValidates(address(wallet));
    }

    function test_isValidSignature_permitSingle_agentWallet() public view {
        _assertPermitSingleValidates(address(agentWallet));
    }

    /// @dev Build a WebAuthn signature over `digest`, abi-encoded in the exact tuple
    ///      order the frontend uses (r, s, challengeIndex, typeIndex, authData, clientDataJSON).
    function _webauthnSig(bytes32 digest) internal view returns (bytes memory) {
        bytes memory authenticatorData = abi.encodePacked(bytes32(0), bytes1(0x05), bytes4(0)); // UP|UV
        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"', Base64.encodeURL(abi.encodePacked(digest)), '"}'
        );
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, sha256(bytes(clientDataJSON))));
        (bytes32 r, bytes32 s) = vm.signP256(PK, messageHash);
        s = bytes32(Math.min(uint256(s), P256.N - uint256(s)));
        return abi.encode(r, s, uint256(23), uint256(1), authenticatorData, clientDataJSON);
    }

    function _assertPermitSingleValidates(address w) internal view {
        // ---- App domain: Permit2 (no version field) ----
        bytes32 appSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Permit2")),
                block.chainid,
                0x000000000022D473030F116dDEE9F6B43aC78BA3
            )
        );

        // ---- contents: PermitSingle ----
        bytes32 detailsHash = keccak256(
            abi.encode(
                keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"),
                0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
                uint160(1000000),
                uint48(1750000000),
                uint48(0)
            )
        );
        bytes32 contentsHash = keccak256(
            abi.encode(
                keccak256(
                    "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
                ),
                detailsHash,
                0x1111111111111111111111111111111111111111,
                uint256(1750001800)
            )
        );

        string memory contentsDescr =
            "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)";

        // ---- wallet (verifier) domain via ERC-5267 ----
        (, string memory name, string memory version, uint256 chainId, address verifyingContract, bytes32 salt,) =
            IERC5267(w).eip712Domain();
        bytes memory domainBytes = abi.encode(
            keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifyingContract, salt
        );

        // ---- nested digest (what the signer must sign) ----
        bytes32 structHash = this.tdStructHash(contentsDescr, contentsHash, domainBytes);
        bytes32 nestedDigest = appSeparator.toTypedDataHash(structHash);

        // ---- sign with real WebAuthn (Face ID emulation) over the nested digest ----
        bytes memory rawSig = _webauthnSig(nestedDigest);

        // ---- wrap (OZ / viem wrapTypedDataSignature format) ----
        bytes memory wrapped = abi.encodePacked(
            rawSig, appSeparator, contentsHash, bytes(contentsDescr), uint16(bytes(contentsDescr).length)
        );

        // ---- app hash passed by the dApp / frontend ----
        bytes32 appHash = appSeparator.toTypedDataHash(contentsHash);

        assertEq(IERC1271(w).isValidSignature(appHash, wrapped), MAGIC, "isValidSignature != ERC-1271 magic");
    }

    function tdStructHash(string calldata d, bytes32 h, bytes memory db) external pure returns (bytes32) {
        return ERC7739Utils.typedDataSignStructHash(d, h, db);
    }
}
