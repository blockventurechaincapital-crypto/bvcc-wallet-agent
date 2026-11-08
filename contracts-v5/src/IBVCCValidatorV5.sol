// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @notice Deep validation of agent protocol calls (executeAsAgent, case 3).
///         Implementations are stateless view contracts, always reached through
///         staticcall. They never hold funds and never receive approvals.
///         Returning ok = false, or reverting, denies the call.
interface IBVCCValidatorV5 {
    /// @notice An amount charged to the agent's budget on top of what is measured
    ///         leaving the wallet (for example the debt opened by a borrow).
    struct Cost {
        address token;
        uint256 amount;
    }

    /// @param agent   The agent EOA executing the batch.
    /// @param wallet  The agent wallet performing the call.
    /// @param target  The protocol contract being called.
    /// @param value   Native value forwarded with the call.
    /// @param data    Full calldata of the protocol call (selector included).
    /// @return ok             Whether the call is allowed.
    /// @return tokensToMeasure Tokens the call may move that the wallet must measure.
    /// @return costs          Extra amounts to charge to the agent's token budgets.
    /// @return wantsPostCheck Whether the wallet must call validateAfter once the batch ran.
    /// @return chargeInflow   Whether what this call brings into the wallet, in tokensToMeasure,
    ///                        is charged like an outflow. For withdrawals from positions the
    ///                        wallet does not measure (lending collateral, liquidity positions),
    ///                        so that value cannot leave in the same batch uncharged.
    function validate(address agent, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (
            bool ok,
            address[] memory tokensToMeasure,
            Cost[] memory costs,
            bool wantsPostCheck,
            bool chargeInflow
        );

    /// @notice Checks the state left by the call, after the whole batch executed.
    function validateAfter(address agent, address wallet, address target, bytes calldata data)
        external
        view
        returns (bool);
}
