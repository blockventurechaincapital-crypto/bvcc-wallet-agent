// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "../IBVCCValidatorV5.sol";

interface IBVCCHookRegistryUR {
    function isHookApproved(address hook) external view returns (bool);
}

/// @title BVCCUniversalRouterValidatorV5
/// @notice Deep validation of Uniswap Universal Router `execute` calls by an agent wallet.
///         Bound to one router address. Scope: ERC-20 to ERC-20 swaps, no native value.
///
///         Command bytes are accepted only when EXACTLY one of V3_SWAP_EXACT_IN (0x00),
///         V3_SWAP_EXACT_OUT (0x01) or V4_SWAP (0x10). Every other byte, including the
///         0x80 allow-revert flag and the external-integration commands from 0x40 up
///         (0x40 is a cross-chain deposit on the current router), is denied.
///         Every v3 recipient and every v4 TAKE recipient must be the wallet (or the
///         router's MSG_SENDER sentinel, which resolves to the wallet).
///
///         v4 SWAP_EXACT_IN is decoded hop by hop: every hop's hook must be none or
///         approved in the hook registry (a hook runs its own code during the swap), and
///         no hop may use the native currency.
///
///         Declares to the wallet every token of each v3 path, every v4 path currency and
///         every v4 SETTLE / TAKE currency, so their balances are measured.
contract BVCCUniversalRouterValidatorV5 is IBVCCValidatorV5 {
    bytes4 private constant EXECUTE_SELECTOR = 0x3593564c; // execute(bytes,bytes[],uint256)

    uint8 private constant V3_SWAP_EXACT_IN = 0x00;
    uint8 private constant V3_SWAP_EXACT_OUT = 0x01;
    uint8 private constant V4_SWAP = 0x10;

    uint8 private constant ACTION_SWAP_EXACT_IN = 0x07;
    uint8 private constant ACTION_SETTLE = 0x0b;
    uint8 private constant ACTION_TAKE = 0x0e;

    address private constant MSG_SENDER = address(1);
    address private constant NATIVE = address(0);
    uint256 private constant MAX_TOKENS = 30;

    /// @dev V4Router path hop and exact-input parameters, as encoded by the router.
    struct PathKey {
        address intermediateCurrency;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bytes hookData;
    }

    struct ExactInputParams {
        address currencyIn;
        PathKey[] path;
        uint128 amountIn;
        uint128 amountOutMinimum;
    }

    address public immutable UNIVERSAL_ROUTER;
    IBVCCHookRegistryUR public immutable HOOK_REGISTRY;

    error ZeroAddress();

    constructor(address universalRouter, address hookRegistry) {
        if (universalRouter == address(0) || hookRegistry == address(0)) revert ZeroAddress();
        UNIVERSAL_ROUTER = universalRouter;
        HOOK_REGISTRY = IBVCCHookRegistryUR(hookRegistry);
    }

    function validate(address, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool ok, address[] memory tokens, Cost[] memory costs, bool wantsPostCheck, bool chargeInflow)
    {
        tokens = new address[](MAX_TOKENS);
        if (target != UNIVERSAL_ROUTER || value != 0) return (false, tokens, costs, false, false);
        if (data.length < 4 || bytes4(data[0:4]) != EXECUTE_SELECTOR) return (false, tokens, costs, false, false);

        (bytes memory commands, bytes[] memory inputs,) = abi.decode(data[4:], (bytes, bytes[], uint256));
        if (commands.length == 0 || commands.length != inputs.length) return (false, tokens, costs, false, false);

        uint256 count;
        for (uint256 i = 0; i < commands.length; i++) {
            uint8 c = uint8(commands[i]);
            bool valid;
            if (c == V3_SWAP_EXACT_IN || c == V3_SWAP_EXACT_OUT) {
                (valid, count) = _v3(inputs[i], wallet, tokens, count);
            } else if (c == V4_SWAP) {
                (valid, count) = _v4(inputs[i], wallet, tokens, count);
            }
            if (!valid) return (false, tokens, costs, false, false);
        }
        assembly ("memory-safe") {
            mstore(tokens, count)
        }
        return (true, tokens, costs, false, false);
    }

    function validateAfter(address, address, address, bytes calldata) external pure returns (bool) {
        return true;
    }

    /// @dev input = abi.encode(address recipient, uint256 amount, uint256 limit, bytes path, bool payerIsUser).
    ///      path = token (20) | fee (3) | token (20) | ...
    function _v3(bytes memory input, address wallet, address[] memory tokens, uint256 count)
        private
        pure
        returns (bool, uint256)
    {
        (address recipient,,, bytes memory path,) = abi.decode(input, (address, uint256, uint256, bytes, bool));
        if (!_isWallet(recipient, wallet)) return (false, count);
        if (path.length < 43 || (path.length - 20) % 23 != 0) return (false, count);
        for (uint256 off = 0; off < path.length; off += 23) {
            address token;
            assembly ("memory-safe") {
                token := shr(96, mload(add(add(path, 0x20), off)))
            }
            bool added;
            (added, count) = _push(tokens, count, token);
            if (!added) return (false, count);
        }
        return (true, count);
    }

    /// @dev input = abi.encode(bytes actions, bytes[] params). Only SWAP_EXACT_IN, SETTLE
    ///      and TAKE are allowed; every TAKE recipient must be the wallet.
    function _v4(bytes memory input, address wallet, address[] memory tokens, uint256 count)
        private
        view
        returns (bool, uint256)
    {
        (bytes memory actions, bytes[] memory params) = abi.decode(input, (bytes, bytes[]));
        if (actions.length == 0 || actions.length != params.length) return (false, count);
        for (uint256 j = 0; j < actions.length; j++) {
            uint8 a = uint8(actions[j]);
            address currency;
            if (a == ACTION_SWAP_EXACT_IN) {
                bool valid;
                (valid, count) = _v4Swap(params[j], tokens, count);
                if (!valid) return (false, count);
                continue;
            } else if (a == ACTION_SETTLE) {
                (currency,,) = abi.decode(params[j], (address, uint256, bool));
            } else if (a == ACTION_TAKE) {
                address recipient;
                (currency, recipient,) = abi.decode(params[j], (address, address, uint256));
                if (!_isWallet(recipient, wallet)) return (false, count);
            } else {
                return (false, count);
            }
            if (currency == address(0)) return (false, count);
            bool added;
            (added, count) = _push(tokens, count, currency);
            if (!added) return (false, count);
        }
        return (true, count);
    }

    /// @dev Declares the input and every intermediate currency; every hop's hook must be
    ///      none or approved.
    function _v4Swap(bytes memory p, address[] memory tokens, uint256 count) private view returns (bool, uint256) {
        ExactInputParams memory swap = abi.decode(p, (ExactInputParams));
        if (swap.path.length == 0 || swap.currencyIn == NATIVE) return (false, count);
        bool added;
        (added, count) = _push(tokens, count, swap.currencyIn);
        if (!added) return (false, count);
        for (uint256 k = 0; k < swap.path.length; k++) {
            PathKey memory hop = swap.path[k];
            if (hop.intermediateCurrency == NATIVE) return (false, count);
            if (hop.hooks != address(0) && !HOOK_REGISTRY.isHookApproved(hop.hooks)) return (false, count);
            (added, count) = _push(tokens, count, hop.intermediateCurrency);
            if (!added) return (false, count);
        }
        return (true, count);
    }

    function _push(address[] memory tokens, uint256 count, address token) private pure returns (bool, uint256) {
        for (uint256 i = 0; i < count; i++) {
            if (tokens[i] == token) return (true, count);
        }
        if (count == MAX_TOKENS) return (false, count);
        tokens[count] = token;
        return (true, count + 1);
    }

    function _isWallet(address a, address wallet) private pure returns (bool) {
        return a == wallet || a == MSG_SENDER;
    }
}
