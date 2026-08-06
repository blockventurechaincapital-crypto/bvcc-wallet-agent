// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import {ERC7739Utils} from "@openzeppelin/contracts/utils/cryptography/draft-ERC7739Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @dev Cross-language vector: asserts that the ERC-7739 nested digest computed by
///      the frontend (lib/erc7739.ts, viem) for a Permit2 PermitSingle matches the
///      digest OZ's ERC7739 produces on-chain. The expected constants come from a
///      Node script driving the frontend module with identical inputs. If this breaks,
///      WalletConnect typed-data signing (Uniswap Permit2) breaks with it.
///
///      Two vectors, differing ONLY in the wallet's EIP-712 domain name:
///        - V2: the original frozen vector. Kept so a refactor of the encoding shows up
///              here even if the live domain moves on again.
///        - V4: the domain the deployed wallets actually use, EIP712("BVCCSmartWalletV4", "1").
///
///      Regenerating after a domain change (see docs/signing.md):
///        cd bvcc_wallet && npx tsx - <<'EOF'
///        import { erc7739TypedDataDigest } from './lib/erc7739'
///        // ...same inputs as _permitSingleDigest below, verifierDomain.name = new name
///        EOF
contract ERC7739VectorTest is Test {
    using MessageHashUtils for bytes32;

    // Digests produced by the frontend implementation (viem) for the inputs below.
    bytes32 constant EXPECTED_DIGEST_V2 = 0xf1189f327aa0a8bc6aa5059ec0cdb41e6b527cb4e2cd88bee294dab307289599;
    bytes32 constant EXPECTED_DIGEST_V4 = 0x79b5a6e7a1d3b95cbb6eab8dabd60cc00765bf2c0ab2908423754a8e9b81d373;

    bytes32 constant PERMIT_DETAILS_TYPEHASH =
        keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 constant PERMIT_SINGLE_TYPEHASH = keccak256(
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
    );

    string constant CONTENTS_DESCR =
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)";

    /// @dev The live domain of every deployed wallet — BVCCWallet.sol: EIP712("BVCCSmartWalletV4", "1").
    ///      This is the vector that matters in production.
    function test_typedDataSignDigest_matchesFrontend_V4() public view {
        assertEq(
            _permitSingleDigest("BVCCSmartWalletV4"),
            EXPECTED_DIGEST_V4,
            "frontend ERC-7739 digest != OZ on-chain digest (V4 domain)"
        );
    }

    /// @dev Original frozen vector. The domain name is the only difference from the V4 case,
    ///      so keeping both pins the encoding itself: a change to ERC7739Utils or to
    ///      lib/erc7739.ts breaks both, while a plain domain rename breaks only one.
    function test_typedDataSignDigest_matchesFrontend_V2() public view {
        assertEq(
            _permitSingleDigest("BVCCSmartWalletV2"),
            EXPECTED_DIGEST_V2,
            "frontend ERC-7739 digest != OZ on-chain digest (V2 domain)"
        );
    }

    /// @dev Nested digest for a fixed Permit2 PermitSingle, parameterised only by the
    ///      wallet's EIP-712 domain name. verifyingContract is synthetic (0x2222…) so the
    ///      vector does not depend on any deployment address.
    function _permitSingleDigest(string memory walletDomainName) internal view returns (bytes32) {
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

        bytes memory domainBytes = abi.encode(
            keccak256(bytes(walletDomainName)),
            keccak256(bytes("1")),
            uint256(42161),
            0x2222222222222222222222222222222222222222,
            bytes32(0)
        );

        bytes32 structHash = this.typedDataSignStructHash(CONTENTS_DESCR, contentsHash, domainBytes);
        return appSeparator.toTypedDataHash(structHash);
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
