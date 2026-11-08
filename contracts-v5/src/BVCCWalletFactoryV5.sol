// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {BVCCSmartWalletV5} from "./BVCCSmartWalletV5.sol";

/// @title BVCCWalletFactoryV5
/// @notice Creates ERC-1167 clones of one wallet logic (standard or agent; one factory
///         per logic). The address derives only from the passkey public key, so the
///         same key gives the same wallet on every chain where the same factory exists.
///         Creating a wallet needs a signature of that passkey (see initialize).
contract BVCCWalletFactoryV5 is Ownable2Step {
    /// @notice Wallet logic every clone delegates to.
    address public immutable implementation;

    /// @notice One-way switch. Once set, no new wallet can be created. Existing wallets are unaffected.
    bool public killed;

    error FactoryKilledError();
    error ZeroAddress();

    event WalletCreated(address indexed wallet, bytes32 pubKeyX, bytes32 pubKeyY);
    event FactoryKilled(address indexed by);

    constructor(address implementation_, address initialOwner) Ownable(initialOwner) {
        if (implementation_ == address(0)) revert ZeroAddress();
        implementation = implementation_;
    }

    function getWalletAddress(bytes32 pubKeyX, bytes32 pubKeyY) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(pubKeyX, pubKeyY));
    }

    /// @notice Deploys and initializes the wallet of a passkey, or returns it if it exists.
    function createWallet(bytes32 pubKeyX, bytes32 pubKeyY, bytes calldata credentialId, bytes calldata credentialSig)
        external
        returns (address wallet)
    {
        if (killed) revert FactoryKilledError();
        wallet = getWalletAddress(pubKeyX, pubKeyY);
        if (wallet.code.length > 0) return wallet;
        wallet = Clones.cloneDeterministic(implementation, _salt(pubKeyX, pubKeyY));
        BVCCSmartWalletV5(payable(wallet)).initialize(pubKeyX, pubKeyY, credentialId, credentialSig);
        emit WalletCreated(wallet, pubKeyX, pubKeyY);
    }

    function isDeployed(address wallet) external view returns (bool) {
        return wallet.code.length > 0;
    }

    /// @notice Permanently stops new wallet creation. Irreversible.
    function kill() external onlyOwner {
        killed = true;
        emit FactoryKilled(msg.sender);
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnableInvalidOwner(address(0));
    }

    function _salt(bytes32 pubKeyX, bytes32 pubKeyY) private pure returns (bytes32) {
        return keccak256(abi.encode(pubKeyX, pubKeyY));
    }
}
