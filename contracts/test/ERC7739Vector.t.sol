// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {ERC7739Utils} from "@openzeppelin/contracts/utils/cryptography/draft-ERC7739Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @dev Cross-language vector: asserts that the ERC-7739 nested digest computed by
///      the frontend (lib/erc7739.ts, viem) for a Permit2 PermitSingle matches the
///      digest OZ's ERC7739 produces on-chain. The expected constant comes from the
///      Node script with identical inputs. If this breaks, WalletConnect typed-data
///      signing (Uniswap Permit2) breaks with it.
contract ERC7739VectorTest is Test {
    using MessageHashUtils for bytes32;

    // Digest produced by the frontend implementation (viem) for the inputs below
    bytes32 constant EXPECTED_DIGEST = 0xf1189f327aa0a8bc6aa5059ec0cdb41e6b527cb4e2cd88bee294dab307289599;

    bytes32 constant PERMIT_DETAILS_TYPEHASH =
        keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 constant PERMIT_SINGLE_TYPEHASH = keccak256(
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
    );

    function test_typedDataSignDigest_matchesFrontend() public view {
        // App: Permit2 on Arbitrum One (domain has no version field)
        bytes32 appSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Permit2")),
                uint256(42161),
                0x000000000022D473030F116dDEE9F6B43aC78BA3
            )
        );

        // contents: PermitSingle
        bytes32 detailsHash = keccak256(
            abi.encode(
                PERMIT_DETAILS_TYPEHASH,
                0xaf88d065e77c8cC2239327C5EDb3A432268e5831, // USDC
                uint160(1000000),
                uint48(1750000000),
                uint48(0)
            )
        );
        bytes32 contentsHash = keccak256(
            abi.encode(
                PERMIT_SINGLE_TYPEHASH,
                detailsHash,
                0x1111111111111111111111111111111111111111,
                uint256(1750001800)
            )
        );

        // Wallet (verifier) domain: frozen synthetic test data (NOT the live wallet —
        // verifyingContract is 0x2222…). This vector pins OZ's ERC7739Utils encoding
        // against the frozen frontend digest, so its domain string stays "BVCCSmartWalletV2"
        // regardless of the live contract's EIP712 name. A separate V3-domain vector must be
        // regenerated from lib/erc7739.ts (set to "BVCCSmartWalletV4") during the C2 frontend sync.
        bytes memory domainBytes = abi.encode(
            keccak256(bytes("BVCCSmartWalletV2")),
            keccak256(bytes("1")),
            uint256(42161),
            0x2222222222222222222222222222222222222222,
            bytes32(0)
        );

        string memory contentsDescr =
            "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)";

        bytes32 structHash = this.typedDataSignStructHash(contentsDescr, contentsHash, domainBytes);
        bytes32 digest = appSeparator.toTypedDataHash(structHash);

        assertEq(digest, EXPECTED_DIGEST, "frontend ERC-7739 digest != OZ on-chain digest");
    }

    // ERC7739Utils takes calldata strings — expose via external helper
    function typedDataSignStructHash(
        string calldata contentsDescr,
        bytes32 contentsHash,
        bytes memory domainBytes
    ) external pure returns (bytes32) {
        return ERC7739Utils.typedDataSignStructHash(contentsDescr, contentsHash, domainBytes);
    }
}
