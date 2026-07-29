// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {BVCCAgentWalletV4} from "../src/BVCCAgentWallet.sol";
import {BVCCSmartWalletV4} from "../src/BVCCWallet.sol";
import {BVCCAgentWalletFactoryV4} from "../src/BVCCAgentWalletFactory.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/**
 * Verification of four claims raised by a later internal review pass that used a
 * different analysis tool than the earlier rounds. Read-only w.r.t. the
 * contracts: nothing here changes src/, these tests only establish what is true today.
 */

contract MockToken {
    string public name = "Mock";
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }
    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[to] += a; return true;
    }
}

/// @dev A router that pulls tokens using a PRE-EXISTING allowance and returns something
///      to the wallet. Models any Case-3 protocol (SwapRouter, UR via Permit2, Aave).
contract MockPullRouter {
    MockToken public immutable TOKEN;
    constructor(MockToken t) { TOKEN = t; }
    function swap(address from, uint256 amount, address recipient) external {
        TOKEN.transferFrom(from, address(this), amount);   // pulls on the old allowance
        recipient;                                          // output pinned elsewhere
    }
}

/// @dev A "token" whose approve is payable — needed to show ETH riding along on approve.
contract PayableToken {
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public ethReceived;
    function approve(address s, uint256 a) external payable returns (bool) {
        allowance[msg.sender][s] = a; ethReceived += msg.value; return true;
    }
}

contract ThirdPartyClaimsTest is Test {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant P256_GX = bytes32(0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296);
    bytes32 constant P256_GY = bytes32(0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5);
    uint256 constant ALLOWED = 1 << 255;

    address admin = makeAddr("factoryAdmin");
    address victimApp = makeAddr("victimApp");
    address attacker = makeAddr("attacker");

    // ===================================================================== CLAIM 1
    /**
     * Regression: guardian squatting is closed. The address still derives from the public
     * key alone, so anyone can still deploy it — but the deployer no longer gets to choose
     * who can rotate its owner. Guardians are set by the wallet itself, i.e. by a
     * passkey-authenticated operation.
     */
    function test_Claim1_SquatterCannotChooseGuardians() public {
        BVCCAgentWalletFactoryV4 factory = new BVCCAgentWalletFactoryV4(admin);
        uint256 pkX = uint256(P256_GX);
        uint256 pkY = uint256(P256_GY);
        address predicted = factory.getWalletAddress(pkX, pkY);

        // The attacker still wins the deployment race — and gains nothing by it.
        vm.prank(attacker);
        address wallet = factory.createWallet(pkX, pkY);
        assertEq(wallet, predicted, "address still derives from the pubkey alone");
        assertEq(BVCCAgentWalletV4(payable(wallet)).guardians(0), address(0),
            "deployment leaves the wallet with no guardians");

        // The attacker cannot configure what it deployed.
        address[3] memory evil = [makeAddr("evil1"), makeAddr("evil2"), makeAddr("evil3")];
        vm.prank(attacker);
        vm.expectRevert();                        // OnlyWallet
        BVCCAgentWalletV4(payable(wallet)).setGuardians(evil, bytes("cred"));

        // The rightful owner does, through a self-call authenticated by their passkey.
        address[3] memory good = [makeAddr("good1"), makeAddr("good2"), makeAddr("good3")];
        vm.prank(wallet);
        BVCCAgentWalletV4(payable(wallet)).setGuardians(good, bytes("cred"));
        assertEq(BVCCAgentWalletV4(payable(wallet)).guardians(0), good[0]);

        // With no guardian seat, the recovery path is closed to the attacker.
        vm.prank(evil[0]);
        vm.expectRevert();                        // NotGuardian
        BVCCAgentWalletV4(payable(wallet)).initiateRecovery(
            0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978,
            0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1
        );
    }

    /// @dev setGuardians is self-call only; the owner may rotate the set afterwards.
    function test_Claim1_SetGuardiansRequiresSelfCall() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);

        vm.prank(attacker);
        vm.expectRevert();                        // OnlyWallet
        w.setGuardians([makeAddr("a"), makeAddr("b"), makeAddr("c")], bytes("cred"));

        vm.prank(address(w));
        w.setGuardians([makeAddr("a"), makeAddr("b"), makeAddr("c")], bytes("cred"));
        assertEq(w.guardians(0), makeAddr("a"));

        // Rotation by the owner is allowed (a compromised guardian must not be permanent);
        // it stays a self-call, which is what closes the squatting.
        vm.prank(address(w));
        w.setGuardians([makeAddr("x"), makeAddr("y"), makeAddr("z")], bytes("cred"));
        assertEq(w.guardians(0), makeAddr("x"));
    }

    /// @dev Duplicates are now rejected outright. They never allowed a solo takeover
    ///      (approvals are tracked per address) but they silently degraded 2-of-3 to 2-of-2.
    function test_Claim1_DuplicateGuardiansRejected() public {
        address g = makeAddr("dupGuardian");
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        vm.expectRevert();                        // InvalidGuardian
        w.setGuardians([g, g, makeAddr("other")], bytes("cred"));
        assertEq(w.guardians(0), address(0), "nothing was set");
    }

    /**
     * The real owner flow: guardians are set through execute(), the same self-call path
     * authorizeAgent already uses, which in production is driven by a passkey-signed
     * UserOperation. This is what the frontend must do after deploying on a new network.
     */
    function test_Claim1_OwnerSetsGuardiansThroughExecute() public {
        BVCCAgentWalletFactoryV4 factory = new BVCCAgentWalletFactoryV4(admin);
        address wallet = factory.createWallet(uint256(P256_GX), uint256(P256_GY));
        address[3] memory good = [makeAddr("g1"), makeAddr("g2"), makeAddr("g3")];

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({
            target: wallet,
            value: 0,
            callData: abi.encodeWithSignature("setGuardians(address[3],bytes)", good, bytes("cred-abc"))
        });

        // msg.sender == the wallet models the EntryPoint executing the owner's UserOp.
        // The credential is announced by the wallet itself in that same signed call, so a
        // squatter cannot forge it — it never travels through the factory any more.
        vm.expectEmit(false, false, false, true, wallet);
        emit BVCCSmartWalletV4.CredentialSet(keccak256(bytes("cred-abc")), bytes("cred-abc"));
        vm.prank(wallet);
        BVCCAgentWalletV4(payable(wallet)).execute(BATCH_MODE, abi.encode(b));

        assertEq(BVCCAgentWalletV4(payable(wallet)).guardians(0), good[0]);
        assertEq(BVCCAgentWalletV4(payable(wallet)).guardians(2), good[2]);

        // And recovery works normally from there.
        vm.prank(good[0]);
        BVCCAgentWalletV4(payable(wallet)).initiateRecovery(
            0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978,
            0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1
        );
        assertEq(BVCCAgentWalletV4(payable(wallet)).recoveryApprovals(), 1);
    }

    /// @dev An authorized agent cannot reach setGuardians either: executeAsAgent refuses
    ///      any batch item whose target is the wallet itself (AgentCannotCallWallet).
    function test_Claim1_AgentCannotSetGuardians() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        address agent = makeAddr("agentG");

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = new address[](0);
        ap.tokenMaxAmounts = new uint128[](0);
        ap.tokenDailyLimits = new uint128[](0);
        ap.tokenTotalBudgets = new uint128[](0);
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = new address[](0);
        vm.prank(address(w));
        w.authorizeAgent(ap);

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({
            target: address(w),
            value: 0,
            callData: abi.encodeWithSignature("setGuardians(address[3],bytes)",
                [makeAddr("e1"), makeAddr("e2"), makeAddr("e3")], bytes("evil-cred"))
        });
        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV4.AgentCannotCallWallet.selector);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertEq(w.guardians(0), address(0));
    }

    /**
     * Credential rotation. executeRecovery swaps the signer but leaves the credential id
     * untouched, so after a guardian recovery the on-chain id points at a passkey the owner
     * no longer holds. setCredentialId is what closes that gap — and it is passkey-gated.
     */
    function test_Claim1_CredentialCanBeRotatedAfterRecovery() public {
        BVCCAgentWalletFactoryV4 factory = new BVCCAgentWalletFactoryV4(admin);
        address wallet = factory.createWallet(uint256(P256_GX), uint256(P256_GY));
        address[3] memory good = [makeAddr("r1"), makeAddr("r2"), makeAddr("r3")];

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: wallet, value: 0,
            callData: abi.encodeWithSignature("setGuardians(address[3],bytes)", good, bytes("old-cred"))});
        vm.prank(wallet);
        BVCCAgentWalletV4(payable(wallet)).execute(BATCH_MODE, abi.encode(b));

        // Guardians rotate the signer to a new passkey; the credential is now stale.
        uint256 newX = 0x7CF27B188D034F7E8A52380304B51AC3C08969E277F21B35A60B48FC47669978;
        uint256 newY = 0x07775510DB8ED040293D9AC69F7430DBBA7DADE63CE982299E04B79D227873D1;
        vm.prank(good[0]);
        BVCCAgentWalletV4(payable(wallet)).initiateRecovery(newX, newY);
        vm.prank(good[1]);
        BVCCAgentWalletV4(payable(wallet)).approveRecovery();
        vm.warp(block.timestamp + 48 hours + 1);
        vm.prank(good[0]);
        BVCCAgentWalletV4(payable(wallet)).executeRecovery();

        // The owner re-points the wallet at the new passkey, through a signed self-call.
        Execution[] memory b2 = new Execution[](1);
        b2[0] = Execution({target: wallet, value: 0,
            callData: abi.encodeWithSignature("setCredentialId(bytes)", bytes("new-cred"))});
        vm.expectEmit(true, false, false, true, wallet);
        emit BVCCSmartWalletV4.CredentialSet(keccak256(bytes("new-cred")), bytes("new-cred"));
        vm.prank(wallet);
        BVCCAgentWalletV4(payable(wallet)).execute(BATCH_MODE, abi.encode(b2));
    }

    /// @dev Rotation is owner-only: an outsider cannot re-point the wallet's credential.
    function test_Claim1_CredentialRotationIsSelfCallOnly() public {
        BVCCSmartWalletV4 w = new BVCCSmartWalletV4(P256_GX, P256_GY);
        vm.prank(attacker);
        vm.expectRevert();                        // OnlyWallet
        w.setCredentialId(bytes("attacker-cred"));
    }

    // ===================================================================== CLAIM 2
    /**
     * Token budgets are consumed by transfer/approve only. A Case-3 protocol call that
     * spends the wallet's tokens on a PRE-EXISTING allowance moves them without touching
     * tokenMaxAmounts / daily / total.
     */
    function test_Claim2_PreExistingAllowanceEscapesTokenBudgets() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        MockToken token = new MockToken();
        MockPullRouter router = new MockPullRouter(token);
        token.mint(address(w), 1_000e18);

        // The OWNER (not subject to agent limits) approved the router earlier — the
        // everyday "approve once, trade many times" pattern.
        vm.prank(address(w));
        token.approve(address(router), type(uint256).max);

        address agent = makeAddr("agent2");
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        uint128[] memory caps = new uint128[](1);
        caps[0] = 10e18;                       // per-tx, daily and total all 10 tokens
        address[] memory protos = new address[](1);
        protos[0] = address(router);

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = tokens;
        ap.tokenMaxAmounts = caps;
        ap.tokenDailyLimits = caps;
        ap.tokenTotalBudgets = caps;
        ap.allowedProtocols = protos;
        ap.allowedRecipients = new address[](0);
        vm.prank(address(w));
        w.authorizeAgent(ap);
        vm.prank(address(w));
        w.setCallPolicy(address(router), MockPullRouter.swap.selector, ALLOWED);

        // 500 tokens — fifty times the per-tx cap — through the Case-3 path.
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(router), value: 0,
            callData: abi.encodeCall(MockPullRouter.swap, (address(w), 500e18, address(w)))});
        vm.prank(agent);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));

        assertEq(token.balanceOf(address(w)), 500e18, "500 tokens left the wallet");
        (uint256 dailySpent, uint256 totalSpent) = w.getTokenSpent(agent, address(token));
        assertEq(dailySpent, 0, "daily counter never moved");
        assertEq(totalSpent, 0, "total counter never moved");
    }

    // ===================================================================== CLAIM 3
    /// @dev An allowance already granted survives pausing and revoking the agent.
    function test_Claim3_AllowanceSurvivesPauseAndRevoke() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        MockToken token = new MockToken();
        token.mint(address(w), 100e18);
        address agent = makeAddr("agent3");
        address spender = makeAddr("spender");

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        uint128[] memory caps = new uint128[](1);
        caps[0] = 50e18;
        address[] memory rcpts = new address[](1);
        rcpts[0] = spender;

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.allowedTokens = tokens;
        ap.tokenMaxAmounts = caps;
        ap.tokenDailyLimits = caps;
        ap.tokenTotalBudgets = caps;
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = rcpts;
        vm.prank(address(w));
        w.authorizeAgent(ap);

        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(token), value: 0,
            callData: abi.encodeWithSignature("approve(address,uint256)", spender, 50e18)});
        vm.prank(agent);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));

        // Incident response: pause and revoke.
        vm.prank(address(w));
        w.pauseAgents();
        vm.prank(address(w));
        w.revokeAgent(agent);

        // The spender drains anyway — the allowance lives in the token contract.
        vm.prank(spender);
        token.transferFrom(address(w), spender, 50e18);
        assertEq(token.balanceOf(spender), 50e18, "pause/revoke did not stop the allowance");
    }

    // ===================================================================== CLAIM 4
    /**
     * Regression: a token call may no longer carry ETH.
     *
     * Before the fix, an execution with a positive value and approve calldata was
     * classified by the agent validator as a token operation — so the recipient check
     * landed on the spender — while the parent execute() fell through to case 3 and
     * forwarded the ETH to the token address, outside the destination whitelist. The
     * matching transfer case was untidy rather than dangerous: the parent dropped the
     * value, but the agent still charged it to its ETH budget.
     */
    function test_Claim4_TokenCallsCannotCarryEth() public {
        BVCCAgentWalletV4 w = new BVCCAgentWalletV4(P256_GX, P256_GY);
        vm.prank(address(w));
        w.setGuardians([address(10), address(11), address(12)], bytes("cred"));
        vm.deal(address(w), 10 ether);
        PayableToken token = new PayableToken();
        address agent = makeAddr("agent4");
        address allowedDest = makeAddr("payroll");

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        uint128[] memory caps = new uint128[](1);
        caps[0] = type(uint128).max;
        address[] memory rcpts = new address[](1);
        rcpts[0] = allowedDest;                    // ETH may only go to payroll

        BVCCAgentWalletV4.AuthorizeParams memory ap;
        ap.agent = agent;
        ap.maxPerTxWei = 1 ether;
        ap.allowedTokens = tokens;
        ap.tokenMaxAmounts = caps;
        ap.tokenDailyLimits = caps;
        ap.tokenTotalBudgets = caps;
        ap.allowedProtocols = new address[](0);
        ap.allowedRecipients = rcpts;
        vm.prank(address(w));
        w.authorizeAgent(ap);

        // approve + ETH: used to slip 1 ETH to the token address. Now refused.
        Execution[] memory b = new Execution[](1);
        b[0] = Execution({target: address(token), value: 1 ether,
            callData: abi.encodeWithSignature("approve(address,uint256)", allowedDest, 1)});
        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV4.TokenCallWithValue.selector);
        w.executeAsAgent(BATCH_MODE, abi.encode(b));
        assertEq(token.ethReceived(), 0, "no ETH reached the token");
        assertEq(address(w).balance, 10 ether, "wallet untouched");

        // transfer + ETH: the accounting leak, closed by the same check.
        Execution[] memory b2 = new Execution[](1);
        b2[0] = Execution({target: address(token), value: 0.5 ether,
            callData: abi.encodeWithSignature("transfer(address,uint256)", allowedDest, 1)});
        vm.prank(agent);
        vm.expectRevert(BVCCAgentWalletV4.TokenCallWithValue.selector);
        w.executeAsAgent(BATCH_MODE, abi.encode(b2));

        // The same approve without value still works.
        Execution[] memory b3 = new Execution[](1);
        b3[0] = Execution({target: address(token), value: 0,
            callData: abi.encodeWithSignature("approve(address,uint256)", allowedDest, 1)});
        vm.prank(agent);
        w.executeAsAgent(BATCH_MODE, abi.encode(b3));
        assertEq(token.allowance(address(w), allowedDest), 1, "normal approve unaffected");
    }
}
