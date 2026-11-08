// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {BVCCPositionManagerValidatorV5} from "../src/validators/BVCCPositionManagerValidatorV5.sol";

/// @dev Models the relevant PositionManager v4 semantics: an approved operator may
///      modify a foreign NFT, and liquidity deltas net within modifyLiquidities.
///      This is a local model, not a fork of the deployed PositionManager.
contract AuditNettingPositionManager {
    BVCCPositionManagerValidatorV5.PoolKey private _key;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(uint256 => uint256) public liquidity;

    constructor(BVCCPositionManagerValidatorV5.PoolKey memory key_) {
        _key = key_;
    }

    function seed(uint256 tokenId, address owner, uint256 amount) external {
        ownerOf[tokenId] = owner;
        liquidity[tokenId] = amount;
    }

    function approve(address operator, uint256 tokenId) external {
        require(msg.sender == ownerOf[tokenId], "owner");
        getApproved[tokenId] = operator;
    }

    function getPoolAndPositionInfo(uint256)
        external
        view
        returns (BVCCPositionManagerValidatorV5.PoolKey memory, uint256)
    {
        return (_key, 0);
    }

    function modifyLiquidities(bytes calldata unlockData, uint256) external {
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        int256 delta;
        for (uint256 i; i < actions.length; i++) {
            uint8 action = uint8(actions[i]);
            if (action == 0x01 || action == 0x00) {
                (uint256 tokenId, uint256 amount,,,) =
                    abi.decode(params[i], (uint256, uint256, uint128, uint128, bytes));
                require(ownerOf[tokenId] == msg.sender || getApproved[tokenId] == msg.sender, "approval");
                if (action == 0x01) {
                    liquidity[tokenId] -= amount;
                    delta += int256(amount);
                } else {
                    liquidity[tokenId] += amount;
                    delta -= int256(amount);
                }
            } else if (action == 0x12) {
                abi.decode(params[i], (address));
            } else {
                revert("unsupported action");
            }
        }
        require(delta == 0, "unsettled");
    }
}

contract AuditRound2PoCsV5Test is V5Base {
    address private constant AGENT = address(0xA6E);
    address private constant ATTACKER = address(0xBAD);
    uint256 private constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    function test_Round2_PM_ForeignApprovedPositionRejected() public {
        BVCCAgentWalletV5 wallet = _createAgent();
        MockToken token0 = new MockToken("T0");
        MockToken token1 = new MockToken("T1");
        AuditNettingPositionManager pm = new AuditNettingPositionManager(
            BVCCPositionManagerValidatorV5.PoolKey(address(token0), address(token1), 500, 10, address(0))
        );
        pm.seed(1, address(wallet), 100);
        pm.seed(2, ATTACKER, 0);
        vm.prank(ATTACKER);
        pm.approve(address(wallet), 2);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(block.timestamp + 30 days);
        p.allowedTokens = new address[](0);
        p.tokenMaxAmounts = new uint128[](0);
        p.tokenDailyLimits = new uint128[](0);
        p.tokenTotalBudgets = new uint128[](0);
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = address(pm);
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));

        BVCCPositionManagerValidatorV5 validator =
            new BVCCPositionManagerValidatorV5(address(pm), address(hookRegistry));
        vm.prank(ADMIN);
        registry.proposeValidator(address(pm), address(validator));
        vm.warp(block.timestamp + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(address(pm));
        _self(
            address(wallet),
            abi.encodeCall(
                BVCCAgentWalletV5.setAgentCallPolicy,
                (AGENT, address(pm), bytes4(0xdd46508f), ALLOWED_DEEP)
            )
        );

        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(uint256(1), uint256(100), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(uint256(2), uint256(100), uint128(0), uint128(0), bytes(""));
        params[2] = abi.encode(address(token0));
        params[3] = abi.encode(address(token1));
        bytes memory data = abi.encodeWithSelector(
            bytes4(0xdd46508f), abi.encode(hex"01001212", params), block.timestamp + 1 days
        );
        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.PolicyValidationFailed.selector);
        wallet.executeAsAgent(_mode(), _one(address(pm), 0, data));

        assertEq(pm.liquidity(1), 100, "wallet-owned position untouched");
        assertEq(pm.liquidity(2), 0, "attacker-owned position not credited");
    }
}
