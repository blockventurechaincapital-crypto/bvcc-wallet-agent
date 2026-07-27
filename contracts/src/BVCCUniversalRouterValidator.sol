// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IBVCCValidator} from "./IBVCCValidator.sol";

/**
 * @title BVCCUniversalRouterValidator
 * @notice Deep-validation contract for Uniswap Universal Router `execute` calls made
 *         by a BVCC Agent Wallet. Registered in BVCCValidatorRegistry for ONE specific
 *         UR address; the wallet defers to it when a UR policy sets DEEP_VALIDATION.
 *
 *         Stateless and immutable — it only ANSWERS yes/no and can never move funds
 *         (always staticcalled). Returning false, or reverting on malformed calldata,
 *         denies the call (fail-closed).
 *
 *         COMMAND SEMANTICS — the router masks a command byte with COMMAND_TYPE_MASK
 *         (0x7f on the current UR; 0x80 is FLAG_ALLOW_REVERT) and dispatches the
 *         result. Empirically confirmed on the deployed Arbitrum router
 *         (0x8b844f…1e6b): byte 0x40 dispatches to its OWN handler
 *         (ACROSS_V4_DEPOSIT_V3), NOT aliased to 0x00. So masking with 0x3f would
 *         let 0x40 masquerade as a v3 swap while the router bridges funds cross-chain.
 *
 *         To be robust to the exact mask AND to future command-table changes, this
 *         validator accepts a command byte ONLY when it is EXACTLY one of the three
 *         foundational swap commands — 0x00, 0x01, 0x10 — which every UR version
 *         dispatches identically. Every other byte (aliases, reserved bytes, the
 *         allow-revert flag, external-integration commands ≥ 0x40) is denied. This
 *         guarantees: if the validator accepts a command, the bound router interprets
 *         it exactly as the intended swap.
 *
 *         SCOPE (C1-UR MVP): ERC-20 → ERC-20 only. Every recipient (v3) and every v4
 *         TAKE must resolve to the wallet or the UR MSG_SENDER sentinel (1). Native
 *         in/out (WRAP_ETH / UNWRAP_WETH via the ADDRESS_THIS sentinel) is out of
 *         scope — routing output through ADDRESS_THIS lets a later SWEEP drain it.
 *         The owner can still do native swaps with Face ID.
 */
contract BVCCUniversalRouterValidator is IBVCCValidator {

    /// @dev execute(bytes commands, bytes[] inputs, uint256 deadline)
    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes,bytes[],uint256)"));

    // Whitelisted UR command bytes — matched EXACTLY (no masking). The 0x80 allow-revert
    // flag and every ≥0x40 external command are therefore rejected implicitly.
    uint8 private constant V3_SWAP_EXACT_IN  = 0x00;
    uint8 private constant V3_SWAP_EXACT_OUT = 0x01;
    uint8 private constant V4_SWAP           = 0x10;

    // v4 Router actions (matched exactly; v4 dispatches action bytes without masking).
    uint8 private constant ACTION_SWAP_EXACT_IN = 0x07;
    uint8 private constant ACTION_SETTLE        = 0x0b;
    uint8 private constant ACTION_TAKE          = 0x0e;

    /// @dev UR "the caller" sentinel — resolves to the wallet (msg.sender of execute).
    address private constant MSG_SENDER = address(1);

    /// @notice The single Universal Router this validator is bound to. A validator is
    ///         tied to one router address (≈ one router version/command table); a new
    ///         router deployment needs its own validator, registered via governance.
    address public immutable UNIVERSAL_ROUTER;

    constructor(address universalRouter_) {
        UNIVERSAL_ROUTER = universalRouter_;
    }

    /// @inheritdoc IBVCCValidator
    function validate(address wallet, address target, uint256, bytes calldata data)
        external
        view
        returns (bool)
    {
        // Bound to exactly one router (defense-in-depth against registry misconfig).
        if (target != UNIVERSAL_ROUTER) return false;
        if (data.length < 4 || bytes4(data) != EXECUTE_SELECTOR) return false;

        // Malformed encodings revert here → deny (fail-closed).
        (bytes memory commands, bytes[] memory inputs, ) =
            abi.decode(data[4:], (bytes, bytes[], uint256));
        if (commands.length == 0 || commands.length != inputs.length) return false;

        for (uint256 i = 0; i < commands.length; i++) {
            uint8 c = uint8(commands[i]);
            if (c == V3_SWAP_EXACT_IN || c == V3_SWAP_EXACT_OUT) {
                // input head word 0 = recipient (static address).
                address recipient = abi.decode(inputs[i], (address));
                if (!_isWallet(recipient, wallet)) return false;
            } else if (c == V4_SWAP) {
                if (!_validV4(inputs[i], wallet)) return false;
            } else {
                // Any other exact byte — aliases, allow-revert (0x80|...), reserved,
                // external-integration commands (≥0x40) — is denied.
                return false;
            }
        }
        return true;
    }

    function _isWallet(address r, address wallet) private pure returns (bool) {
        return r == wallet || r == MSG_SENDER;
    }

    /// @dev v4 input = abi.encode(bytes actions, bytes[] params). Only SWAP_EXACT_IN,
    ///      SETTLE and TAKE are allowed (matched exactly); every TAKE recipient must be
    ///      the wallet.
    function _validV4(bytes memory input, address wallet) private pure returns (bool) {
        (bytes memory actions, bytes[] memory params) = abi.decode(input, (bytes, bytes[]));
        if (actions.length == 0 || actions.length != params.length) return false;

        for (uint256 j = 0; j < actions.length; j++) {
            uint8 a = uint8(actions[j]);
            if (a == ACTION_SWAP_EXACT_IN || a == ACTION_SETTLE) {
                continue; // no external recipient
            } else if (a == ACTION_TAKE) {
                // takeParams = abi.encode(address currency, address recipient, uint256 amount)
                (, address recipient, ) = abi.decode(params[j], (address, address, uint256));
                if (!_isWallet(recipient, wallet)) return false;
            } else {
                return false; // TAKE_PORTION, SWEEP, etc. denied
            }
        }
        return true;
    }
}
