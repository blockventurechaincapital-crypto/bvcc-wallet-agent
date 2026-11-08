// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "../IBVCCValidatorV5.sol";

interface IAaveV3Pool {
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

/// @title BVCCAaveV3ValidatorV5
/// @notice Deep validation of Aave v3 Pool calls by an agent wallet. Bound to one Pool.
///
///   supply(asset, amount, onBehalfOf, referral)          onBehalfOf = wallet
///   withdraw(asset, amount, to)                          to = wallet; health post-check
///   borrow(asset, amount, rateMode, referral, onBehalfOf) onBehalfOf = wallet, variable
///                                                        rate; the amount is charged to
///                                                        the agent's budget of `asset`;
///                                                        health post-check
///   repay(asset, amount, rateMode, onBehalfOf)           onBehalfOf = wallet
///   setUserUseReserveAsCollateral(asset, bool)           health post-check
///   setUserEMode(categoryId)                             health post-check
///
///   Every other selector, and any native value, is denied. The asset is declared so
///   the wallet measures it. The post-check requires a health factor of at least
///   MIN_HEALTH_FACTOR after the whole batch (no debt counts as healthy).
contract BVCCAaveV3ValidatorV5 is IBVCCValidatorV5 {
    bytes4 private constant SUPPLY = 0x617ba037;
    bytes4 private constant WITHDRAW = 0x69328dec;
    bytes4 private constant BORROW = 0xa415bcad;
    bytes4 private constant REPAY = 0x573ade81;
    bytes4 private constant SET_COLLATERAL = 0x5a3b74b9;
    bytes4 private constant SET_EMODE = 0x28530a47;

    uint256 private constant VARIABLE_RATE = 2;

    /// @notice Lowest health factor (18 decimals) an agent may leave the position at.
    uint256 public constant MIN_HEALTH_FACTOR = 1.2e18;

    address public immutable POOL;

    error ZeroAddress();

    constructor(address pool) {
        if (pool == address(0)) revert ZeroAddress();
        POOL = pool;
    }

    function validate(address, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool ok, address[] memory tokens, Cost[] memory costs, bool wantsPostCheck, bool chargeInflow)
    {
        if (target != POOL || value != 0 || data.length < 4) return (false, tokens, costs, false, false);
        bytes4 sel = bytes4(data[0:4]);
        bytes calldata args = data[4:];

        if (sel == SUPPLY) {
            (address asset,, address onBehalfOf,) = abi.decode(args, (address, uint256, address, uint16));
            if (onBehalfOf != wallet) return (false, tokens, costs, false, false);
            return (true, _one(asset), costs, false, false);
        }
        if (sel == WITHDRAW) {
            (address asset,, address to) = abi.decode(args, (address, uint256, address));
            if (to != wallet) return (false, tokens, costs, false, false);
            // The withdrawn amount comes from collateral the wallet does not measure: charge it.
            return (true, _one(asset), costs, true, true);
        }
        if (sel == BORROW) {
            (address asset, uint256 amount, uint256 rateMode,, address onBehalfOf) =
                abi.decode(args, (address, uint256, uint256, uint16, address));
            if (onBehalfOf != wallet || rateMode != VARIABLE_RATE) return (false, tokens, costs, false, false);
            costs = new Cost[](1);
            costs[0] = Cost(asset, amount);
            return (true, _one(asset), costs, true, false);
        }
        if (sel == REPAY) {
            (address asset,,, address onBehalfOf) = abi.decode(args, (address, uint256, uint256, address));
            if (onBehalfOf != wallet) return (false, tokens, costs, false, false);
            return (true, _one(asset), costs, false, false);
        }
        if (sel == SET_COLLATERAL) {
            (address asset,) = abi.decode(args, (address, bool));
            return (true, _one(asset), costs, true, false);
        }
        if (sel == SET_EMODE) {
            abi.decode(args, (uint8));
            return (true, tokens, costs, true, false);
        }
        return (false, tokens, costs, false, false);
    }

    function validateAfter(address, address wallet, address, bytes calldata) external view returns (bool) {
        (, uint256 totalDebtBase,,,, uint256 healthFactor) = IAaveV3Pool(POOL).getUserAccountData(wallet);
        return totalDebtBase == 0 || healthFactor >= MIN_HEALTH_FACTOR;
    }

    function _one(address token) private pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = token;
    }
}
