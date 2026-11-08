// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "../IBVCCValidatorV5.sol";

interface INonfungiblePositionManagerV3 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );
}

/// @title BVCCV3PositionManagerValidatorV5
/// @notice Deep validation of Uniswap v3 NonfungiblePositionManager calls by an agent
///         wallet. Bound to one NonfungiblePositionManager.
///
///   mint(MintParams)                  recipient = the wallet; the pool tokens are declared
///   increaseLiquidity(Params)         the position is the wallet's and has no single-token
///                                     approval (whoever holds one could take it away)
///   decreaseLiquidity(Params)         the position is the wallet's
///   collect(CollectParams)            the position is the wallet's; recipient = the wallet
///                                     (exactly: address(0) means the manager itself)
///   burn(tokenId)                     the position is the wallet's
///
///   Every other selector is denied — multicall, NFT transfers and approvals, refundETH,
///   sweepToken, unwrapWETH9 — and so is any native value. The two pool tokens are declared
///   so the wallet measures them, and what a call brings in is charged: withdrawn liquidity
///   and collected fees come out of a position the wallet does not measure.
///
///   Unlike the v4 PositionManager, every v3 call does one thing, so liquidity cannot move
///   between positions inside one call: a decrease only credits the position, and collect
///   pays the wallet.
contract BVCCV3PositionManagerValidatorV5 is IBVCCValidatorV5 {
    bytes4 private constant MINT = 0x88316456; // mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))
    bytes4 private constant INCREASE = 0x219f5d17; // increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256))
    bytes4 private constant DECREASE = 0x0c49ccbe; // decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))
    bytes4 private constant COLLECT = 0xfc6f7865; // collect((uint256,address,uint128,uint128))
    bytes4 private constant BURN = 0x42966c68; // burn(uint256)

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    address public immutable POSITION_MANAGER;

    error ZeroAddress();

    constructor(address positionManager) {
        if (positionManager == address(0)) revert ZeroAddress();
        POSITION_MANAGER = positionManager;
    }

    function validate(address, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool ok, address[] memory tokens, Cost[] memory costs, bool wantsPostCheck, bool chargeInflow)
    {
        if (target != POSITION_MANAGER || value != 0 || data.length < 4) return (false, tokens, costs, false, false);
        bytes4 selector = bytes4(data[0:4]);

        if (selector == MINT) {
            MintParams memory p = abi.decode(data[4:], (MintParams));
            if (p.recipient != wallet) return (false, tokens, costs, false, false);
            return (true, _pair(p.token0, p.token1), costs, false, true);
        }

        // Every other allowed call names an existing position as its first argument.
        if (selector != INCREASE && selector != DECREASE && selector != COLLECT && selector != BURN) {
            return (false, tokens, costs, false, false);
        }
        uint256 tokenId = abi.decode(data[4:36], (uint256));
        INonfungiblePositionManagerV3 pm = INonfungiblePositionManagerV3(POSITION_MANAGER);
        // An operator approval from someone else must not let the agent act on their position.
        if (pm.ownerOf(tokenId) != wallet) return (false, tokens, costs, false, false);

        if (selector == INCREASE) {
            if (pm.getApproved(tokenId) != address(0)) return (false, tokens, costs, false, false);
        } else if (selector == COLLECT) {
            (, address recipient,,) = abi.decode(data[4:], (uint256, address, uint128, uint128));
            if (recipient != wallet) return (false, tokens, costs, false, false);
        }

        (,, address token0, address token1,,,,,,,,) = pm.positions(tokenId);
        return (true, _pair(token0, token1), costs, false, true);
    }

    function validateAfter(address, address, address, bytes calldata) external pure returns (bool) {
        return true;
    }

    function _pair(address token0, address token1) private pure returns (address[] memory tokens) {
        tokens = new address[](2);
        tokens[0] = token0;
        tokens[1] = token1;
    }
}
