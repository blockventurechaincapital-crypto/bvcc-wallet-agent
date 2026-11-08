// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";

/// @dev Random agent behaviour against a wallet whose owner left unlimited allowances
///      to a protocol, for an allowed token and for a token the agent may not touch.
contract AgentHandler is Test {
    BVCCAgentWalletV5 internal wallet;
    MockToken internal token;
    MockToken internal other;
    Puller internal puller;
    address internal agent;
    address internal recipient;
    bytes32 internal mode;

    uint256 public calls;
    uint256 public successes;

    constructor(
        BVCCAgentWalletV5 w,
        MockToken t,
        MockToken o,
        Puller p,
        address a,
        address r,
        bytes32 m
    ) {
        wallet = w;
        token = t;
        other = o;
        puller = p;
        agent = a;
        recipient = r;
        mode = m;
    }

    function _exec(Execution[] memory b) internal {
        calls++;
        vm.prank(agent);
        try wallet.executeAsAgent(mode, abi.encode(b)) {
            successes++;
        } catch {}
    }

    function _single(address target, uint256 value, bytes memory data) internal {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution(target, value, data);
        _exec(b);
    }

    function transfer(uint256 amount) external {
        amount = bound(amount, 0, 400e18);
        _single(address(token), 0, abi.encodeCall(IERC20.transfer, (recipient, amount)));
    }

    function pull(uint256 amount) external {
        amount = bound(amount, 0, 400e18);
        _single(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), amount)));
    }

    function pullOther(uint256 amount) external {
        amount = bound(amount, 1, 400e18);
        _single(address(puller), 0, abi.encodeCall(Puller.pull, (address(other), amount)));
    }

    function approveThenPull(uint256 approveAmount, uint256 amount) external {
        amount = bound(amount, 0, 400e18);
        Execution[] memory b = new Execution[](2);
        b[0] = Execution(address(token), 0, abi.encodeCall(IERC20.approve, (address(puller), approveAmount)));
        b[1] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), amount)));
        _exec(b);
    }

    function pullTwiceInOneBatch(uint256 a, uint256 c) external {
        a = bound(a, 0, 250e18);
        c = bound(c, 0, 250e18);
        Execution[] memory b = new Execution[](3);
        b[0] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), a)));
        b[1] = Execution(address(token), 0, abi.encodeCall(IERC20.transfer, (recipient, c)));
        b[2] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (address(token), a)));
        _exec(b);
    }

    function sendNative(uint256 amount) external {
        amount = bound(amount, 1, 3 ether);
        _single(recipient, amount, "");
    }

    function nextDay() external {
        vm.warp(vm.getBlockTimestamp() + 1 days);
    }
}

contract AgentInvariantsV5Test is V5Base {
    BVCCAgentWalletV5 internal wallet;
    MockToken internal token;
    MockToken internal other;
    Puller internal puller;
    AgentHandler internal handler;
    address internal agent = address(0xA6E);
    address internal constant RECIPIENT = address(0xCAFE);

    uint256 internal constant START = 10_000e18;
    uint128 internal constant TOKEN_BUDGET = 1_000e18;
    uint128 internal constant ETH_BUDGET = 5 ether;

    function setUp() public override {
        super.setUp();
        wallet = _createAgent();
        token = new MockToken("T");
        other = new MockToken("O");
        puller = new Puller();
        _openTarget(address(puller));
        token.mint(address(wallet), START);
        other.mint(address(wallet), START);
        vm.deal(address(wallet), 100 ether);

        _asOwner(address(wallet), address(token), 0, abi.encodeCall(IERC20.approve, (address(puller), type(uint256).max)));
        _asOwner(address(wallet), address(other), 0, abi.encodeCall(IERC20.approve, (address(puller), type(uint256).max)));

        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.maxPerTxWei = 1 ether;
        p.dailyLimitWei = 2 ether;
        p.totalBudgetWei = ETH_BUDGET;
        p.expiry = uint64(vm.getBlockTimestamp() + 365 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = address(token);
        p.tokenMaxAmounts = new uint128[](1);
        p.tokenMaxAmounts[0] = 300e18;
        p.tokenDailyLimits = new uint128[](1);
        p.tokenDailyLimits[0] = 400e18;
        p.tokenTotalBudgets = new uint128[](1);
        p.tokenTotalBudgets[0] = TOKEN_BUDGET;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = address(puller);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = RECIPIENT;
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, address(puller), Puller.pull.selector, (1 << 255) | (1 << 254)))
        );

        handler = new AgentHandler(wallet, token, other, puller, agent, RECIPIENT, _mode());
        targetContract(address(handler));
    }

    /// G-2: what left the wallet never exceeds the budget, and every unit was charged.
    function invariant_TokenOutflowWithinBudget() public view {
        uint256 outflow = START - token.balanceOf(address(wallet));
        (, uint128 charged) = wallet.getTokenSpent(agent, address(token));
        assertLe(outflow, TOKEN_BUDGET, "outflow above budget");
        assertEq(charged, outflow, "every unit that left was charged");
    }

    /// G-3: a token the agent may not move never decreases.
    function invariant_NotAllowedTokenUntouched() public view {
        assertEq(other.balanceOf(address(wallet)), START);
    }

    /// Approvals: the owner's allowance is restored, the agent leaves none behind.
    function invariant_ApprovalsRestored() public view {
        assertEq(token.allowance(address(wallet), address(puller)), type(uint256).max);
    }

    /// Native budget: what left (value + fee) is within budget and was all charged.
    function invariant_NativeWithinBudget() public view {
        uint256 left = 100 ether - address(wallet).balance;
        assertLe(left, ETH_BUDGET);
        assertEq(left, wallet.getAgentSpending(agent).totalSpentWei, "every wei that left was charged");
    }

    /// Agent fee: the fee wallet got 0.15 % of the rest of each charge (rounded down per batch).
    function invariant_AgentFeeIsExact() public view {
        (, uint128 charged) = wallet.getTokenSpent(agent, address(token));
        _checkFee(token.balanceOf(FEE), charged);
        _checkFee(FEE.balance, wallet.getAgentSpending(agent).totalSpentWei);
    }

    function _checkFee(uint256 fee, uint256 charged) internal view {
        uint256 base = charged - fee;
        assertLe(fee * 1_000_000, base * 1500, "fee above 0.15 %");
        assertLt(base * 1500 - fee * 1_000_000, (handler.successes() + 1) * 1_000_000, "fee below 0.15 %");
    }

    function test_HandlerActionsSucceed() public {
        handler.pull(100e18);
        handler.transfer(50e18);
        handler.approveThenPull(20e18, 10e18);
        handler.pullTwiceInOneBatch(20e18, 10e18);
        handler.sendNative(0.5 ether);
        assertEq(handler.successes(), 5);
        handler.pullOther(1);
        assertEq(handler.successes(), 5, "not allowed token refused");
    }

    function invariant_CallsHappen() public view {
        assertLe(handler.successes(), handler.calls());
    }
}
