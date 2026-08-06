// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCSmartWalletV4} from "../src/BVCCWallet.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract NftMock is ERC721 {
    constructor() ERC721("Mock", "MOCK") {}
    function mint(address to, uint256 id) external { _mint(to, id); }
}

contract MultiTokenMock is ERC1155 {
    constructor() ERC1155("") {}
    function mint(address to, uint256 id, uint256 amount) external { _mint(to, id, amount, ""); }
}

/// @dev Control: a contract with no receiver hooks. Proves the tests below pass
///      *because of* ERC721Holder/ERC1155Holder rather than by accident.
contract NoHook {}

/// @dev The wallets inherit ERC721Holder + ERC1155Holder, so they answer the receiver
///      hooks and can be the destination of a `safeTransferFrom`. Without those hooks a
///      safe transfer reverts and the NFT never arrives — which is how marketplaces
///      (OpenSea and friends) send, so it would break buying.
///
///      Note this is NOT what makes Uniswap liquidity work: both the v3
///      NonfungiblePositionManager and the v4 PositionManager mint positions with
///      `_mint`, which skips the hook entirely. This covers NFTs arriving from outside.
///
///      The third test is the one that matters: receiving an NFT the owner cannot then
///      move back out would be worse than not receiving it at all.
contract NftReceiptTest is Test {
    address constant ENTRY_POINT = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;
    bytes32 constant BATCH_MODE =
        0x0100000000000000000000000000000000000000000000000000000000000000;

    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);

    BVCCSmartWalletV4 wallet;
    BVCCAgentWalletV4 agentWallet;
    NftMock nft;
    MultiTokenMock multi;

    address constant SENDER = address(0xA11CE);
    address constant BUYER = address(0xB0B);

    function setUp() public {
        wallet = new BVCCSmartWalletV4(P256_GX, P256_GY);
        agentWallet = new BVCCAgentWalletV4(P256_GX, P256_GY);
        nft = new NftMock();
        multi = new MultiTokenMock();
    }

    function _execute(address target, bytes memory data) internal {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: target, value: 0, callData: data});
        vm.prank(ENTRY_POINT);
        wallet.execute(BATCH_MODE, abi.encode(b));
    }

    // -------------------------------------------------------------------------
    // 1 — an ERC-721 sent with safeTransferFrom arrives
    // -------------------------------------------------------------------------

    function test_receivesERC721_safeTransfer_smartWallet() public {
        nft.mint(SENDER, 1);

        vm.prank(SENDER);
        nft.safeTransferFrom(SENDER, address(wallet), 1);

        assertEq(nft.ownerOf(1), address(wallet), "smart wallet did not receive the NFT");
        assertEq(nft.balanceOf(address(wallet)), 1);
    }

    function test_receivesERC721_safeTransfer_agentWallet() public {
        nft.mint(SENDER, 2);

        vm.prank(SENDER);
        nft.safeTransferFrom(SENDER, address(agentWallet), 2);

        assertEq(nft.ownerOf(2), address(agentWallet), "agent wallet did not receive the NFT");
    }

    /// @dev The control. Same transfer, to a contract without the hooks, must revert —
    ///      otherwise the two tests above would prove nothing about ERC721Holder.
    function test_control_safeTransferRevertsWithoutHook() public {
        NoHook bare = new NoHook();
        nft.mint(SENDER, 99);

        vm.prank(SENDER);
        vm.expectRevert();
        nft.safeTransferFrom(SENDER, address(bare), 99);

        assertEq(nft.ownerOf(99), SENDER, "NFT should not have moved");
    }

    function test_control_erc1155TransferRevertsWithoutHook() public {
        NoHook bare = new NoHook();
        multi.mint(SENDER, 98, 1);

        vm.prank(SENDER);
        vm.expectRevert();
        multi.safeTransferFrom(SENDER, address(bare), 98, 1, "");

        assertEq(multi.balanceOf(address(bare), 98), 0, "tokens should not have moved");
    }

    // -------------------------------------------------------------------------
    // 2 — ERC-1155, single and batch
    // -------------------------------------------------------------------------

    function test_receivesERC1155_single() public {
        multi.mint(SENDER, 7, 5);

        vm.prank(SENDER);
        multi.safeTransferFrom(SENDER, address(wallet), 7, 5, "");

        assertEq(multi.balanceOf(address(wallet), 7), 5);
    }

    function test_receivesERC1155_batch() public {
        multi.mint(SENDER, 10, 3);
        multi.mint(SENDER, 11, 4);

        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = 10; ids[1] = 11;
        amounts[0] = 3; amounts[1] = 4;

        vm.prank(SENDER);
        multi.safeBatchTransferFrom(SENDER, address(wallet), ids, amounts, "");

        assertEq(multi.balanceOf(address(wallet), 10), 3);
        assertEq(multi.balanceOf(address(wallet), 11), 4);
    }

    // -------------------------------------------------------------------------
    // 3 — the owner can send it back out through execute()
    // -------------------------------------------------------------------------

    function test_ownerCanTransferNftOut() public {
        nft.mint(SENDER, 3);
        vm.prank(SENDER);
        nft.safeTransferFrom(SENDER, address(wallet), 3);
        assertEq(nft.ownerOf(3), address(wallet));

        // safeTransferFrom is overloaded on IERC721 — name the signature explicitly.
        _execute(
            address(nft),
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", address(wallet), BUYER, uint256(3))
        );

        assertEq(nft.ownerOf(3), BUYER, "owner could not move the NFT back out");
        assertEq(nft.balanceOf(address(wallet)), 0);
    }

    function test_ownerCanTransferERC1155Out() public {
        multi.mint(SENDER, 20, 9);
        vm.prank(SENDER);
        multi.safeTransferFrom(SENDER, address(wallet), 20, 9, "");

        _execute(
            address(multi),
            abi.encodeWithSignature(
                "safeTransferFrom(address,address,uint256,uint256,bytes)",
                address(wallet), BUYER, uint256(20), uint256(9), bytes("")
            )
        );

        assertEq(multi.balanceOf(BUYER, 20), 9, "owner could not move the ERC-1155 back out");
        assertEq(multi.balanceOf(address(wallet), 20), 0);
    }
}
