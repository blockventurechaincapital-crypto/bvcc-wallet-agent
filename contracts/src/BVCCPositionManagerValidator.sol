// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IBVCCValidator} from "./IBVCCValidator.sol";

interface IBVCCHookRegistry {
    function isHookApproved(address hook) external view returns (bool);
}

/**
 * @title BVCCPositionManagerValidator
 * @notice Deep-validation contract for Uniswap v4 `modifyLiquidities` calls made by
 *         a BVCC Agent Wallet (LP). Registered in BVCCValidatorRegistry for ONE
 *         specific PositionManager; the wallet defers to it when a PM policy sets
 *         DEEP_VALIDATION.
 *
 *         Stateless and immutable — it only ANSWERS yes/no and can never move funds
 *         (always staticcalled). Returning false, or reverting on malformed calldata,
 *         denies the call (fail-closed). It MAY staticcall the hook registry.
 *
 *         WHAT IT ENFORCES on `modifyLiquidities(bytes unlockData, uint256 deadline)`
 *         where `unlockData = abi.encode(bytes actions, bytes[] params)`:
 *          - target == the bound PositionManager, selector == modifyLiquidities.
 *          - EXACT action whitelist (v4 dispatches action bytes without masking):
 *              MINT_POSITION / INCREASE / DECREASE / BURN (liquidity)
 *              SETTLE / SETTLE_PAIR                        (pay IN, from the wallet)
 *              TAKE / TAKE_PAIR / SWEEP                    (pay OUT — recipient pinned)
 *              CLOSE_CURRENCY                              (net delta to msg.sender)
 *            Everything else (DONATE, SWAP*, TAKE_PORTION, TAKE_ALL, *_FROM_DELTAS,
 *            CLEAR_OR_TAKE, WRAP/UNWRAP, 6909, SUBSCRIBE, UNWIND…) is DENIED.
 *          - MINT_POSITION: the position `owner` must be the wallet, and the pool's
 *            `hooks` must be address(0) (no hook) OR approved in BVCCHookRegistry.
 *            This is the one gate for the hook: new funds only ever enter a chosen
 *            pool at mint; increase/decrease/burn act on a tokenId the PM already
 *            gates to the owner (`onlyIfApproved`), so they carry no recipient and
 *            inherit the pool of a position the wallet controls.
 *          - Every TAKE/TAKE_PAIR/SWEEP recipient must resolve to the wallet (or the
 *            v4 MSG_SENDER sentinel = address(1), which the router resolves to the
 *            caller). ADDRESS_THIS (address(2)) — which would strand funds in the PM
 *            for anyone to sweep — is therefore denied.
 *          - Native ETH: `value` may be > 0 only if the actions include a native
 *            SETTLE (currency == address(0)); otherwise the ETH would strand in the
 *            PM. Native dust is returned to the wallet via SWEEP(recipient = wallet).
 *
 *         WHY THE HOOK GATE: a v4 pool is identified by its PoolKey, which includes an
 *         arbitrary `hooks` contract. A malicious hook can keep almost everything via
 *         the add/remove hook delta, charge a ~99% fee, or revert on remove to trap
 *         funds — pinning the recipient does NOT protect. So MINT into a hooked pool
 *         is default-deny unless the hook is on the governed allowlist.
 *
 *         Residual (documented, out of scope): a position in a bad-hook pool RECEIVED
 *         by transfer can still lose value when operated on — but that requires the
 *         owner to accept a malicious LP NFT; the MINT gate covers all agent-initiated
 *         entries into a pool.
 */
contract BVCCPositionManagerValidator is IBVCCValidator {

    /// @dev modifyLiquidities(bytes unlockData, uint256 deadline)
    bytes4 private constant MODIFY_LIQUIDITIES_SELECTOR =
        bytes4(keccak256("modifyLiquidities(bytes,uint256)"));

    // v4 Actions (matched EXACTLY; v4 dispatches action bytes without masking).
    uint8 private constant INCREASE_LIQUIDITY = 0x00;
    uint8 private constant DECREASE_LIQUIDITY = 0x01;
    uint8 private constant MINT_POSITION      = 0x02;
    uint8 private constant BURN_POSITION      = 0x03;
    uint8 private constant SETTLE             = 0x0b;
    uint8 private constant SETTLE_PAIR        = 0x0d;
    uint8 private constant TAKE               = 0x0e;
    uint8 private constant TAKE_PAIR          = 0x11;
    uint8 private constant CLOSE_CURRENCY     = 0x12;
    uint8 private constant SWEEP              = 0x14;

    /// @dev v4 "the caller" sentinel — resolves to the wallet (msg.sender of modifyLiquidities).
    address private constant MSG_SENDER = address(1);
    /// @dev native currency in v4 PoolKeys.
    address private constant NATIVE = address(0);

    /// @dev v4 PoolKey ABI shape (Currency/IHooks are address at the ABI level).
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    /// @notice The single v4 PositionManager this validator is bound to.
    address public immutable POSITION_MANAGER;
    /// @notice The governed hook allowlist (same CREATE2 address on every chain).
    IBVCCHookRegistry public immutable HOOK_REGISTRY;

    constructor(address positionManager_, address hookRegistry_) {
        POSITION_MANAGER = positionManager_;
        HOOK_REGISTRY = IBVCCHookRegistry(hookRegistry_);
    }

    /// @inheritdoc IBVCCValidator
    function validate(address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (bool)
    {
        if (target != POSITION_MANAGER) return false;
        if (data.length < 4 || bytes4(data) != MODIFY_LIQUIDITIES_SELECTOR) return false;

        // Malformed encodings revert here → deny (fail-closed).
        (bytes memory unlockData, ) = abi.decode(data[4:], (bytes, uint256));
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        if (actions.length == 0 || actions.length != params.length) return false;

        bool hasNativeSettle = false;

        for (uint256 i = 0; i < actions.length; i++) {
            uint8 a = uint8(actions[i]);

            if (a == MINT_POSITION) {
                if (!_validMint(params[i], wallet)) return false;
            } else if (a == INCREASE_LIQUIDITY || a == DECREASE_LIQUIDITY || a == BURN_POSITION) {
                // Owner-gated by the PM (onlyIfApproved) → no recipient to pin.
                continue;
            } else if (a == SETTLE) {
                // (address currency, uint256 amount, bool payerIsUser) — pays IN.
                (address currency, , ) = abi.decode(params[i], (address, uint256, bool));
                if (currency == NATIVE) hasNativeSettle = true;
            } else if (a == SETTLE_PAIR) {
                // (address currency0, address currency1) — pays IN.
                (address c0, address c1) = abi.decode(params[i], (address, address));
                if (c0 == NATIVE || c1 == NATIVE) hasNativeSettle = true;
            } else if (a == TAKE_PAIR) {
                // (address currency0, address currency1, address recipient)
                (, , address recipient) = abi.decode(params[i], (address, address, address));
                if (!_isWallet(recipient, wallet)) return false;
            } else if (a == TAKE) {
                // (address currency, address recipient, uint256 amount)
                (, address recipient, ) = abi.decode(params[i], (address, address, uint256));
                if (!_isWallet(recipient, wallet)) return false;
            } else if (a == SWEEP) {
                // (address currency, address to)
                (, address to) = abi.decode(params[i], (address, address));
                if (!_isWallet(to, wallet)) return false;
            } else if (a == CLOSE_CURRENCY) {
                // Net delta settles/takes to msg.sender (the wallet); no external recipient.
                continue;
            } else {
                // Any other exact byte is denied.
                return false;
            }
        }

        // Native value must be consumed by a native SETTLE, else it strands in the PM.
        if (value > 0 && !hasNativeSettle) return false;
        return true;
    }

    /// @dev MINT_POSITION params:
    ///      (PoolKey, int24 tickLower, int24 tickUpper, uint256 liquidity,
    ///       uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)
    ///      Owner must be the wallet; the pool's hook must be none or approved.
    function _validMint(bytes memory p, address wallet) private view returns (bool) {
        (PoolKey memory key, , , , , , address owner, ) =
            abi.decode(p, (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));

        if (!_isWallet(owner, wallet)) return false;
        if (key.hooks != address(0) && !HOOK_REGISTRY.isHookApproved(key.hooks)) return false;
        return true;
    }

    function _isWallet(address a, address wallet) private pure returns (bool) {
        return a == wallet || a == MSG_SENDER;
    }
}
