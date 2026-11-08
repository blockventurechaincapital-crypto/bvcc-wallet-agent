// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCPositionManagerValidatorV5} from "../../src/validators/BVCCPositionManagerValidatorV5.sol";

interface IRedTeamLivePM {
    function ownerOf(uint256) external view returns (address);
    function approve(address, uint256) external;
    function balanceOf(address) external view returns (uint256);
    function nextTokenId() external view returns (uint256);
    function getPositionLiquidity(uint256) external view returns (uint128);
    function getPoolAndPositionInfo(uint256)
        external
        view
        returns (BVCCPositionManagerValidatorV5.PoolKey memory, uint256);
}

/// @title Red team regressions on real Uniswap v4 PositionManagers
/// @notice RT-01: an agent could withdraw or burn a third party's position that had
///         approved the wallet as operator. The validator now requires the wallet to own
///         the position on DECREASE / BURN. Checked on the five PositionManager versions.
///         RT-55: an agent could not burn the wallet's own position, because the wallet
///         measured the PositionManager's ERC-721 balanceOf as a token. ERC-721 contracts
///         are no longer measured.
///         Needs ARBITRUM_RPC, ETHEREUM_RPC, BASE_RPC, BSC_RPC and POLYGON_RPC.
contract RedTeamForkV5Test is V5Base {
    address internal constant PM_ARB = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
    address internal constant PM_ETH = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    address internal constant PM_BASE = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address internal constant PM_BSC = 0x7A4a5c919aE2541AeD11041A1AEeE68f1287f95b;
    address internal constant PM_POLY = 0x1Ec2eBf4F37E7363FDfe3551602425af0B3ceef9;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant AGENT = address(0xA6E);
    address internal constant ATTACKER = address(0xBADF00D);
    bytes4 internal constant MODIFY = 0xdd46508f;
    uint256 internal constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    address internal pm;

    function setUp() public override {}

    function _fork(string memory env, uint256 chainId, address pm_) internal {
        string memory rpc = vm.envOr(env, string(""));
        require(bytes(rpc).length > 0, string.concat("set ", env));
        vm.createSelectFork(rpc);
        super.setUp();
        assertEq(block.chainid, chainId, "wrong chain");
        pm = pm_;
    }

    // ---------------------------------------------------------------- RT-01

    function test_Fork_RT01_Arbitrum_ForeignPositionRejected() public {
        _fork("ARBITRUM_RPC", 42161, PM_ARB);
        _foreignPositionRejected();
    }

    function test_Fork_RT01_Ethereum_ForeignPositionRejected() public {
        _fork("ETHEREUM_RPC", 1, PM_ETH);
        _foreignPositionRejected();
    }

    function test_Fork_RT01_Base_ForeignPositionRejected() public {
        _fork("BASE_RPC", 8453, PM_BASE);
        _foreignPositionRejected();
    }

    function test_Fork_RT01_Bsc_ForeignPositionRejected() public {
        _fork("BSC_RPC", 56, PM_BSC);
        _foreignPositionRejected();
    }

    function test_Fork_RT01_Polygon_ForeignPositionRejected() public {
        _fork("POLYGON_RPC", 137, PM_POLY);
        _foreignPositionRejected();
    }

    /// @dev A third party approves the wallet on their position. The agent may neither
    ///      withdraw its liquidity nor burn it, and the position is untouched.
    function _foreignPositionRejected() internal {
        (uint256 tokenId, address victim) = _findPosition();
        IRedTeamLivePM live = IRedTeamLivePM(pm);
        (BVCCPositionManagerValidatorV5.PoolKey memory key,) = live.getPoolAndPositionInfo(tokenId);
        BVCCAgentWalletV5 wallet = _createAgent();
        vm.prank(victim);
        live.approve(address(wallet), tokenId);
        uint128 liquidity = live.getPositionLiquidity(tokenId);
        BVCCPositionManagerValidatorV5 validator = _setupAgent(wallet, key);

        bytes memory decrease = _call(hex"011212", _decreaseParams(tokenId, liquidity, key));
        bytes memory burn = _call(hex"031212", _decreaseParams(tokenId, 0, key));
        (bool ok,,,,) = validator.validate(AGENT, address(wallet), pm, 0, decrease);
        assertFalse(ok, "foreign DECREASE rejected");
        (ok,,,,) = validator.validate(AGENT, address(wallet), pm, 0, burn);
        assertFalse(ok, "foreign BURN rejected");

        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(pm, 0, decrease));
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(pm, 0, burn));

        assertEq(live.getPositionLiquidity(tokenId), liquidity, "victim position intact");
        assertEq(live.ownerOf(tokenId), victim, "victim still owns the NFT");
    }

    // ---------------------------------------------------------------- RT-55

    /// @dev The owner mints a position for the wallet; the agent burns it. The burn
    ///      lowers the PositionManager's NFT count, which must not read as an outflow.
    function test_Fork_RT55_AgentBurnsOwnPosition() public {
        _fork("ARBITRUM_RPC", 42161, PM_ARB);
        IRedTeamLivePM live = IRedTeamLivePM(pm);
        (BVCCPositionManagerValidatorV5.PoolKey memory key, uint256 info) = live.getPoolAndPositionInfo(1);
        assertEq(key.hooks, address(0), "position 1 is hookless");
        int24 lower = int24(uint24(info >> 8));
        int24 upper = int24(uint24(info >> 32));

        BVCCAgentWalletV5 wallet = _createAgent();
        deal(key.currency0, address(wallet), 1e24);
        deal(key.currency1, address(wallet), 1e18);
        _approvePermit2(wallet, key.currency0);
        _approvePermit2(wallet, key.currency1);

        uint256 tokenId = live.nextTokenId();
        bytes[] memory mint = new bytes[](2);
        mint[0] = abi.encode(
            key, lower, upper, uint256(1e12), type(uint128).max, type(uint128).max, address(wallet), bytes("")
        );
        mint[1] = abi.encode(key.currency0, key.currency1);
        _asOwner(address(wallet), pm, 0, _call(hex"020d", mint));
        assertEq(live.ownerOf(tokenId), address(wallet), "wallet owns the position");
        uint256 count = live.balanceOf(address(wallet));

        _setupAgent(wallet, key);
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _one(pm, 0, _call(hex"031212", _decreaseParams(tokenId, 0, key))));

        assertEq(live.balanceOf(address(wallet)), count - 1, "position burned");
        assertEq(live.getPositionLiquidity(tokenId), 0, "liquidity withdrawn");
    }

    /// @dev Round 5: the agent withdraws all liquidity and burns its own position in one
    ///      call (DECREASE then BURN). The withdrawal is charged as inflow.
    function test_Fork_RT55_AgentDecreasesThenBurnsOwnPosition() public {
        _fork("ARBITRUM_RPC", 42161, PM_ARB);
        IRedTeamLivePM live = IRedTeamLivePM(pm);
        (BVCCPositionManagerValidatorV5.PoolKey memory key, uint256 info) = live.getPoolAndPositionInfo(1);
        assertEq(key.hooks, address(0), "position 1 is hookless");

        BVCCAgentWalletV5 wallet = _createAgent();
        deal(key.currency0, address(wallet), 1e24);
        deal(key.currency1, address(wallet), 1e18);
        _approvePermit2(wallet, key.currency0);
        _approvePermit2(wallet, key.currency1);

        uint256 tokenId = live.nextTokenId();
        bytes[] memory mint = new bytes[](2);
        mint[0] = abi.encode(
            key,
            int24(uint24(info >> 8)),
            int24(uint24(info >> 32)),
            uint256(1e12),
            type(uint128).max,
            type(uint128).max,
            address(wallet),
            bytes("")
        );
        mint[1] = abi.encode(key.currency0, key.currency1);
        _asOwner(address(wallet), pm, 0, _call(hex"020d", mint));
        uint256 count = live.balanceOf(address(wallet));

        _setupAgent(wallet, key);
        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(tokenId, uint256(1e12), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(tokenId, uint128(0), uint128(0), bytes(""));
        params[2] = abi.encode(key.currency0);
        params[3] = abi.encode(key.currency1);
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _one(pm, 0, _call(hex"01031212", params)));

        assertEq(live.balanceOf(address(wallet)), count - 1, "position burned");
        assertEq(live.getPositionLiquidity(tokenId), 0, "liquidity withdrawn");
        (, uint128 charged0) = wallet.getTokenSpent(AGENT, key.currency0);
        (, uint128 charged1) = wallet.getTokenSpent(AGENT, key.currency1);
        assertGt(uint256(charged0) + charged1, 0, "withdrawal charged as inflow");
    }

    // ---------------------------------------------------------------- helpers

    /// @dev First minted, hookless position with liquidity in two ERC-20 currencies.
    function _findPosition() internal view returns (uint256, address) {
        IRedTeamLivePM live = IRedTeamLivePM(pm);
        for (uint256 id = 1; id < 200; id++) {
            try live.ownerOf(id) returns (address o) {
                if (o == address(0) || o.code.length != 0) continue;
                (BVCCPositionManagerValidatorV5.PoolKey memory k,) = live.getPoolAndPositionInfo(id);
                if (k.hooks != address(0) || k.currency0 == address(0)) continue;
                if (live.getPositionLiquidity(id) == 0) continue;
                return (id, o);
            } catch {}
        }
        revert("no suitable position in 1..199");
    }

    function _setupAgent(BVCCAgentWalletV5 wallet, BVCCPositionManagerValidatorV5.PoolKey memory key)
        internal
        returns (BVCCPositionManagerValidatorV5 validator)
    {
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](2);
        p.allowedTokens[0] = key.currency0;
        p.allowedTokens[1] = key.currency1;
        p.tokenMaxAmounts = new uint128[](2);
        p.tokenDailyLimits = new uint128[](2);
        p.tokenTotalBudgets = new uint128[](2);
        for (uint256 i; i < 2; i++) {
            p.tokenMaxAmounts[i] = type(uint128).max;
            p.tokenDailyLimits[i] = type(uint128).max;
            p.tokenTotalBudgets[i] = type(uint128).max;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = pm;
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = ATTACKER;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, pm, MODIFY, ALLOWED_DEEP)));

        validator = new BVCCPositionManagerValidatorV5(pm, address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(pm, address(validator));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(pm);
    }

    function _decreaseParams(uint256 tokenId, uint256 liquidity, BVCCPositionManagerValidatorV5.PoolKey memory key)
        internal
        pure
        returns (bytes[] memory params)
    {
        params = new bytes[](3);
        params[0] = liquidity == 0
            ? abi.encode(tokenId, uint128(0), uint128(0), bytes(""))
            : abi.encode(tokenId, liquidity, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0);
        params[2] = abi.encode(key.currency1);
    }

    function _call(bytes memory actions, bytes[] memory params) internal view returns (bytes memory) {
        return abi.encodeWithSelector(MODIFY, abi.encode(actions, params), vm.getBlockTimestamp() + 1 days);
    }

    function _approvePermit2(BVCCAgentWalletV5 wallet, address token) internal {
        _asOwner(address(wallet), token, 0, abi.encodeCall(IERC20.approve, (PERMIT2, type(uint256).max)));
        _asOwner(
            address(wallet),
            PERMIT2,
            0,
            abi.encodeWithSignature(
                "approve(address,address,uint160,uint48)",
                token,
                pm,
                type(uint160).max,
                uint48(vm.getBlockTimestamp() + 30 days)
            )
        );
    }
}
