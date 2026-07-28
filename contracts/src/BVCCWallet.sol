// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {ERC7821} from "@openzeppelin/contracts/account/extensions/draft-ERC7821.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {AbstractSigner} from "@openzeppelin/contracts/utils/cryptography/signers/AbstractSigner.sol";
import {SignerP256} from "@openzeppelin/contracts/utils/cryptography/signers/SignerP256.sol";
import {SignerWebAuthn} from "@openzeppelin/contracts/utils/cryptography/signers/SignerWebAuthn.sol";
import {ERC7739} from "@openzeppelin/contracts/utils/cryptography/signers/draft-ERC7739.sol";

contract BVCCSmartWalletV4 is Account, EIP712, ERC7739, SignerP256, SignerWebAuthn, ERC7821, ERC721Holder, ERC1155Holder {
    using ERC7579Utils for *;

    // -------------------------------------------------------------------------
    // Fee configuration
    // -------------------------------------------------------------------------

    /// @notice Treasury that receives the protocol fee on every operation.
    address public constant BVCC_FEE_WALLET = 0x3e3eb089169a7315a994947465ce5f5FC3A307D4;

    uint256 private constant FEE_DENOMINATOR = 1_000_000;

    /// @notice Fee rate numerator — override in subcontracts to change the fee.
    ///         Default: 500 / 1_000_000 = 0.05%
    function _feeNumerator() internal view virtual returns (uint256) { return 500; }

    /// @notice ERC-20 transfer(address,uint256) selector
    bytes4 private constant TRANSFER_SELECTOR = bytes4(keccak256("transfer(address,uint256)"));

    /// @notice Max token addresses to scan per call (bounds gas)
    uint256 private constant MAX_SCAN_TOKENS = 10;

    /// @notice Gas cap for every balanceOf probe (snapshot + fee collection).
    ///         High enough for exotic tokens (rebasing aTokens/cTokens), low enough
    ///         that a gas-burning candidate (e.g. Arbitrum precompiles 0x64-0x6f)
    ///         cannot inflate eth_estimateGas: worst case is
    ///         (MAX_SCAN_TOKENS + 1) * 2 * PROBE_GAS_CAP ≈ 2.2M, vs 32M before the fix.
    uint256 private constant PROBE_GAS_CAP = 100_000;

    error AlreadyApproved();
    error ETHFeeFailed();
    error RecoveryActive();
    error InsufficientApprovals();
    error NoRecoveryInProgress();
    error OnlyWallet();
    error RecoveryAlreadyApproved();
    error TimelockNotExpired();
    error TokenFeeFailed();
    error NotGuardian();
    error InvalidGuardian();
    error InsufficientBalanceForFee();


    // -------------------------------------------------------------------------
    // Recovery — 2-of-3 guardian scheme
    // -------------------------------------------------------------------------

    event RecoveryInitiated(address indexed guardian, uint256 newSignerX, uint256 newSignerY);
    event RecoveryApproved(address indexed guardian, uint256 approvals);
    event RecoveryReadyToExecute(uint256 executeAfter);
    event RecoveryCancelled();
    event RecoveryExecuted(uint256 newSignerX, uint256 newSignerY);

    /// @notice The passkey credential this wallet answers to, announced by the wallet
    ///         itself in a passkey-signed call. Emitted here rather than by the factory so
    ///         it cannot be forged by whoever deploys the address. The hash is indexed so a
    ///         client holding a passkey rawId can find the wallet it belongs to; the full
    ///         id travels in the data; the most recent event from this wallet is the
    ///         current one, and only a passkey-signed call can emit it.
    event CredentialSet(bytes32 indexed credentialHash, bytes credentialId);

    /// @notice Delay between 2nd approval and execution — owner's reaction window.
    uint256 public constant RECOVERY_DELAY = 48 hours;

    address[3] public guardians;

    uint256 public pendingNewSignerX;
    uint256 public pendingNewSignerY;
    uint256 public recoveryApprovals;
    uint256 public recoveryReadyAt;   // timestamp after which executeRecovery is allowed
    mapping(address => bool) public hasApprovedRecovery;
    bool public recoveryInProgress;

    modifier onlyGuardian() {
        require(
            msg.sender == guardians[0] ||
            msg.sender == guardians[1] ||
            msg.sender == guardians[2],
            NotGuardian()
        );
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(bytes32 qx, bytes32 qy)
        EIP712("BVCCSmartWalletV4", "1")
        SignerP256(qx, qy)
    {}

    // -------------------------------------------------------------------------
    // Execute — 3-case fee logic
    // -------------------------------------------------------------------------

    /**
     * @dev Three fee cases:
     *
     *  Case 1 — ETH send (value > 0)
     *    Fee deducted from value before forwarding to recipient.
     *    Recipient receives (value - fee). Reverts if wallet has no ETH for fee.
     *
     *  Case 2 — Direct ERC-20 transfer (selector 0xa9059cbb)
     *    Fee is ADDITIONAL to the transfer amount.
     *    Reverts if wallet balance < amount + fee ("Insufficient balance for fee").
     *    Recipient always receives the exact amount specified.
     *
     *  Case 3 — DeFi / Swap (everything else)
     *    Scans calldata for token address patterns.
     *    Snapshots balances before execution.
     *    After execution: 0.05% of any token balance increase → BVCC_FEE_WALLET.
     *
     *  Recovery functions do NOT use execute — no fee.
     */
    function execute(bytes32 mode, bytes calldata executionData) public payable virtual override {
        if (!_erc7821AuthorizedExecutor(msg.sender, mode, executionData))
            revert AccountUnauthorized(msg.sender);
        if (!supportsExecutionMode(mode)) revert UnsupportedExecutionMode();

        Execution[] calldata batch = ERC7579Utils.decodeBatch(executionData);

        for (uint256 i = 0; i < batch.length; i++) {
            Execution calldata exec = batch[i];

            if (exec.value > 0 && exec.callData.length == 0) {
                // ── Case 1: ETH send (pure ETH transfer, no calldata) ─────────
                uint256 fee = (exec.value * _feeNumerator()) / FEE_DENOMINATOR;
                if (fee > 0) {
                    (bool feeSent,) = BVCC_FEE_WALLET.call{value: fee}("");
                    require(feeSent, ETHFeeFailed());
                }
                (bool ok, bytes memory ret) = exec.target.call{value: exec.value - fee}(exec.callData);
                if (!ok) assembly { revert(add(ret, 0x20), mload(ret)) }

            } else if (_isDirectTransfer(exec.callData)) {
                // ── Case 2: Direct ERC-20 transfer ───────────────────────────
                (address to, uint256 amount) = _decodeTransfer(exec.callData);
                uint256 fee = (amount * _feeNumerator()) / FEE_DENOMINATOR;

                if (fee > 0) {
                    require(
                        IERC20(exec.target).balanceOf(address(this)) >= amount + fee,
                        InsufficientBalanceForFee()
                    );
                }

                // Execute original transfer (recipient gets exact amount)
                (bool ok, bytes memory ret) = exec.target.call(exec.callData);
                if (!ok) assembly { revert(add(ret, 0x20), mload(ret)) }

                // Collect fee after transfer
                if (fee > 0) {
                    (bool feeOk,) = exec.target.call(
                        abi.encodeWithSelector(TRANSFER_SELECTOR, BVCC_FEE_WALLET, fee)
                    );
                    require(feeOk, TokenFeeFailed());
                }

                (to); // silence unused variable warning

            } else {
                // ── Case 3: DeFi / Swap — balance snapshot ───────────────────
                (address[] memory tokens, uint256[] memory balancesBefore) =
                    _snapshotFromCalldata(exec.target, exec.callData);

                (bool ok, bytes memory ret) = exec.target.call{value: exec.value}(exec.callData);
                if (!ok) assembly { revert(add(ret, 0x20), mload(ret)) }

                _collectFeesOnIncrease(tokens, balancesBefore);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Case 2 helpers
    // -------------------------------------------------------------------------

    function _isDirectTransfer(bytes calldata data) internal pure returns (bool) {
        if (data.length < 68) return false;
        bytes4 sel;
        assembly { sel := calldataload(data.offset) }
        return sel == TRANSFER_SELECTOR;
    }

    function _decodeTransfer(bytes calldata data) internal pure returns (address to, uint256 amount) {
        assembly {
            to     := calldataload(add(data.offset, 4))
            amount := calldataload(add(data.offset, 36))
        }
    }

    // -------------------------------------------------------------------------
    // Case 3 helpers
    // -------------------------------------------------------------------------

    /**
     * @dev Scans calldata in 32-byte chunks for ABI-encoded address patterns
     *      (top 12 bytes = 0, bottom 20 bytes non-zero). For each candidate,
     *      tries balanceOf() — only real ERC-20 tokens respond without revert.
     *      Returns up to MAX_SCAN_TOKENS tokens with their current balances.
     */
    function _snapshotFromCalldata(address target, bytes calldata data)
        internal view
        returns (address[] memory tokens, uint256[] memory balances)
    {
        address[] memory candidates = new address[](MAX_SCAN_TOKENS);
        uint256[] memory bals       = new uint256[](MAX_SCAN_TOKENS);
        uint256 found = 0;

        // Always check the call target (handles ERC-20 method calls besides transfer)
        if (found < MAX_SCAN_TOKENS) {
            (bool isToken, uint256 bal) = _tryBalanceOf(target);
            if (isToken) {
                candidates[found] = target;
                bals[found]       = bal;
                found++;
            }
        }

        // Scan calldata in 32-byte chunks, skipping the 4-byte selector so
        // ABI-encoded addresses (at offsets 4, 36, 68, ...) land on chunk boundaries.
        uint256 scanOffset = data.length >= 4 ? 4 : 0;
        uint256 chunks = (data.length - scanOffset) / 32;
        for (uint256 i = 0; i < chunks && found < MAX_SCAN_TOKENS; i++) {
            bytes32 chunk;
            assembly {
                chunk := calldataload(add(add(data.offset, scanOffset), mul(i, 32)))
            }
            // Address pattern: top 12 bytes zero, bottom 20 non-zero
            if (bytes12(chunk) == bytes12(0)) {
                address candidate = address(uint160(uint256(chunk)));
                if (
                    candidate != address(0)         &&
                    candidate != address(this)      &&
                    candidate != BVCC_FEE_WALLET    &&
                    candidate != target             &&
                    !_inArray(candidates, found, candidate)
                ) {
                    (bool isToken, uint256 bal) = _tryBalanceOf(candidate);
                    if (isToken) {
                        candidates[found] = candidate;
                        bals[found]       = bal;
                        found++;
                    }
                }
            }
        }

        tokens   = new address[](found);
        balances = new uint256[](found);
        for (uint256 i = 0; i < found; i++) {
            tokens[i]   = candidates[i];
            balances[i] = bals[i];
        }
    }

    /**
     * @dev After execution, for every token whose balance increased,
     *      transfers 0.05% of the increment to BVCC_FEE_WALLET.
     */
    function _collectFeesOnIncrease(
        address[] memory tokens,
        uint256[] memory balancesBefore
    ) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            // Gas-capped like _tryBalanceOf: a token that misbehaves after the swap
            // (or burns gas) must skip its fee, never starve or revert the user's call.
            (bool balOk, bytes memory balRet) = tokens[i].staticcall{gas: PROBE_GAS_CAP}(
                abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
            );
            if (!balOk || balRet.length < 32) continue;
            uint256 newBal = abi.decode(balRet, (uint256));
            if (newBal > balancesBefore[i]) {
                uint256 increase = newBal - balancesBefore[i];
                uint256 fee = (increase * _feeNumerator()) / FEE_DENOMINATOR;
                if (fee > 0) {
                    (bool ok,) = tokens[i].call(
                        abi.encodeWithSelector(TRANSFER_SELECTOR, BVCC_FEE_WALLET, fee)
                    );
                    require(ok, TokenFeeFailed());
                }
            }
        }
    }

    /// @dev Gas-capped probe. Arbitrum precompiles (0x64-0x6f) report bytecode
    ///      0xfe, so the code-length guard does not filter them, and calling them
    ///      consumes ALL forwarded gas (not a cheap revert). A real ERC-20
    ///      balanceOf needs well under PROBE_GAS_CAP, so the cap is harmless for
    ///      tokens and bounds the damage from any gas-burning candidate.
    function _tryBalanceOf(address token) internal view returns (bool, uint256) {
        if (token.code.length == 0) return (false, 0);
        (bool ok, bytes memory ret) = token.staticcall{gas: PROBE_GAS_CAP}(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
        );
        if (!ok || ret.length < 32) return (false, 0);
        return (true, abi.decode(ret, (uint256)));
    }

    function _inArray(address[] memory arr, uint256 len, address candidate)
        internal pure returns (bool)
    {
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == candidate) return true;
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // ERC-7821 authorization
    // -------------------------------------------------------------------------

    function _erc7821AuthorizedExecutor(
        address caller,
        bytes32 mode,
        bytes calldata executionData
    ) internal view virtual override returns (bool) {
        return caller == address(entryPoint()) || super._erc7821AuthorizedExecutor(caller, mode, executionData);
    }

    // -------------------------------------------------------------------------
    // Recovery — 2-of-3 guardian scheme
    // -------------------------------------------------------------------------

    /**
     * @notice Set the 2-of-3 recovery guardians. Callable once, by the wallet itself.
     * @dev Must be called via execute() — authenticated by the owner's passkey.
     *      Previously this was permissionless and the factory called it while deploying,
     *      which let anyone deploy someone else's deterministic address (it derives from
     *      the public key alone) and pick, permanently, who could rotate its owner. The
     *      self-call requirement moves that choice behind the passkey, so a squatter is
     *      left with a wallet it cannot configure.
     *      Guardians are read nowhere but the recovery path: a wallet without them
     *      operates normally, it simply has no recovery until the owner sets them.
     *      Duplicates are rejected as hygiene — they cannot produce a solo takeover
     *      (approvals are tracked per address) but they silently degrade 2-of-3 to 2-of-2.
     *
     *      The set is REPLACEABLE by the owner: a guardian whose key is later lost or
     *      compromised would otherwise be permanent for the life of the wallet, leaving
     *      "create a new wallet and move the funds" as the only remedy. Rotation is
     *      refused while a recovery is in flight, so a stolen passkey cannot be used to
     *      swap the guardians out from under a recovery that is already under way; the
     *      owner cancels first, then rotates.
     */
    function setGuardians(address[3] calldata _guardians, bytes calldata credentialId) external {
        require(msg.sender == address(this), OnlyWallet());
        require(!recoveryInProgress, RecoveryActive());
        require(
            _guardians[0] != address(0) &&
            _guardians[1] != address(0) &&
            _guardians[2] != address(0),
            InvalidGuardian()
        );
        require(
            _guardians[0] != _guardians[1] &&
            _guardians[1] != _guardians[2] &&
            _guardians[0] != _guardians[2],
            InvalidGuardian()
        );
        guardians = _guardians;
        _setCredential(credentialId);
    }

    /// @notice Re-point the wallet at a new passkey credential id (e.g. after a guardian
    ///         recovery rotated the signer, or the owner moved to a new passkey).
    /// @dev Must be called via execute() — authenticated by the owner's passkey.
    function setCredentialId(bytes calldata newCredentialId) external {
        require(msg.sender == address(this), OnlyWallet());
        _setCredential(newCredentialId);
    }

    function _setCredential(bytes calldata credentialId) private {
        emit CredentialSet(keccak256(credentialId), credentialId);
    }

    // Fix 3: block reset once threshold is reached — prevents guardian griefing
    function initiateRecovery(uint256 newX, uint256 newY) external onlyGuardian {
        require(recoveryApprovals < 2, RecoveryAlreadyApproved());
        if (recoveryInProgress) {
            delete hasApprovedRecovery[guardians[0]];
            delete hasApprovedRecovery[guardians[1]];
            delete hasApprovedRecovery[guardians[2]];
            recoveryReadyAt = 0;
        }
        pendingNewSignerX = newX;
        pendingNewSignerY = newY;
        recoveryInProgress = true;
        hasApprovedRecovery[msg.sender] = true;
        recoveryApprovals = 1;
        emit RecoveryInitiated(msg.sender, newX, newY);
    }

    function approveRecovery() external onlyGuardian {
        require(recoveryInProgress, NoRecoveryInProgress());
        require(!hasApprovedRecovery[msg.sender], AlreadyApproved());
        hasApprovedRecovery[msg.sender] = true;
        recoveryApprovals++;
        emit RecoveryApproved(msg.sender, recoveryApprovals);
        // Fix 2: start 48h timelock when threshold is reached
        if (recoveryApprovals >= 2) {
            recoveryReadyAt = block.timestamp + RECOVERY_DELAY;
            emit RecoveryReadyToExecute(recoveryReadyAt);
        }
    }

    /// @dev Hook run after the signer has been rotated. Empty here; the agent wallet
    ///      overrides it to pause agents, because recovery is what an owner reaches for
    ///      when they believe they have been compromised — and an agent authorized by
    ///      the attacker would otherwise survive the rotation with its budget intact.
    function _afterRecovery() internal virtual {}

    // Fix 2: owner can cancel recovery using their WebAuthn key during the 48h window
    // Must be called via execute() — authenticated by Face ID / WebAuthn
    function cancelRecovery() external {
        require(msg.sender == address(this), OnlyWallet());
        require(recoveryInProgress, NoRecoveryInProgress());
        _resetRecovery();
        emit RecoveryCancelled();
    }

    // Fix 2: executeRecovery enforces the 48h timelock — only guardians can finalize
    function executeRecovery() external onlyGuardian {
        require(recoveryInProgress, NoRecoveryInProgress());
        require(recoveryApprovals >= 2, InsufficientApprovals());
        require(recoveryReadyAt > 0 && block.timestamp >= recoveryReadyAt, TimelockNotExpired());

        uint256 newX = pendingNewSignerX;
        uint256 newY = pendingNewSignerY;

        _setSigner(bytes32(newX), bytes32(newY));
        _resetRecovery();
        _afterRecovery();

        emit RecoveryExecuted(newX, newY);
    }

    function _resetRecovery() internal {
        recoveryInProgress = false;
        recoveryApprovals  = 0;
        recoveryReadyAt    = 0;
        delete hasApprovedRecovery[guardians[0]];
        delete hasApprovedRecovery[guardians[1]];
        delete hasApprovedRecovery[guardians[2]];
        pendingNewSignerX  = 0;
        pendingNewSignerY  = 0;
    }

    // -------------------------------------------------------------------------
    // Wallet type identifier — on-chain source of truth
    // -------------------------------------------------------------------------

    /// @notice Returns the wallet type: 0 = STANDARD, 1 = AGENT.
    /// @dev pure virtual — no storage read, free to call. Override in subtypes.
    function walletType() public pure virtual returns (uint8) {
        return 0;
    }

    // -------------------------------------------------------------------------
    // Required overrides
    // -------------------------------------------------------------------------

    function _rawSignatureValidation(bytes32 hash, bytes calldata signature)
        internal
        view
        override(SignerWebAuthn, AbstractSigner, SignerP256)
        returns (bool)
    {
        return super._rawSignatureValidation(hash, signature);
    }
}
