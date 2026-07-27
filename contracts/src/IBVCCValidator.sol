// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Deep calldata validation for agent DeFi calls (executeAsAgent, Case 3).
///         Implementations are stateless view contracts: they never hold funds,
///         never receive approvals and cannot mutate state (always staticcalled).
///         Returning false — or reverting — denies the call (fail-closed).
interface IBVCCValidator {
    /// @param wallet  The agent wallet performing the call (recipients must pin to it).
    /// @param target  The protocol contract being called.
    /// @param value   Native value forwarded with the call.
    /// @param data    Full calldata of the protocol call (selector included).
    function validate(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool);
}
