// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {BVCCAaveV3ValidatorV5} from "../src/validators/BVCCAaveV3ValidatorV5.sol";

/// @dev Transfers work, but balanceOf reverts.
contract UnreadableToken is ERC20 {
    constructor() ERC20("U", "U") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function balanceOf(address) public pure override returns (uint256) {
        revert("unreadable");
    }
}

/// @dev Burns an extra 10 % from the sender on every transfer.
contract SenderTaxToken is ERC20 {
    constructor() ERC20("S", "S") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);
        _burn(msg.sender, amount / 10);
        return true;
    }
}

/// @dev Lending pool double: withdraw burns the collateral token and pays the underlying.
contract CollateralPool {
    MockToken public immutable underlying;
    MockToken public immutable aToken;

    constructor(MockToken underlying_) {
        underlying = underlying_;
        aToken = new MockToken("aT");
    }

    function mintCollateral(address to, uint256 amount) external {
        aToken.mint(to, amount);
        underlying.mint(address(this), amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(asset == address(underlying), "asset");
        aToken.transferFrom(msg.sender, address(0xdead), amount);
        underlying.transfer(to, amount);
        return amount;
    }

    function getUserAccountData(address) external pure returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return (0, 0, 0, 0, 0, type(uint256).max);
    }
}

contract AgentWalletV5Test is V5Base {
    BVCCAgentWalletV5 internal wallet;
    MockToken internal token;
    MockToken internal other;
    Puller internal puller;
    address internal agent = address(0xA6E);
    address internal constant RECIPIENT = address(0xCAFE);

    /// @dev Every protocol call needs a validator, so a usable policy is allowed + DEEP.
    uint256 internal constant PLAIN = 1 << 255;
    uint256 internal constant DEEP = 1 << 254;
    uint256 internal constant ALLOWED = PLAIN | DEEP;
    uint128 internal constant MAX = type(uint128).max;

    function setUp() public override {
        super.setUp();
        wallet = _createAgent();
        token = new MockToken("T");
        other = new MockToken("O");
        puller = new Puller();
        _openTarget(address(puller));
        token.mint(address(wallet), 1000e18);
        other.mint(address(wallet), 1000e18);
        vm.deal(address(wallet), 10 ether);
    }

    // ---------------------------------------------------------------- helpers

    function _params() internal view returns (BVCCAgentLogicV5.AuthorizeParams memory p) {
        p.agent = agent;
        p.maxPerTxWei = 1 ether;
        p.dailyLimitWei = 2 ether;
        p.totalBudgetWei = 5 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = address(token);
        p.tokenMaxAmounts = _u(200e18);
        p.tokenDailyLimits = _u(300e18);
        p.tokenTotalBudgets = _u(500e18);
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = address(puller);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = RECIPIENT;
    }

    function _u(uint128 v) internal pure returns (uint128[] memory a) {
        a = new uint128[](1);
        a[0] = v;
    }

    function _authorize(BVCCAgentLogicV5.AuthorizeParams memory p) internal {
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
    }

    function _setPolicy(address target, bytes4 sel, uint256 policy) internal {
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, target, sel, policy)));
    }

    function _run(address target, uint256 value, bytes memory data) internal {
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(target, value, data));
    }

    function _expectRun(bytes4 err, address target, uint256 value, bytes memory data) internal {
        vm.prank(agent);
        vm.expectRevert(err);
        wallet.executeAsAgent(_mode(), _one(target, value, data));
    }

    function _ownerApprove(address tok, address spender, uint256 amount) internal {
        _asOwner(address(wallet), tok, 0, abi.encodeCall(IERC20.approve, (spender, amount)));
    }

    // ---------------------------------------------------------------- authorization

    function test_Authorize_ExpiryMandatoryAndAtMostOneYear() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.expiry = 0;
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.InvalidExpiry.selector);
        wallet.authorizeAgent(p);
        p.expiry = uint64(vm.getBlockTimestamp() + 365 days + 1);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.InvalidExpiry.selector);
        wallet.authorizeAgent(p);
        p.expiry = uint64(vm.getBlockTimestamp() + 365 days);
        _authorize(p);
    }

    function test_Authorize_OnlyOwner() public {
        vm.expectRevert(BVCCSmartWalletV5.OnlyWallet.selector);
        wallet.authorizeAgent(_params());
    }

    function test_Authorize_RejectsContractAgent() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.agent = address(puller);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.AgentMustBeEOA.selector);
        wallet.authorizeAgent(p);
    }

    function test_Renew() public {
        _authorize(_params());
        vm.warp(vm.getBlockTimestamp() + 29 days);
        uint64 newExpiry = uint64(vm.getBlockTimestamp() + 365 days);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.renewAgent, (agent, newExpiry)));
        assertEq(wallet.getAgentPermission(agent).expiry, newExpiry);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.InvalidExpiry.selector);
        wallet.renewAgent(agent, uint64(vm.getBlockTimestamp() + 366 days));
    }

    function test_ExpiredAgentCannotRun() public {
        _authorize(_params());
        vm.warp(vm.getBlockTimestamp() + 30 days);
        _expectRun(BVCCAgentLogicV5.AgentPermissionsExpired.selector, RECIPIENT, 0.1 ether, "");
    }

    // ---------------------------------------------------------------- native

    function test_Native_WithinCaps() public {
        _authorize(_params());
        uint256 feeBefore = FEE.balance;
        _run(RECIPIENT, 0.5 ether, "");
        assertEq(RECIPIENT.balance, 0.5 ether, "recipient gets the full value");
        assertEq(FEE.balance - feeBefore, 0.00075 ether, "fee on top");
        assertEq(wallet.getAgentSpending(agent).totalSpentWei, 0.50075 ether);
        assertEq(wallet.getDailySpent(agent), 0.50075 ether);
    }

    function test_Native_ZeroCapAllowsNothing() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.maxPerTxWei = 0;
        _authorize(p);
        _expectRun(BVCCAgentLogicV5.ExceedsPerTxLimit.selector, RECIPIENT, 1, "");
    }

    function test_Native_EmptyRecipientsMeansNobody() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedRecipients = new address[](0);
        _authorize(p);
        _expectRun(BVCCAgentLogicV5.RecipientNotAllowed.selector, RECIPIENT, 0.1 ether, "");
    }

    /// Each run charges 0.998 + 0.001497 fee = 0.999497 ether.
    function test_Native_DailyAndTotal() public {
        _authorize(_params());
        _run(RECIPIENT, 0.998 ether, "");
        _run(RECIPIENT, 0.998 ether, "");
        _expectRun(BVCCAgentLogicV5.DailyLimitExceeded.selector, RECIPIENT, 0.01 ether, "");
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _run(RECIPIENT, 0.998 ether, "");
        _run(RECIPIENT, 0.998 ether, "");
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _run(RECIPIENT, 0.998 ether, "");
        _expectRun(BVCCAgentLogicV5.TotalBudgetExceeded.selector, RECIPIENT, 0.01 ether, "");
    }

    function test_Native_FeeCountsInPerTxCap() public {
        _authorize(_params());
        _expectRun(BVCCAgentLogicV5.ExceedsPerTxLimit.selector, RECIPIENT, 1 ether, "");
    }

    function test_Native_PerTxCapAppliesToWholeBatch() public {
        _authorize(_params());
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(RECIPIENT, 0.6 ether, "");
        b[1] = Execution(RECIPIENT, 0.6 ether, "");
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.ExceedsPerTxLimit.selector);
        wallet.executeAsAgent(_mode(), _batch(b));
    }

    // ---------------------------------------------------------------- tokens

    function test_Transfer_ChargesAmountPlusFee() public {
        _authorize(_params());
        _run(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18)));
        (uint128 daily, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 100e18 + 0.15e18, "fee counted");
        assertEq(daily, total);
    }

    function test_Transfer_NotAllowedToken() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.TokenNotAllowed.selector,
            address(other),
            0,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 1e18))
        );
    }

    function test_Transfer_NotAllowedRecipient() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.RecipientNotAllowed.selector,
            address(token),
            0,
            abi.encodeCall(IERC20.transfer, (address(0xBAD), 1e18))
        );
    }

    function test_Transfer_BatchCapIncludesFee() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.TokenBatchLimitExceeded.selector,
            address(token),
            0,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 200e18))
        );
    }

    function test_Transfer_ZeroTokenCapAllowsNothing() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.tokenMaxAmounts = _u(0);
        _authorize(p);
        _expectRun(
            BVCCAgentLogicV5.TokenBatchLimitExceeded.selector,
            address(token),
            0,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 1))
        );
    }

    function test_Transfer_WithValueRejected() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.TokenCallWithValue.selector,
            address(token),
            1,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 1))
        );
    }

    // ---------------------------------------------------------------- approvals

    function test_Approve_OnlyToProtocols() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.ProtocolNotAllowed.selector,
            address(token),
            0,
            abi.encodeCall(IERC20.approve, (RECIPIENT, 1e18))
        );
    }

    function test_Approve_RestoredAfterBatch() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), 7);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED);
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(token), 0, abi.encodeCall(IERC20.approve, (address(puller), 50e18)));
        b[1] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 40e18)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        assertEq(token.allowance(address(wallet), address(puller)), 7, "owner allowance restored");
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 40e18 + 0.06e18, "pulled amount + fee charged");
        assertEq(token.balanceOf(FEE), 0.06e18, "fee paid in the pulled token");
    }

    function test_Approve_ApproveAloneLeavesNothing() public {
        _authorize(_params());
        _run(address(token), 0, abi.encodeCall(IERC20.approve, (address(puller), type(uint256).max)));
        assertEq(token.allowance(address(wallet), address(puller)), 0);
        vm.prank(address(puller));
        vm.expectRevert();
        token.transferFrom(address(wallet), address(puller), 1);
    }

    function test_Approve_UsdtLikeRestored() public {
        UsdtLike u = new UsdtLike();
        u.mint(address(wallet), 1000e18);
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedTokens[0] = address(u);
        _authorize(p);
        _ownerApprove(address(u), address(puller), 5);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED);
        Execution[] memory b = new Execution[](3);
        b[0] = Execution(address(u), 0, abi.encodeCall(IERC20.approve, (address(puller), 0)));
        b[1] = Execution(address(u), 0, abi.encodeCall(IERC20.approve, (address(puller), 10e18)));
        b[2] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (address(u), 4e18)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        assertEq(u.allowance(address(wallet), address(puller)), 5);
    }

    // ---------------------------------------------------------------- the V4 case-3 hole

    function test_PriorOwnerAllowance_ChargedToBudget() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED);
        _run(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 150e18)));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 150e18 + 0.225e18);
        _expectRun(
            BVCCAgentLogicV5.TokenBatchLimitExceeded.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pull, (address(token), 201e18))
        );
    }

    function test_PriorOwnerAllowance_TotalBudgetHolds() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED);
        // Charges with the 0.15 % fee: 199 -> 199.2985, 100 -> 100.15 (day 299.4485).
        _run(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 199e18)));
        _run(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 100e18)));
        _expectRun(
            BVCCAgentLogicV5.TokenDailyLimitExceeded.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pull, (address(token), 1e18))
        );
        vm.warp(vm.getBlockTimestamp() + 1 days);
        // Total 498.747; 2 more (2.003) passes the 500 budget.
        _run(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 199e18)));
        _expectRun(
            BVCCAgentLogicV5.TokenTotalBudgetExceeded.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pull, (address(token), 2e18))
        );
    }

    function test_NotAllowedTokenOutflowReverts() public {
        _authorize(_params());
        _ownerApprove(address(other), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED);
        _expectRun(
            BVCCAgentLogicV5.TokenNotAllowed.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pull, (address(other), 1))
        );
    }

    function test_IncomingTokensAreNotCharged() public {
        _authorize(_params());
        token.mint(address(puller), 100e18);
        _setPolicy(address(puller), Puller.give.selector, ALLOWED);
        _run(address(puller), 0, abi.encodeCall(Puller.give, (address(token), 100e18)));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 0);
    }

    // ---------------------------------------------------------------- policies

    function test_Policy_DefaultDeny() public {
        _authorize(_params());
        _expectRun(BVCCAgentLogicV5.SelectorNotAllowed.selector, address(puller), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_Policy_IsPerAgent() public {
        _authorize(_params());
        _self(
            address(wallet),
            abi.encodeCall(
                BVCCAgentWalletV5.setAgentCallPolicy, (address(0xB2), address(puller), Puller.noop.selector, ALLOWED)
            )
        );
        _expectRun(BVCCAgentLogicV5.SelectorNotAllowed.selector, address(puller), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_Policy_ProtocolMustBeAllowed() public {
        _authorize(_params());
        Puller p2 = new Puller();
        _setPolicy(address(p2), Puller.noop.selector, ALLOWED);
        _expectRun(BVCCAgentLogicV5.ProtocolNotAllowed.selector, address(p2), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_Policy_ReservedBitsRejected() public {
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.InvalidPolicy.selector);
        wallet.setAgentCallPolicy(agent, address(puller), Puller.noop.selector, ALLOWED | 1);
        vm.prank(address(wallet));
        vm.expectRevert(BVCCAgentLogicV5.InvalidPolicy.selector);
        wallet.setAgentCallPolicy(agent, address(puller), Puller.noop.selector, ALLOWED | (1 << 230));
    }

    /// @dev Audit V5-H-02 / V5-H-03: without a validator, a protocol call could pull a
    ///      token hidden in packed data through an old owner approval, or pay a recipient
    ///      the agent chose. Every protocol call now needs one, whatever the selector.
    function test_Policy_EveryProtocolCallNeedsValidator() public {
        _authorize(_params());
        _ownerApprove(address(other), address(puller), type(uint256).max);
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pullPacked.selector, PLAIN);
        _setPolicy(address(puller), Puller.pullTo.selector, PLAIN);
        _setPolicy(address(puller), 0xa22cb465, PLAIN); // setApprovalForAll
        _expectRun(
            BVCCAgentLogicV5.CallNeedsValidator.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pullPacked, (abi.encodePacked(address(other)), 100e18))
        );
        _expectRun(
            BVCCAgentLogicV5.CallNeedsValidator.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pullTo, (address(token), 100e18, address(0xBAD)))
        );
        _expectRun(
            BVCCAgentLogicV5.CallNeedsValidator.selector,
            address(puller),
            0,
            abi.encodeWithSelector(bytes4(0xa22cb465), RECIPIENT, true)
        );
    }

    function test_Anchors() public {
        _authorize(_params());
        // word 0 = W (wallet), word 1 = R (recipient), word 2 = T? no: word 2 is uint; word 3 = S.
        bytes32 v = keccak256("chain-8453");
        bytes32[] memory values = new bytes32[](1);
        values[0] = v;
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentValueSet, (agent, address(puller), Puller.pin.selector, values))
        );
        uint256 policy = ALLOWED | (uint256(1) << 192) | (uint256(1 << 1) << 96) | (uint256(1 << 3) << 64);
        _setPolicy(address(puller), Puller.pin.selector, policy);
        _run(address(puller), 0, abi.encodeCall(Puller.pin, (address(wallet), RECIPIENT, 5, v)));
        _expectRun(
            BVCCAgentLogicV5.PinnedArgMismatch.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pin, (address(0xBAD), RECIPIENT, 5, v))
        );
        _expectRun(
            BVCCAgentLogicV5.PinnedArgMismatch.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pin, (address(wallet), address(0xBAD), 5, v))
        );
        _expectRun(
            BVCCAgentLogicV5.PinnedArgMismatch.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pin, (address(wallet), RECIPIENT, 5, bytes32(uint256(1))))
        );
        // Calldata shorter than the anchored words.
        _expectRun(
            BVCCAgentLogicV5.PinnedArgMismatch.selector,
            address(puller),
            0,
            abi.encodePacked(Puller.pin.selector, bytes32(uint256(uint160(address(wallet)))))
        );
    }

    function test_Anchors_TokenAnchor() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pull.selector, ALLOWED | (uint256(1) << 128));
        _run(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), 1e18)));
        _expectRun(
            BVCCAgentLogicV5.PinnedArgMismatch.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pull, (address(other), 1))
        );
    }

    // ---------------------------------------------------------------- pause and block

    function test_PerAgentPause() public {
        _authorize(_params());
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.pauseAgent, (agent)));
        _expectRun(BVCCAgentLogicV5.AgentPaused.selector, RECIPIENT, 0.1 ether, "");
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.unpauseAgent, (agent)));
        _run(RECIPIENT, 0.1 ether, "");
    }

    function test_GlobalPause() public {
        _authorize(_params());
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.pauseAgents, ()));
        _expectRun(Pausable.EnforcedPause.selector, RECIPIENT, 0.1 ether, "");
    }

    function test_BlockedTarget() public {
        _authorize(_params());
        _setPolicy(address(puller), Puller.noop.selector, ALLOWED);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.setTargetBlocked, (address(puller), true)));
        _expectRun(BVCCAgentLogicV5.TargetIsBlocked.selector, address(puller), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_RevokedAgent() public {
        _authorize(_params());
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.revokeAgent, (agent)));
        _expectRun(BVCCAgentLogicV5.NotAuthorizedAgent.selector, RECIPIENT, 0.1 ether, "");
    }

    function test_AgentCannotCallWallet() public {
        _authorize(_params());
        _expectRun(
            BVCCAgentLogicV5.AgentCannotCallWallet.selector,
            address(wallet),
            0,
            abi.encodeCall(BVCCAgentWalletV5.unpauseAgents, ())
        );
    }

    // ---------------------------------------------------------------- validators

    // ------------------------------------------------------------------ agent fee

    function test_Fee_PackedPathStillCharged() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pullPacked.selector, ALLOWED);
        bytes memory path = abi.encodePacked(address(token), uint24(500), address(other));
        _run(address(puller), 0, abi.encodeCall(Puller.pullPacked, (path, 100e18)));
        assertEq(token.balanceOf(FEE), 0.15e18, "fee in the token that left");
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 100.15e18);
    }

    function test_Fee_OnlyOnWhatLeaves() public {
        _authorize(_params());
        _ownerApprove(address(token), address(puller), type(uint256).max);
        _setPolicy(address(puller), Puller.pullPacked.selector, ALLOWED);
        _setPolicy(address(puller), Puller.give.selector, ALLOWED);
        other.mint(address(puller), 30e18);
        uint256 otherBefore = other.balanceOf(address(wallet));
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(puller), 0, abi.encodeCall(Puller.pullPacked, (abi.encodePacked(address(token)), 50e18)));
        b[1] = Execution(address(puller), 0, abi.encodeCall(Puller.give, (address(other), 30e18)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        assertEq(token.balanceOf(FEE), 0.075e18, "fee on the token out");
        assertEq(other.balanceOf(FEE), 0, "no fee on the token in");
        assertEq(other.balanceOf(address(wallet)) - otherBefore, 30e18, "token in arrives whole");
    }

    function test_Fee_NeedsBalanceOnTop() public {
        _authorize(_params());
        uint256 extra = token.balanceOf(address(wallet)) - 100e18;
        vm.prank(address(wallet));
        token.transfer(address(0xdead), extra);
        vm.expectRevert();
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18))));
        _run(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 99e18)));
        assertEq(token.balanceOf(RECIPIENT), 99e18);
        assertEq(token.balanceOf(FEE), 0.1485e18);
    }

    function test_Fee_NativeNeedsBalanceOnTop() public {
        _authorize(_params());
        vm.deal(address(wallet), 0.5 ether);
        _expectRun(BVCCAgentLogicV5.FeeTransferFailed.selector, RECIPIENT, 0.5 ether, "");
    }

    function test_Fee_OwnerPathUnchanged() public {
        uint256 before = token.balanceOf(RECIPIENT);
        _asOwner(address(wallet), address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18)));
        assertEq(token.balanceOf(RECIPIENT) - before, 100e18);
        assertEq(token.balanceOf(FEE), 0.15e18, "owner fee of the agent wallet");
    }

    function _registerValidator(address target, address validator) internal {
        vm.prank(ADMIN);
        registry.proposeValidator(target, validator);
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(target);
    }

    function test_Deep_CostChargedAndPostCheck() public {
        MockLendingPool pool = new MockLendingPool();
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(pool);
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        _authorize(p);
        MockValidator v = new MockValidator();
        v.addCost(address(token), 100e18);
        v.set(true, true, true);
        _registerValidator(address(pool), address(v));
        _setPolicy(address(pool), MockLendingPool.borrow.selector, ALLOWED | DEEP);

        bytes memory borrow =
            abi.encodeCall(MockLendingPool.borrow, (address(token), 100e18, 2, 0, address(wallet)));
        _run(address(pool), 0, borrow);
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 100e18 + 0.15e18, "debt + fee charged");

        v.set(true, true, false);
        _expectRun(BVCCAgentLogicV5.PostCheckFailed.selector, address(pool), 0, borrow);
    }

    function test_Deep_BorrowAndSpendChargedOnce() public {
        MockLendingPool pool = new MockLendingPool();
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(pool);
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        _authorize(p);
        MockValidator v = new MockValidator();
        v.addCost(address(token), 100e18);
        _registerValidator(address(pool), address(v));
        _setPolicy(address(pool), MockLendingPool.borrow.selector, ALLOWED | DEEP);
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(pool), 0, abi.encodeCall(MockLendingPool.borrow, (address(token), 100e18, 2, 0, address(wallet))));
        b[1] = Execution(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        // Borrow +100, transfer -100: net outflow 0. The 100 of debt is charged once,
        // with the agent fee on it; the borrowed tokens are not charged twice.
        assertEq(total, 100e18 + 0.15e18, "debt + fee, not double");
        assertEq(token.balanceOf(FEE), 0.15e18);
    }

    function test_Deep_BorrowNotAllowedTokenReverts() public {
        MockLendingPool pool = new MockLendingPool();
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(pool);
        p.expiry = uint64(vm.getBlockTimestamp() + 300 days);
        _authorize(p);
        MockValidator v = new MockValidator();
        v.addCost(address(other), 1e18);
        _registerValidator(address(pool), address(v));
        _setPolicy(address(pool), MockLendingPool.borrow.selector, ALLOWED | DEEP);
        _expectRun(
            BVCCAgentLogicV5.TokenNotAllowed.selector,
            address(pool),
            0,
            abi.encodeCall(MockLendingPool.borrow, (address(other), 1e18, 2, 0, address(wallet)))
        );
    }

    function test_Deep_NoValidatorMeansNo() public {
        Puller bare = new Puller();
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(bare);
        _authorize(p);
        _setPolicy(address(bare), Puller.noop.selector, ALLOWED);
        _expectRun(BVCCAgentLogicV5.PolicyValidationFailed.selector, address(bare), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_Deep_ValidatorSaysNo() public {
        _authorize(_params());
        MockValidator v = new MockValidator();
        v.set(false, false, true);
        _registerValidator(address(puller), address(v));
        _setPolicy(address(puller), Puller.noop.selector, ALLOWED | DEEP);
        _expectRun(BVCCAgentLogicV5.PolicyValidationFailed.selector, address(puller), 0, abi.encodeCall(Puller.noop, ()));
    }

    function test_Deep_DeclaredTokenMeasured() public {
        _authorize(_params());
        _ownerApprove(address(other), address(puller), type(uint256).max);
        // pullFrom hides nothing, but the validator declares `other` anyway; with
        // `other` not allowed, any outflow of it reverts.
        MockValidator v = new MockValidator();
        v.addExtra(address(other));
        _registerValidator(address(puller), address(v));
        _setPolicy(address(puller), Puller.noop.selector, ALLOWED | DEEP);
        _run(address(puller), 0, abi.encodeCall(Puller.noop, ()));
    }

    // ---------------------------------------------------------------- reentrancy and limits

    function test_ReentryIntoExecuteRejected() public {
        Reenterer r = new Reenterer();
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(r);
        _authorize(p);
        _openTarget(address(r));
        _setPolicy(address(r), Reenterer.hit.selector, ALLOWED);
        bytes memory inner = _one(RECIPIENT, 1 ether, "");
        _expectRun(
            BVCCAgentWalletV5.ReentrantAgentExecute.selector,
            address(r),
            0,
            abi.encodeCall(Reenterer.hit, (address(wallet), _mode(), inner))
        );
    }

    function test_TooManyMeasuredTokens() public {
        _authorize(_params());
        _setPolicy(address(puller), Puller.pullMany.selector, ALLOWED);
        address[] memory many = new address[](61);
        for (uint256 i = 0; i < 61; i++) {
            many[i] = address(new MockToken("X"));
        }
        _expectRun(
            BVCCAgentLogicV5.TooManyMeasuredTokens.selector,
            address(puller),
            0,
            abi.encodeCall(Puller.pullMany, (many))
        );
    }

    function test_TokenLimitIsFifty() public {
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        _setTokens(p, 50);
        _authorize(p);
        assertEq(wallet.getAgentPermission(agent).allowedTokens.length, 50);
        _setTokens(p, 51);
        vm.expectRevert(BVCCAgentLogicV5.TooManyTokens.selector);
        vm.prank(address(wallet));
        wallet.authorizeAgent(p);
    }

    function _setTokens(BVCCAgentLogicV5.AuthorizeParams memory p, uint256 n) internal {
        p.allowedTokens = new address[](n);
        p.tokenMaxAmounts = new uint128[](n);
        p.tokenDailyLimits = new uint128[](n);
        p.tokenTotalBudgets = new uint128[](n);
        for (uint256 i = 0; i < n; i++) {
            p.allowedTokens[i] = address(new MockToken("L"));
            p.tokenMaxAmounts[i] = 1;
            p.tokenDailyLimits[i] = 1;
            p.tokenTotalBudgets[i] = 1;
        }
    }

    function test_EOACheckOnEveryRun() public {
        _authorize(_params());
        vm.etch(agent, hex"00");
        _expectRun(BVCCAgentLogicV5.AgentMustBeEOA.selector, RECIPIENT, 0.1 ether, "");
    }

    function test_RecoveryPausesAgents() public {
        _authorize(_params());
        address[3] memory g = [address(0x6000), address(0x6001), address(0x6002)];
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.setGuardians, (g)));
        (uint256 x, uint256 y) = vm.publicKeyP256(PK2);
        vm.prank(g[0]);
        wallet.voteRecovery(bytes32(x), bytes32(y), hex"01");
        vm.prank(g[1]);
        wallet.voteRecovery(bytes32(x), bytes32(y), hex"01");
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(g[0]);
        wallet.executeRecovery();
        _expectRun(Pausable.EnforcedPause.selector, RECIPIENT, 0.1 ether, "");
    }

    // ---------------------------------------------------------------- audit 1 fixes

    /// @dev Audit V5-H-01: an allowed token whose balance cannot be read must not
    ///      leave unmeasured. The batch reverts before anything runs.
    function test_Measure_UnreadableBalanceReverts() public {
        UnreadableToken u = new UnreadableToken();
        u.mint(address(wallet), 100e18);
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedTokens[0] = address(u);
        _authorize(p);
        _expectRun(
            BVCCAgentLogicV5.MeasurementFailed.selector,
            address(u),
            0,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 10e18))
        );
    }

    /// @dev Audit V5-M-01: paying the fee must not take more than the fee.
    function test_Fee_SenderTaxedTokenReverts() public {
        SenderTaxToken t = new SenderTaxToken();
        t.mint(address(wallet), 1000e18);
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedTokens[0] = address(t);
        _authorize(p);
        _expectRun(
            BVCCAgentLogicV5.FeeTransferFailed.selector,
            address(t),
            0,
            abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18))
        );
    }

    function _inflowProtocol() internal returns (Puller pos) {
        pos = new Puller();
        token.mint(address(pos), 500e18);
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(pos);
        _authorize(p);
        MockValidator v = new MockValidator();
        v.addExtra(address(token));
        v.setInflow(true);
        _registerValidator(address(pos), address(v));
        _setPolicy(address(pos), Puller.give.selector, ALLOWED);
    }

    /// @dev Audit V5-H-04: a withdrawal from a position the wallet does not measure,
    ///      forwarded in the same batch, nets to zero; the inflow is charged instead.
    function test_Inflow_WithdrawAndForwardCharged() public {
        Puller pos = _inflowProtocol();
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(pos), 0, abi.encodeCall(Puller.give, (address(token), 100e18)));
        b[1] = Execution(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 100e18)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 100.15e18, "withdrawn and forwarded: charged once, with fee");
        assertEq(token.balanceOf(FEE), 0.15e18);
    }

    function test_Inflow_WithdrawalAlonePaysAndCountsInCaps() public {
        Puller pos = _inflowProtocol();
        _run(address(pos), 0, abi.encodeCall(Puller.give, (address(token), 40e18)));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 40.06e18, "a withdrawal pays the agent fee");
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(pos), 0, abi.encodeCall(Puller.give, (address(token), 200e18)));
        b[1] = Execution(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 200e18)));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.TokenBatchLimitExceeded.selector);
        wallet.executeAsAgent(_mode(), _batch(b));
    }

    /// @dev Audit V5-H-04 with the real Aave validator: the withdrawn underlying is
    ///      charged, so collateral cannot leave above the token caps.
    function test_Inflow_AaveWithdrawRespectsCaps() public {
        CollateralPool pool = new CollateralPool(token);
        pool.mintCollateral(address(wallet), 100e18);
        BVCCAgentLogicV5.AuthorizeParams memory p = _params();
        p.allowedProtocols[0] = address(pool);
        p.tokenMaxAmounts[0] = 1e18;
        _authorize(p);
        _registerValidator(address(pool), address(new BVCCAaveV3ValidatorV5(address(pool))));
        _setPolicy(address(pool), bytes4(0x69328dec), ALLOWED);
        _ownerApprove(address(pool.aToken()), address(pool), type(uint256).max);

        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(pool), 0, abi.encodeWithSelector(bytes4(0x69328dec), address(token), 99e18, address(wallet)));
        b[1] = Execution(address(token), 0, abi.encodeCall(IERC20.transfer, (RECIPIENT, 99e18)));
        vm.prank(agent);
        vm.expectRevert(BVCCAgentLogicV5.TokenBatchLimitExceeded.selector);
        wallet.executeAsAgent(_mode(), _batch(b));

        _run(address(pool), 0, abi.encodeWithSelector(bytes4(0x69328dec), address(token), 0.5e18, address(wallet)));
        (, uint128 total) = wallet.getTokenSpent(agent, address(token));
        assertEq(total, 0.5e18 + 0.00075e18, "withdrawal charged with the agent fee");
    }
}
