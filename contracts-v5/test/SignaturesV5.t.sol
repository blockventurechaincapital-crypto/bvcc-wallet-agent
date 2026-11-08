// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {ERC7739Utils} from "@openzeppelin/contracts/utils/cryptography/draft-ERC7739Utils.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @dev ERC-1271 / ERC-7739 on clones: the domain must be the clone's own address, so a
///      signature never carries over to another wallet, chain or the logic contract.
contract SignaturesV5Test is V5Base {
    using MessageHashUtils for bytes32;

    bytes4 internal constant MAGIC = 0x1626ba7e;
    bytes4 internal constant FAIL = 0xffffffff;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    string internal constant DESCR = "Thing(uint256 v)";

    BVCCSmartWalletV5 internal smart;
    BVCCAgentWalletV5 internal agentWallet;

    function setUp() public override {
        super.setUp();
        smart = _createSmart();
        agentWallet = _createAgent();
    }

    function _appSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                block.chainid,
                PERMIT2
            )
        );
    }

    function _contents() internal pure returns (bytes32) {
        return keccak256(abi.encode(keccak256("Thing(uint256 v)"), uint256(42)));
    }

    function tdStructHash(string calldata d, bytes32 h, bytes memory db) external pure returns (bytes32) {
        return ERC7739Utils.typedDataSignStructHash(d, h, db);
    }

    function _nestedDigest(address verifier, bytes32 appSep) internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address vc, bytes32 salt,) =
            IERC5267(verifier).eip712Domain();
        bytes memory domainBytes = abi.encode(keccak256(bytes(name)), keccak256(bytes(version)), chainId, vc, salt);
        return appSep.toTypedDataHash(this.tdStructHash(DESCR, _contents(), domainBytes));
    }

    function _wrap(bytes memory webauthnSig, bytes32 appSep) internal pure returns (bytes memory) {
        return abi.encodePacked(webauthnSig, appSep, _contents(), bytes(DESCR), uint16(bytes(DESCR).length));
    }

    function _check(address verifier, bytes memory sig, bytes32 appSep) internal view returns (bytes4) {
        return IERC1271(verifier).isValidSignature(appSep.toTypedDataHash(_contents()), _wrap(sig, appSep));
    }

    function test_CloneDomainIsTheCloneAddress() public view {
        (,,,, address vc,,) = IERC5267(address(smart)).eip712Domain();
        assertEq(vc, address(smart));
    }

    function test_ValidOnItsOwnClone() public view {
        bytes32 appSep = _appSeparator();
        bytes memory sig = _webauthn(PK, _nestedDigest(address(smart), appSep));
        assertEq(_check(address(smart), sig, appSep), MAGIC);
    }

    function test_NotValidOnOtherCloneOfSamePasskey() public view {
        bytes32 appSep = _appSeparator();
        bytes memory sig = _webauthn(PK, _nestedDigest(address(smart), appSep));
        assertEq(_check(address(agentWallet), sig, appSep), FAIL);
    }

    function test_NotValidOnLogicContract() public view {
        bytes32 appSep = _appSeparator();
        bytes memory sig = _webauthn(PK, _nestedDigest(address(smartLogic), appSep));
        assertEq(_check(address(smartLogic), sig, appSep), FAIL);
    }

    function test_NotValidOnOtherChain() public {
        bytes32 appSep = _appSeparator();
        bytes memory sig = _webauthn(PK, _nestedDigest(address(smart), appSep));
        vm.chainId(8453);
        assertEq(_check(address(smart), sig, _appSeparator()), FAIL);
    }

    function test_NotValidAfterRecoveryForOldKey() public {
        address[3] memory g = [address(0x6000), address(0x6001), address(0x6002)];
        _self(address(smart), abi.encodeCall(BVCCSmartWalletV5.setGuardians, (g)));
        (uint256 x, uint256 y) = vm.publicKeyP256(PK2);
        vm.prank(g[0]);
        smart.voteRecovery(bytes32(x), bytes32(y), hex"01");
        vm.prank(g[1]);
        smart.voteRecovery(bytes32(x), bytes32(y), hex"01");
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(g[2]);
        smart.executeRecovery();

        bytes32 appSep = _appSeparator();
        bytes32 digest = _nestedDigest(address(smart), appSep);
        assertEq(_check(address(smart), _webauthn(PK, digest), appSep), FAIL, "old passkey");
        assertEq(_check(address(smart), _webauthn(PK2, digest), appSep), MAGIC, "new passkey");
    }

    function test_RawHashWithoutNestingRejected() public view {
        bytes32 h = keccak256("anything");
        assertEq(IERC1271(address(smart)).isValidSignature(h, _webauthn(PK, h)), FAIL);
    }
}
