// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {DeployV5} from "../../script/DeployV5.s.sol";

/// @dev Real USDT on an Ethereum fork: no return value and approve must go through 0.
///      Set ETHEREUM_RPC to run; skipped otherwise.
contract EthereumUsdtForkV5Test is V5Base {
    address internal constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    bool internal forked;
    BVCCAgentWalletV5 internal wallet;
    Puller internal puller;
    address internal agent = address(0xA6E);

    function setUp() public override {
        string memory rpc = vm.envOr("ETHEREUM_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        DeployV5 d = new DeployV5();
        DeployV5.Addresses memory a = d.deployAll(address(0xFEE5AFE), address(0xAD5AFE));
        (uint256 x, uint256 y) = vm.publicKeyP256(PK);
        qx = bytes32(x);
        qy = bytes32(y);
        BVCCWalletFactoryV5 f = BVCCWalletFactoryV5(a.agentFactory);
        address predicted = f.getWalletAddress(qx, qy);
        wallet = BVCCAgentWalletV5(payable(f.createWallet(qx, qy, CRED, _credentialSig(PK, predicted, CRED))));
        puller = new Puller();
        registry = BVCCValidatorRegistryV5(a.registry);
        MockValidator open = new MockValidator();
        vm.prank(address(0xAD5AFE));
        registry.proposeValidator(address(puller), address(open));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(address(0xAD5AFE));
        registry.activateValidator(address(puller));
        deal(USDT, address(wallet), 1_000e6);
    }

    function test_Fork_Usdt_TransferFeeAndApprovalRestore() public {
        if (!forked) vm.skip(true);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = USDT;
        p.tokenMaxAmounts = new uint128[](1);
        p.tokenDailyLimits = new uint128[](1);
        p.tokenTotalBudgets = new uint128[](1);
        p.tokenMaxAmounts[0] = 200e6;
        p.tokenDailyLimits[0] = 200e6;
        p.tokenTotalBudgets[0] = 200e6;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = address(puller);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = address(0xCAFE);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, address(puller), Puller.pull.selector, (1 << 255) | (1 << 254)))
        );

        // Case 2 transfer of a token that returns nothing: accepted, fee on top.
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _one(USDT, 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 100e6))));
        assertEq(IERC20(USDT).balanceOf(address(0xCAFE)), 100e6);
        assertEq(IERC20(USDT).balanceOf(address(0xFEE5AFE)), 0.15e6);

        // Owner had an allowance of 5; the agent sets its own, the protocol pulls, 5 comes back.
        _asOwner(address(wallet), USDT, 0, abi.encodeCall(IERC20.approve, (address(puller), 5)));
        Execution[] memory b = new Execution[](3);
        b[0] = Execution(USDT, 0, abi.encodeCall(IERC20.approve, (address(puller), 0)));
        b[1] = Execution(USDT, 0, abi.encodeCall(IERC20.approve, (address(puller), 50e6)));
        b[2] = Execution(address(puller), 0, abi.encodeCall(Puller.pull, (USDT, 30e6)));
        vm.prank(agent);
        wallet.executeAsAgent(_mode(), _batch(b));
        assertEq(IERC20(USDT).allowance(address(wallet), address(puller)), 5, "owner allowance restored");
        (, uint128 total) = wallet.getTokenSpent(agent, USDT);
        assertEq(total, 100.15e6 + 30.045e6);
    }
}
