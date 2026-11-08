// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {ERC7821} from "@openzeppelin/contracts/account/extensions/draft-ERC7821.sol";
import {ERC4337Utils} from "@openzeppelin/contracts/account/utils/draft-ERC4337Utils.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {AbstractSigner} from "@openzeppelin/contracts/utils/cryptography/signers/AbstractSigner.sol";
import {SignerP256} from "@openzeppelin/contracts/utils/cryptography/signers/SignerP256.sol";
import {SignerWebAuthn} from "@openzeppelin/contracts/utils/cryptography/signers/SignerWebAuthn.sol";
import {ERC7739} from "@openzeppelin/contracts/utils/cryptography/signers/draft-ERC7739.sol";

/// @title BVCCSmartWalletV5
/// @notice Passkey (WebAuthn / P-256) ERC-4337 smart wallet with 2-of-3 guardian recovery.
///         Deployed once per chain as the logic of ERC-1167 clones created by the factory.
///         Not upgradeable.
contract BVCCSmartWalletV5 is
    Account,
    EIP712,
    ERC7739,
    SignerWebAuthn,
    ERC7821,
    ERC721Holder,
    ERC1155Holder,
    Initializable
{
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Domain tag of the passkey signature that binds a credential id to a wallet.
    string public constant CREDENTIAL_TAG = "BVCC-V5-credential";

    /// @notice Delay between a recovery proposal reaching two votes and its execution.
    uint256 public constant RECOVERY_DELAY = 48 hours;

    uint256 internal constant FEE_DENOMINATOR = 1_000_000;

    bytes4 internal constant TRANSFER_SELECTOR = 0xa9059cbb; // transfer(address,uint256)

    /// @dev Upper bound on tokens found in case-3 calldata for the fee scan.
    uint256 internal constant MAX_SCAN_TOKENS = 10;

    /// @dev Gas forwarded to every balanceOf probe. Enough for any real token, low
    ///      enough to bound a candidate that burns all forwarded gas.
    uint256 internal constant PROBE_GAS_CAP = 100_000;

    /// @dev Public key of the logic contract itself. Derived as the first valid
    ///      x-coordinate of sha256("BVCC-V5-no-signer" || counter), so nobody knows
    ///      its private key: the logic contract can never be operated.
    bytes32 private constant NO_SIGNER_X = 0xe92b401035a385ae5f48ba7d4dac659ae3de98ada3ad64c0e87160803ab9e2c8;
    bytes32 private constant NO_SIGNER_Y = 0x93afbecd454ecb146048c99bea919d3c59d2f3abd37e3b6e79e712d222a8eb22;

    /// @notice Treasury that receives the protocol fee (same address on every chain).
    address public immutable BVCC_FEE_WALLET;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyVoted();
    error ETHFeeFailed();
    error InsufficientBalanceForFee();
    error InvalidCredentialSignature();
    error InvalidGuardian();
    error InvalidPublicKey();
    error NoRecoveryArmed();
    error NoVote();
    error NotGuardian();
    error OnlyWallet();
    error RecoveryActive();
    error TimelockNotExpired();
    error TokenCallFailed();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice The passkey credential this wallet answers to. Emitted on every change.
    event CredentialSet(bytes32 indexed credentialHash, bytes credentialId);
    event GuardiansSet(address[3] guardians);
    event RecoveryVoted(address indexed guardian, bytes32 indexed proposalId, bytes32 newX, bytes32 newY);
    event RecoveryVoteWithdrawn(address indexed guardian, bytes32 indexed proposalId);
    event RecoveryArmed(bytes32 indexed proposalId, uint256 readyAt);
    event RecoveryDisarmed(bytes32 indexed proposalId);
    event RecoveryCancelled();
    event RecoveryExecuted(bytes32 indexed proposalId, bytes32 newX, bytes32 newY);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct RecoveryProposal {
        bytes32 x;
        bytes32 y;
        bytes credentialId;
    }

    bytes private _credentialId;

    address[3] private _guardians;

    /// @dev Current vote of each guardian slot (0 = no vote).
    bytes32[3] private _votes;

    /// @dev Content-addressed proposals: id = keccak256(abi.encode(x, y, keccak256(credentialId))).
    mapping(bytes32 => RecoveryProposal) private _proposals;

    bytes32 private _armedProposal;
    uint256 private _recoveryReadyAt;

    // -------------------------------------------------------------------------
    // Construction and initialization
    // -------------------------------------------------------------------------

    constructor(address feeWallet)
        EIP712("BVCCSmartWalletV5", "1")
        SignerP256(NO_SIGNER_X, NO_SIGNER_Y)
    {
        if (feeWallet == address(0)) revert ZeroAddress();
        BVCC_FEE_WALLET = feeWallet;
        _disableInitializers();
    }

    /// @notice Sets the owner passkey of a freshly cloned wallet. Called by the factory
    ///         in the same transaction that creates the clone.
    /// @param credentialSig WebAuthn assertion of the same key over
    ///        keccak256(abi.encode(CREDENTIAL_TAG, address(this), credential)).
    ///        Without it nobody can create this wallet, so whoever deploys it cannot
    ///        choose its credential.
    function initialize(bytes32 qx, bytes32 qy, bytes calldata credential, bytes calldata credentialSig)
        external
        initializer
    {
        _setSigner(qx, qy);
        bytes32 challenge = keccak256(abi.encode(CREDENTIAL_TAG, address(this), credential));
        if (!_rawSignatureValidation(challenge, credentialSig)) revert InvalidCredentialSignature();
        _setCredential(credential);
    }

    // -------------------------------------------------------------------------
    // ERC-4337: signatures carry a mandatory expiry
    // -------------------------------------------------------------------------

    /// @dev UserOperation signature = abi.encode(uint48 validUntil, bytes webauthnSig).
    ///      The passkey signs keccak256(abi.encode(userOpHash, validUntil)); the
    ///      EntryPoint rejects the operation once validUntil has passed.
    function _validateUserOp(PackedUserOperation calldata, bytes32 userOpHash, bytes calldata signature)
        internal
        virtual
        override
        returns (uint256)
    {
        (bool wellFormed, uint48 validUntil, bytes calldata sig) = _decodeUserOpSignature(signature);
        if (!wellFormed) return ERC4337Utils.SIG_VALIDATION_FAILED;
        bool valid = _rawSignatureValidation(keccak256(abi.encode(userOpHash, validUntil)), sig);
        return ERC4337Utils.packValidationData(valid, 0, validUntil);
    }

    function _decodeUserOpSignature(bytes calldata s)
        private
        pure
        returns (bool ok, uint48 validUntil, bytes calldata sig)
    {
        sig = s[0:0];
        if (s.length < 0x60) return (false, 0, sig);
        uint256 until = uint256(bytes32(s[0x00:0x20]));
        uint256 offset = uint256(bytes32(s[0x20:0x40]));
        uint256 len = uint256(bytes32(s[0x40:0x60]));
        if (until == 0 || until > type(uint48).max || offset != 0x40 || len > s.length - 0x60) {
            return (false, 0, sig);
        }
        return (true, uint48(until), s[0x60:0x60 + len]);
    }

    // -------------------------------------------------------------------------
    // Execute (ERC-7821 batches) with protocol fee
    // -------------------------------------------------------------------------

    /// @notice Executes a batch. Fee cases:
    ///   1. Native send (value > 0, no calldata): fee taken out of the value.
    ///   2. ERC-20 transfer(to, amount): fee charged on top; the recipient gets `amount`.
    ///   3. Anything else: fee on every balance increase of tokens found in the calldata.
    function execute(bytes32 mode, bytes calldata executionData) public payable virtual override {
        if (!_erc7821AuthorizedExecutor(msg.sender, mode, executionData)) revert AccountUnauthorized(msg.sender);
        if (!supportsExecutionMode(mode)) revert UnsupportedExecutionMode();

        Execution[] calldata batch = ERC7579Utils.decodeBatch(executionData);
        for (uint256 i = 0; i < batch.length; i++) {
            Execution calldata exec = batch[i];
            if (exec.value > 0 && exec.callData.length == 0) {
                uint256 fee = (exec.value * _feeNumerator()) / FEE_DENOMINATOR;
                if (fee > 0) {
                    (bool feeSent,) = BVCC_FEE_WALLET.call{value: fee}("");
                    if (!feeSent) revert ETHFeeFailed();
                }
                _call(exec.target, exec.value - fee, exec.callData);
            } else if (_isTokenCall(exec.callData, TRANSFER_SELECTOR)) {
                (, uint256 amount) = _decodeAddressAmount(exec.callData);
                uint256 fee = (amount * _feeNumerator()) / FEE_DENOMINATOR;
                if (fee > 0) {
                    (bool probed, uint256 bal) = _tryBalanceOf(exec.target);
                    if (!probed || bal < amount + fee) revert InsufficientBalanceForFee();
                }
                _tokenCall(exec.target, exec.value, exec.callData);
                if (fee > 0) IERC20(exec.target).safeTransfer(BVCC_FEE_WALLET, fee);
            } else {
                (address[] memory tokens, uint256[] memory before) = _snapshotFromCalldata(exec.target, exec.callData);
                _call(exec.target, exec.value, exec.callData);
                _collectFeesOnIncrease(tokens, before);
            }
        }
    }

    function _feeNumerator() internal view virtual returns (uint256) {
        return 500; // 0.05 %
    }

    function _erc7821AuthorizedExecutor(address caller, bytes32 mode, bytes calldata executionData)
        internal
        view
        virtual
        override
        returns (bool)
    {
        return caller == address(entryPoint()) || super._erc7821AuthorizedExecutor(caller, mode, executionData);
    }

    function _call(address target, uint256 value, bytes calldata data) internal returns (bytes memory ret) {
        bool ok;
        (ok, ret) = target.call{value: value}(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }

    /// @dev Token call with SafeERC20 semantics: empty return data (from a contract)
    ///      or an ABI-encoded `true` succeed; `false` or malformed data revert.
    function _tokenCall(address token, uint256 value, bytes calldata data) internal {
        bytes memory ret = _call(token, value, data);
        if (ret.length == 0) {
            if (token.code.length == 0) revert TokenCallFailed();
        } else if (ret.length < 32 || abi.decode(ret, (uint256)) != 1) {
            revert TokenCallFailed();
        }
    }

    function _isTokenCall(bytes calldata data, bytes4 selector) internal pure returns (bool) {
        return data.length >= 68 && bytes4(data[0:4]) == selector;
    }

    function _decodeAddressAmount(bytes calldata data) internal pure returns (address account, uint256 amount) {
        assembly ("memory-safe") {
            account := calldataload(add(data.offset, 4))
            amount := calldataload(add(data.offset, 36))
        }
    }

    /// @dev Finds the target and every address-shaped calldata word that answers
    ///      balanceOf, up to MAX_SCAN_TOKENS, with their current balances.
    function _snapshotFromCalldata(address target, bytes calldata data)
        internal
        view
        returns (address[] memory tokens, uint256[] memory balances)
    {
        tokens = new address[](MAX_SCAN_TOKENS);
        balances = new uint256[](MAX_SCAN_TOKENS);
        uint256 found;
        (bool isToken, uint256 bal) = _tryBalanceOf(target);
        if (isToken) {
            tokens[0] = target;
            balances[0] = bal;
            found = 1;
        }
        uint256 words = data.length < 4 ? 0 : (data.length - 4) / 32;
        for (uint256 i = 0; i < words && found < MAX_SCAN_TOKENS; i++) {
            bytes32 word = bytes32(data[4 + i * 32:36 + i * 32]);
            if (bytes12(word) != bytes12(0)) continue;
            address candidate = address(uint160(uint256(word)));
            if (
                candidate == address(0) || candidate == address(this) || candidate == BVCC_FEE_WALLET
                    || _contains(tokens, found, candidate)
            ) continue;
            (isToken, bal) = _tryBalanceOf(candidate);
            if (isToken) {
                tokens[found] = candidate;
                balances[found] = bal;
                found++;
            }
        }
        assembly ("memory-safe") {
            mstore(tokens, found)
            mstore(balances, found)
        }
    }

    function _collectFeesOnIncrease(address[] memory tokens, uint256[] memory before) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            (bool ok, uint256 bal) = _tryBalanceOf(tokens[i]);
            if (!ok || bal <= before[i]) continue;
            uint256 fee = ((bal - before[i]) * _feeNumerator()) / FEE_DENOMINATOR;
            if (fee > 0) IERC20(tokens[i]).safeTransfer(BVCC_FEE_WALLET, fee);
        }
    }

    /// @dev Gas-capped balanceOf that copies at most 32 bytes of return data.
    function _tryBalanceOf(address token) internal view returns (bool ok, uint256 bal) {
        if (token.code.length == 0) return (false, 0);
        uint256 cap = PROBE_GAS_CAP;
        assembly ("memory-safe") {
            let ptr := mload(0x40)
            mstore(ptr, shl(224, 0x70a08231))
            mstore(add(ptr, 4), address())
            let success := staticcall(cap, token, ptr, 0x24, ptr, 0x20)
            ok := and(success, gt(returndatasize(), 0x1f))
            bal := mul(mload(ptr), ok)
        }
    }

    function _contains(address[] memory list, uint256 len, address a) internal pure returns (bool) {
        for (uint256 i = 0; i < len; i++) {
            if (list[i] == a) return true;
        }
        return false;
    }

    function _onlySelf() internal view {
        if (msg.sender != address(this)) revert OnlyWallet();
    }

    // -------------------------------------------------------------------------
    // Credential
    // -------------------------------------------------------------------------

    /// @notice WebAuthn credential id of the owner passkey.
    function credentialId() external view returns (bytes memory) {
        return _credentialId;
    }

    /// @notice Re-points the wallet at another credential id of the same key. Passkey only.
    function setCredentialId(bytes calldata newCredentialId) external {
        _onlySelf();
        _setCredential(newCredentialId);
    }

    function _setCredential(bytes memory id) private {
        _credentialId = id;
        emit CredentialSet(keccak256(id), id);
    }

    // -------------------------------------------------------------------------
    // Guardians and recovery (2 of 3, vote per proposal)
    // -------------------------------------------------------------------------

    function guardians() external view returns (address[3] memory) {
        return _guardians;
    }

    function recoveryVotes() external view returns (bytes32[3] memory) {
        return _votes;
    }

    function recoveryProposal(bytes32 id) external view returns (RecoveryProposal memory) {
        return _proposals[id];
    }

    function armedRecovery() external view returns (bytes32 proposalId, uint256 readyAt) {
        return (_armedProposal, _recoveryReadyAt);
    }

    /// @notice Replaces the three guardians. Passkey only. Refused while a recovery is
    ///         armed (cancel it first); clears any unarmed votes.
    function setGuardians(address[3] calldata newGuardians) external {
        _onlySelf();
        if (_armedProposal != bytes32(0)) revert RecoveryActive();
        address g0 = newGuardians[0];
        address g1 = newGuardians[1];
        address g2 = newGuardians[2];
        if (g0 == address(0) || g1 == address(0) || g2 == address(0) || g0 == g1 || g1 == g2 || g0 == g2) {
            revert InvalidGuardian();
        }
        delete _votes;
        _guardians = newGuardians;
        emit GuardiansSet(newGuardians);
    }

    /// @notice Votes for a concrete new owner key. A guardian holds one vote; voting
    ///         again moves it. Two matching votes arm the proposal for RECOVERY_DELAY.
    function voteRecovery(bytes32 newX, bytes32 newY, bytes calldata newCredentialId) external {
        uint256 slot = _guardianSlot(msg.sender);
        if (!P256.isValidPublicKey(newX, newY)) revert InvalidPublicKey();
        bytes32 id = keccak256(abi.encode(newX, newY, keccak256(newCredentialId)));
        if (_votes[slot] == id) revert AlreadyVoted();
        RecoveryProposal storage p = _proposals[id];
        if (p.x == bytes32(0) && p.y == bytes32(0)) {
            p.x = newX;
            p.y = newY;
            p.credentialId = newCredentialId;
        }
        _votes[slot] = id;
        emit RecoveryVoted(msg.sender, id, newX, newY);
        _reconcileRecovery();
    }

    /// @notice Withdraws the caller's own vote, also from an armed proposal. The armed
    ///         proposal stays armed (same readyAt) while two votes remain on it.
    function withdrawRecoveryVote() external {
        uint256 slot = _guardianSlot(msg.sender);
        bytes32 id = _votes[slot];
        if (id == bytes32(0)) revert NoVote();
        delete _votes[slot];
        emit RecoveryVoteWithdrawn(msg.sender, id);
        _reconcileRecovery();
    }

    /// @notice Cancels any recovery: votes, armed proposal and timer. Passkey only.
    function cancelRecovery() external {
        _onlySelf();
        _clearRecovery();
        emit RecoveryCancelled();
    }

    /// @notice Rotates the owner key and credential to the armed proposal once its delay passed.
    function executeRecovery() external {
        _guardianSlot(msg.sender);
        bytes32 id = _armedProposal;
        if (id == bytes32(0)) revert NoRecoveryArmed();
        if (block.timestamp < _recoveryReadyAt) revert TimelockNotExpired();
        RecoveryProposal storage p = _proposals[id];
        bytes32 newX = p.x;
        bytes32 newY = p.y;
        _setSigner(newX, newY);
        _setCredential(p.credentialId);
        _clearRecovery();
        _afterRecovery();
        emit RecoveryExecuted(id, newX, newY);
    }

    /// @dev Hook run after the owner key rotated. The agent wallet pauses its agents.
    function _afterRecovery() internal virtual {}

    function _guardianSlot(address account) private view returns (uint256) {
        for (uint256 i = 0; i < 3; i++) {
            if (_guardians[i] == account && account != address(0)) return i;
        }
        revert NotGuardian();
    }

    function _reconcileRecovery() private {
        bytes32 v0 = _votes[0];
        bytes32 v1 = _votes[1];
        bytes32 v2 = _votes[2];
        bytes32 armed = _armedProposal;
        if (armed != bytes32(0)) {
            uint256 count = (v0 == armed ? 1 : 0) + (v1 == armed ? 1 : 0) + (v2 == armed ? 1 : 0);
            if (count >= 2) return;
            _armedProposal = bytes32(0);
            _recoveryReadyAt = 0;
            emit RecoveryDisarmed(armed);
        }
        bytes32 candidate = bytes32(0);
        if (v0 != bytes32(0) && (v0 == v1 || v0 == v2)) candidate = v0;
        else if (v1 != bytes32(0) && v1 == v2) candidate = v1;
        if (candidate != bytes32(0)) {
            uint256 readyAt = block.timestamp + RECOVERY_DELAY;
            _armedProposal = candidate;
            _recoveryReadyAt = readyAt;
            emit RecoveryArmed(candidate, readyAt);
        }
    }

    function _clearRecovery() private {
        delete _votes;
        _armedProposal = bytes32(0);
        _recoveryReadyAt = 0;
    }

    // -------------------------------------------------------------------------
    // Misc
    // -------------------------------------------------------------------------

    /// @notice 0 = standard wallet, 1 = agent wallet.
    function walletType() public pure virtual returns (uint8) {
        return 0;
    }

    function _rawSignatureValidation(bytes32 hash, bytes calldata signature)
        internal
        view
        virtual
        override(AbstractSigner, SignerWebAuthn)
        returns (bool)
    {
        return super._rawSignatureValidation(hash, signature);
    }
}
