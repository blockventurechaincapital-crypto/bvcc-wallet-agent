// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BVCCSmartWalletV3} from "./BVCCWallet.sol";

contract BVCCSmartWalletFactoryV3 {

    event WalletCreated(address indexed wallet, uint256 pubKeyX, uint256 pubKeyY, string credentialId);
    event FactoryKilled(address indexed by);

    error NotOwner();
    error FactoryKilledError();
    error ZeroOwner();

    /// @notice Address allowed to permanently disable new wallet creation.
    address public immutable owner;

    /// @notice One-way kill switch. Once true, createWallet reverts forever.
    ///         Does NOT affect already-deployed wallets (independent contracts).
    bool public killed;

    /// @param owner_ Address allowed to call kill() (e.g. BVCC fee/multisig wallet).
    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroOwner();
        owner = owner_;
    }

    // -------------------------------------------------------------------------
    // Kill switch — one-way, owner only
    // -------------------------------------------------------------------------

    /// @notice Permanently disables new wallet creation. Irreversible.
    ///         Use only if a bug is found in the deployed wallet implementation
    ///         to stop minting more vulnerable wallets. Existing wallets and
    ///         funds are unaffected. getWalletAddress() keeps working.
    function kill() external {
        if (msg.sender != owner) revert NotOwner();
        killed = true;
        emit FactoryKilled(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Address prediction (counterfactual, no gas cost)
    // -------------------------------------------------------------------------

    /// @notice Computes the deterministic address of a BVCCWallet before deploying it.
    /// @dev    The salt is derived only from (pubKeyX, pubKeyY).
    ///         Guardians are set after deployment via setGuardians(), so they do
    ///         NOT affect the address — the same key always produces the same
    ///         address on every network where this Factory is deployed.
    /// @param pubKeyX  X coordinate of the P-256 / WebAuthn public key (as bytes32)
    /// @param pubKeyY  Y coordinate of the P-256 / WebAuthn public key (as bytes32)
    /// @return         Deterministic address of the wallet
    function getWalletAddress(
        uint256 pubKeyX,
        uint256 pubKeyY
    ) public view returns (address) {
        bytes32 salt = keccak256(abi.encode(pubKeyX, pubKeyY));
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(BVCCSmartWalletV3).creationCode,
            abi.encode(bytes32(pubKeyX), bytes32(pubKeyY))
        ));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            initCodeHash
        )))));
    }

    // -------------------------------------------------------------------------
    // Deployment with CREATE2 — idempotent
    // -------------------------------------------------------------------------

    /// @notice Deploys a new BVCCWallet with CREATE2 and immediately sets its guardians.
    ///         If a wallet for the given public key already exists, returns it without
    ///         re-deploying (idempotent).
    /// @param pubKeyX   X coordinate of the P-256 / WebAuthn public key
    /// @param pubKeyY   Y coordinate of the P-256 / WebAuthn public key
    /// @param guardians 3 recovery addresses (2-of-3 guardian scheme)
    /// @return wallet   Address of the deployed (or pre-existing) wallet
    function createWallet(
        uint256 pubKeyX,
        uint256 pubKeyY,
        address[3] memory guardians,
        string calldata credentialId
    ) external returns (address wallet) {
        if (killed) revert FactoryKilledError();
        address predicted = getWalletAddress(pubKeyX, pubKeyY);
        if (predicted.code.length > 0) return predicted;

        bytes32 salt = keccak256(abi.encode(pubKeyX, pubKeyY));
        BVCCSmartWalletV3 w = new BVCCSmartWalletV3{salt: salt}(bytes32(pubKeyX), bytes32(pubKeyY));
        wallet = address(w);

        // setGuardians can only be called once (guarded by guardians[0] == address(0))
        w.setGuardians(guardians);

        emit WalletCreated(wallet, pubKeyX, pubKeyY, credentialId);
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    /// @notice Returns true if a wallet has already been deployed at the given address.
    function isDeployed(address wallet) external view returns (bool) {
        return wallet.code.length > 0;
    }
}
