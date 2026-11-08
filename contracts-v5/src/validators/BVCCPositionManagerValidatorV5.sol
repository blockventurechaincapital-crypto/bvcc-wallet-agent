// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IBVCCValidatorV5} from "../IBVCCValidatorV5.sol";

interface IBVCCHookRegistryV5 {
    function isHookApproved(address hook) external view returns (bool);
}

interface IPositionManagerV4 {
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (BVCCPositionManagerValidatorV5.PoolKey memory key, uint256 info);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
}

/// @title BVCCPositionManagerValidatorV5
/// @notice Deep validation of Uniswap v4 PositionManager `modifyLiquidities` calls by an
///         agent wallet. Bound to one PositionManager.
///
///         Exact action allowlist (v4 does not mask action bytes):
///           MINT_POSITION / INCREASE / DECREASE / BURN    liquidity
///           SETTLE / SETTLE_PAIR                          pay in, from the wallet
///           TAKE / TAKE_PAIR / SWEEP                      pay out, recipient = wallet
///           CLOSE_CURRENCY                                net delta to the wallet
///         Everything else is denied.
///         MINT_POSITION: the position owner must be the wallet and the pool hook must
///         be none or approved in the hook registry.
///         INCREASE: the position must be owned by the wallet (the PositionManager also
///         accepts approved operators, so a foreign position could otherwise be funded
///         from the wallet), must have no single-token approval (whoever holds it could
///         take the position away) and its pool hook must be none or approved.
///         One call may not both take liquidity out (DECREASE / BURN) and put liquidity in
///         (MINT / INCREASE): the PositionManager nets the two internally, so liquidity
///         would move between positions without any token movement the wallet can charge.
///         Moving liquidity takes two calls, and the withdrawal is charged as inflow.
///         DECREASE / BURN: the position must be owned by the wallet (an operator approval
///         from someone else must not let the agent withdraw their liquidity), and the
///         pool hook must be none or approved too, because v4 runs
///         the hook on removals as well. Leaving a pool whose hook was frozen is the
///         owner's call, through the owner's own execute.
///         INCREASE / DECREASE / BURN declare the pool currencies of the position.
///         Native value is only accepted when a native SETTLE consumes it.
///
///         Declares every currency named by the actions (pool currencies of a mint,
///         settled, taken, swept and closed currencies), so their balances are measured,
///         and asks the wallet to charge what the call brings in (value out of positions).
contract BVCCPositionManagerValidatorV5 is IBVCCValidatorV5 {
    bytes4 private constant MODIFY_LIQUIDITIES_SELECTOR = 0xdd46508f; // modifyLiquidities(bytes,uint256)

    uint8 private constant INCREASE_LIQUIDITY = 0x00;
    uint8 private constant DECREASE_LIQUIDITY = 0x01;
    uint8 private constant MINT_POSITION = 0x02;
    uint8 private constant BURN_POSITION = 0x03;
    uint8 private constant SETTLE = 0x0b;
    uint8 private constant SETTLE_PAIR = 0x0d;
    uint8 private constant TAKE = 0x0e;
    uint8 private constant TAKE_PAIR = 0x11;
    uint8 private constant CLOSE_CURRENCY = 0x12;
    uint8 private constant SWEEP = 0x14;

    address private constant MSG_SENDER = address(1);
    address private constant NATIVE = address(0);
    uint256 private constant MAX_TOKENS = 30;

    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct Scan {
        address[] tokens;
        uint256 count;
        bool nativeSettle;
        bool adds;
        bool removes;
    }

    address public immutable POSITION_MANAGER;
    IBVCCHookRegistryV5 public immutable HOOK_REGISTRY;

    error ZeroAddress();

    constructor(address positionManager, address hookRegistry) {
        if (positionManager == address(0) || hookRegistry == address(0)) revert ZeroAddress();
        POSITION_MANAGER = positionManager;
        HOOK_REGISTRY = IBVCCHookRegistryV5(hookRegistry);
    }

    function validate(address, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool ok, address[] memory tokens, Cost[] memory costs, bool wantsPostCheck, bool chargeInflow)
    {
        Scan memory sc = Scan(new address[](MAX_TOKENS), 0, false, false, false);
        tokens = sc.tokens;
        if (target != POSITION_MANAGER) return (false, tokens, costs, false, false);
        if (data.length < 4 || bytes4(data[0:4]) != MODIFY_LIQUIDITIES_SELECTOR) return (false, tokens, costs, false, false);

        (bytes memory unlockData,) = abi.decode(data[4:], (bytes, uint256));
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        if (actions.length == 0 || actions.length != params.length) return (false, tokens, costs, false, false);

        for (uint256 i = 0; i < actions.length; i++) {
            if (!_action(uint8(actions[i]), params[i], wallet, sc)) return (false, tokens, costs, false, false);
        }
        if (sc.adds && sc.removes) return (false, tokens, costs, false, false);
        if (value > 0 && !sc.nativeSettle) return (false, tokens, costs, false, false);
        uint256 count = sc.count;
        assembly ("memory-safe") {
            mstore(tokens, count)
        }
        // Whatever the call brings in comes out of liquidity positions, which the wallet
        // does not measure (decreases, burns, collected fees): charge it.
        return (true, tokens, costs, false, true);
    }

    function validateAfter(address, address, address, bytes calldata) external pure returns (bool) {
        return true;
    }

    function _action(uint8 a, bytes memory p, address wallet, Scan memory sc) private view returns (bool) {
        if (a == MINT_POSITION) {
            (PoolKey memory key,,,,,, address owner,) =
                abi.decode(p, (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
            if (!_isWallet(owner, wallet)) return false;
            if (key.hooks != address(0) && !HOOK_REGISTRY.isHookApproved(key.hooks)) return false;
            sc.adds = true;
            return _push(sc, key.currency0) && _push(sc, key.currency1);
        }
        if (a == INCREASE_LIQUIDITY) {
            // Only into the wallet's own, unapproved positions, in pools whose hook is still approved.
            uint256 tokenId = abi.decode(p, (uint256));
            IPositionManagerV4 pm = IPositionManagerV4(POSITION_MANAGER);
            if (pm.ownerOf(tokenId) != wallet || pm.getApproved(tokenId) != address(0)) return false;
            sc.adds = true;
            return _position(tokenId, sc);
        }
        if (a == DECREASE_LIQUIDITY || a == BURN_POSITION) {
            // Only from the wallet's own positions: an operator approval from someone else
            // must not let the agent withdraw or burn their liquidity.
            uint256 tokenId = abi.decode(p, (uint256));
            if (IPositionManagerV4(POSITION_MANAGER).ownerOf(tokenId) != wallet) return false;
            sc.removes = true;
            return _position(tokenId, sc);
        }
        if (a == SETTLE) {
            (address currency,,) = abi.decode(p, (address, uint256, bool));
            if (currency == NATIVE) sc.nativeSettle = true;
            return _push(sc, currency);
        }
        if (a == SETTLE_PAIR) {
            (address c0, address c1) = abi.decode(p, (address, address));
            if (c0 == NATIVE || c1 == NATIVE) sc.nativeSettle = true;
            return _push(sc, c0) && _push(sc, c1);
        }
        if (a == TAKE) {
            (address currency, address recipient,) = abi.decode(p, (address, address, uint256));
            return _isWallet(recipient, wallet) && _push(sc, currency);
        }
        if (a == TAKE_PAIR) {
            (address c0, address c1, address recipient) = abi.decode(p, (address, address, address));
            return _isWallet(recipient, wallet) && _push(sc, c0) && _push(sc, c1);
        }
        if (a == SWEEP) {
            (address currency, address to) = abi.decode(p, (address, address));
            return _isWallet(to, wallet) && _push(sc, currency);
        }
        if (a == CLOSE_CURRENCY) {
            address currency = abi.decode(p, (address));
            return _push(sc, currency);
        }
        return false;
    }

    /// @dev The position's pool hook must be none or approved (it runs on every liquidity
    ///      change); its pool currencies are declared.
    function _position(uint256 tokenId, Scan memory sc) private view returns (bool) {
        (PoolKey memory key,) = IPositionManagerV4(POSITION_MANAGER).getPoolAndPositionInfo(tokenId);
        if (key.hooks != address(0) && !HOOK_REGISTRY.isHookApproved(key.hooks)) return false;
        return _push(sc, key.currency0) && _push(sc, key.currency1);
    }

    /// @dev Native currency is measured by the wallet as value, not as a token.
    function _push(Scan memory sc, address token) private pure returns (bool) {
        if (token == NATIVE) return true;
        for (uint256 i = 0; i < sc.count; i++) {
            if (sc.tokens[i] == token) return true;
        }
        if (sc.count == MAX_TOKENS) return false;
        sc.tokens[sc.count] = token;
        sc.count++;
        return true;
    }

    function _isWallet(address a, address wallet) private pure returns (bool) {
        return a == wallet || a == MSG_SENDER;
    }
}
