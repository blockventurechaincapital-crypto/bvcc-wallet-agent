// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "../IBVCCValidatorV5.sol";

/// @title BVCCWrappedNativeValidatorV5
/// @notice Deep validation of wrap / unwrap calls by an agent wallet on the chain's
///         wrapped native token (WETH, WBNB, WPOL — the WETH9 interface). Bound to one
///         token contract.
///
///   deposit()          wraps the native value sent with the call. The wallet charges that
///                      value to the agent's native budget, so the wrapped token coming in
///                      is not charged a second time.
///   withdraw(amount)   unwraps; no native value. The wrapped token that leaves is measured
///                      and charged to its token budget; the native coin returns to the wallet.
///
///   Exactly these two calldata shapes; every other selector is denied (transfer and
///   approve never reach a validator: the wallet handles them as token calls). Neither call
///   names a recipient — both only move value between the wallet and the token contract.
contract BVCCWrappedNativeValidatorV5 is IBVCCValidatorV5 {
    bytes4 private constant DEPOSIT = 0xd0e30db0; // deposit()
    bytes4 private constant WITHDRAW = 0x2e1a7d4d; // withdraw(uint256)

    address public immutable WRAPPED_NATIVE;

    error ZeroAddress();

    constructor(address wrappedNative) {
        if (wrappedNative == address(0)) revert ZeroAddress();
        WRAPPED_NATIVE = wrappedNative;
    }

    function validate(address, address, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool ok, address[] memory tokens, Cost[] memory costs, bool wantsPostCheck, bool chargeInflow)
    {
        if (target != WRAPPED_NATIVE || data.length < 4) return (false, tokens, costs, false, false);
        bytes4 selector = bytes4(data[0:4]);
        bool wrap = selector == DEPOSIT && data.length == 4 && value > 0;
        bool unwrap = selector == WITHDRAW && data.length == 36 && value == 0;
        if (!wrap && !unwrap) return (false, tokens, costs, false, false);
        tokens = new address[](1);
        tokens[0] = WRAPPED_NATIVE;
        return (true, tokens, costs, false, false);
    }

    function validateAfter(address, address, address, bytes calldata) external pure returns (bool) {
        return true;
    }
}
