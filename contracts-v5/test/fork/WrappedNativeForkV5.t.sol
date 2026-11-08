// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {BVCCWrappedNativeValidatorV5} from "../../src/validators/BVCCWrappedNativeValidatorV5.sol";

interface IWeth9 {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transferFrom(address, address, uint256) external returns (bool);
}

/// @notice The wrap / unwrap validator against the real WETH on an Arbitrum One fork.
contract WrappedNativeForkV5Test is V5Base {
    address private constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address private constant AGENT = address(0xA6E);
    address private constant STRANGER = address(0xBAD);
    uint256 private constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    BVCCAgentWalletV5 private wallet;
    BVCCWrappedNativeValidatorV5 private validator;

    function setUp() public override {
        string memory rpc = vm.envOr("ARBITRUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        super.setUp();

        wallet = _createAgent();
        vm.deal(address(wallet), 2 ether);

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.maxPerTxWei = 0.2 ether;
        p.dailyLimitWei = 1 ether;
        p.totalBudgetWei = 1 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = WETH;
        p.tokenMaxAmounts = new uint128[](1);
        p.tokenDailyLimits = new uint128[](1);
        p.tokenTotalBudgets = new uint128[](1);
        p.tokenMaxAmounts[0] = 0.1 ether;
        p.tokenDailyLimits[0] = 1 ether;
        p.tokenTotalBudgets[0] = 1 ether;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = WETH;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));

        validator = new BVCCWrappedNativeValidatorV5(WETH);
        vm.prank(ADMIN);
        registry.proposeValidator(WETH, address(validator));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(WETH);

        bytes4[3] memory selectors = [IWeth9.deposit.selector, IWeth9.withdraw.selector, IWeth9.transferFrom.selector];
        for (uint256 i; i < selectors.length; i++) {
            _self(
                address(wallet),
                abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, WETH, selectors[i], ALLOWED_DEEP))
            );
        }
    }

    function _live() private view returns (bool) {
        return block.chainid == 42161;
    }

    function _agent(uint256 value, bytes memory data) private {
        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _one(WETH, value, data));
    }

    function _expect(bytes4 err, uint256 value, bytes memory data) private {
        vm.prank(AGENT);
        vm.expectRevert(err);
        wallet.executeAsAgent(_mode(), _one(WETH, value, data));
    }

    /// @notice Wrap: the native value is charged to the native budget (with the fee);
    ///         the WETH that comes in is not charged again.
    function test_Fork_Wrap_ChargesNativeOnce() public {
        if (!_live()) return;
        uint256 wethBefore = IERC20(WETH).balanceOf(address(wallet));
        _agent(0.1 ether, abi.encodeCall(IWeth9.deposit, ()));
        assertEq(IERC20(WETH).balanceOf(address(wallet)) - wethBefore, 0.1 ether, "wrapped");
        assertEq(wallet.getDailySpent(AGENT), 0.1 ether + 0.00015 ether, "native value + fee charged");
        (, uint128 wethTotal) = wallet.getTokenSpent(AGENT, WETH);
        assertEq(wethTotal, 0, "incoming WETH not charged");
    }

    /// @notice Unwrap: the WETH that leaves is charged to the WETH budget (with the fee);
    ///         the native coin returns to the wallet.
    function test_Fork_Unwrap_ChargesWeth() public {
        if (!_live()) return;
        _agent(0.1 ether, abi.encodeCall(IWeth9.deposit, ()));
        uint256 ethBefore = address(wallet).balance;
        _agent(0, abi.encodeCall(IWeth9.withdraw, (0.05 ether)));
        assertEq(address(wallet).balance - ethBefore, 0.05 ether, "unwrapped to the wallet");
        (, uint128 wethTotal) = wallet.getTokenSpent(AGENT, WETH);
        assertEq(wethTotal, 0.05 ether + 0.000075 ether, "outgoing WETH + fee charged");
    }

    function test_Fork_Wrap_RespectsNativeLimits() public {
        if (!_live()) return;
        _expect(BVCCAgentLogicV5.ExceedsPerTxLimit.selector, 0.3 ether, abi.encodeCall(IWeth9.deposit, ()));
    }

    function test_Fork_Unwrap_RespectsTokenLimits() public {
        if (!_live()) return;
        vm.deal(address(wallet), 2 ether);
        _agent(0.1 ether, abi.encodeCall(IWeth9.deposit, ()));
        _agent(0.1 ether, abi.encodeCall(IWeth9.deposit, ()));
        _expect(BVCCAgentLogicV5.TokenBatchLimitExceeded.selector, 0, abi.encodeCall(IWeth9.withdraw, (0.15 ether)));
    }

    function test_Fork_WrappedNative_ShapesRefused() public {
        if (!_live()) return;
        bytes4 refused = BVCCAgentLogicV5.PolicyValidationFailed.selector;
        // deposit without value, or with trailing data
        _expect(refused, 0, abi.encodeCall(IWeth9.deposit, ()));
        _expect(refused, 0.01 ether, abi.encodePacked(IWeth9.deposit.selector, uint256(1)));
        // withdraw carrying value
        _agent(0.1 ether, abi.encodeCall(IWeth9.deposit, ()));
        _expect(refused, 1, abi.encodeCall(IWeth9.withdraw, (0.01 ether)));
        // any other function, even with a policy opened for it
        _expect(refused, 0, abi.encodeCall(IWeth9.transferFrom, (address(wallet), STRANGER, 0.01 ether)));
        assertEq(IERC20(WETH).balanceOf(STRANGER), 0, "nothing left the wallet");
    }

    function test_Fork_WrappedNative_BoundToItsToken() public {
        if (!_live()) return;
        (bool ok,,,,) = validator.validate(AGENT, address(wallet), STRANGER, 1, abi.encodeCall(IWeth9.deposit, ()));
        assertFalse(ok, "another target is refused");
    }
}
