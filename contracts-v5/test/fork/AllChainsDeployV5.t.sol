// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "../V5Base.t.sol";
import {console} from "forge-std/Test.sol";
import {DeployV5} from "../../script/DeployV5.s.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";

interface IEntryPointV09Min {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);
    function getNonce(address sender, uint192 key) external view returns (uint256);
}

/// @dev The production deployment simulated on a fork of each chain, with the real fee
///      wallet and admin: every address as predicted, owner and agent operations through
///      the real EntryPoint, fees reaching the fee wallet, and the factory kill switch.
///      Each chain runs when its RPC variable is set and is skipped otherwise:
///      ETHEREUM_RPC, ARBITRUM_RPC, BASE_RPC, BSC_RPC, POLYGON_RPC, ARBITRUM_SEPOLIA_RPC.
contract AllChainsDeployV5Test is V5Base {
    address internal constant ENTRYPOINT = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;
    address internal constant PROD_FEE_WALLET = 0x3e3eb089169a7315a994947465ce5f5FC3A307D4;
    address internal constant PROD_ADMIN = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    address internal constant AGENT = address(0xA6E);
    address internal constant RECIPIENT = address(0xCAFE);

    function test_Chain_Ethereum() public {
        _onChain("ETHEREUM_RPC", 1);
    }

    function test_Chain_Arbitrum() public {
        _onChain("ARBITRUM_RPC", 42161);
    }

    function test_Chain_Base() public {
        _onChain("BASE_RPC", 8453);
    }

    function test_Chain_Bsc() public {
        _onChain("BSC_RPC", 56);
    }

    function test_Chain_Polygon() public {
        _onChain("POLYGON_RPC", 137);
    }

    function test_Chain_ArbitrumSepolia() public {
        _onChain("ARBITRUM_SEPOLIA_RPC", 421614);
    }

    function _onChain(string memory rpcVar, uint256 chainId) internal {
        string memory rpc = vm.envOr(rpcVar, string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        assertEq(block.chainid, chainId, "wrong chain");
        assertGt(ENTRYPOINT.code.length, 0, "EntryPoint v0.9 missing");

        // Deployment: everything where it was predicted, wired as expected.
        DeployV5 d = new DeployV5();
        DeployV5.Addresses memory predicted = d.predict(PROD_FEE_WALLET, PROD_ADMIN);
        uint256 g = gasleft();
        DeployV5.Addresses memory a = d.deployAll(PROD_FEE_WALLET, PROD_ADMIN);
        console.log("deployment gas", g - gasleft());
        d.verify(a, PROD_FEE_WALLET, PROD_ADMIN);
        assertEq(keccak256(abi.encode(a)), keccak256(abi.encode(predicted)), "addresses differ from prediction");
        assertEq(a.smartFactory, 0x2672951DC1E3f865BA6Fc98e5509dc4B23B260a2, "standard factory");
        assertEq(a.agentFactory, 0xE36fb66c21C38536454C1a58fBC5EB1Cb455aD52, "agent factory");

        (uint256 x, uint256 y) = vm.publicKeyP256(PK);
        qx = bytes32(x);
        qy = bytes32(y);

        // Standard wallet: owner send through the real EntryPoint, 0.05 % fee.
        BVCCWalletFactoryV5 sf = BVCCWalletFactoryV5(a.smartFactory);
        address smart = sf.createWallet(qx, qy, CRED, _credentialSig(PK, sf.getWalletAddress(qx, qy), CRED));
        vm.deal(smart, 1 ether);
        uint256 feeBefore = PROD_FEE_WALLET.balance;
        _ownerOp(smart, abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(RECIPIENT, 0.1 ether, ""))));
        assertEq(PROD_FEE_WALLET.balance - feeBefore, 0.00005 ether, "standard fee");

        // Agent wallet: authorize by UserOp, agent sends, 0.15 % agent fee on top.
        BVCCWalletFactoryV5 af = BVCCWalletFactoryV5(a.agentFactory);
        address agentWallet = af.createWallet(qx, qy, CRED, _credentialSig(PK, af.getWalletAddress(qx, qy), CRED));
        assertTrue(agentWallet != smart, "one wallet per factory");
        vm.deal(agentWallet, 1 ether);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.maxPerTxWei = 0.1 ether;
        p.dailyLimitWei = 0.1 ether;
        p.totalBudgetWei = 0.1 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = RECIPIENT;
        bytes memory inner = abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p));
        _ownerOp(agentWallet, abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(agentWallet, 0, inner))));
        feeBefore = PROD_FEE_WALLET.balance;
        uint256 recipientBefore = RECIPIENT.balance;
        vm.prank(AGENT);
        BVCCAgentWalletV5(payable(agentWallet)).executeAsAgent(_mode(), _one(RECIPIENT, 0.05 ether, ""));
        assertEq(RECIPIENT.balance - recipientBefore, 0.05 ether, "agent send");
        assertEq(PROD_FEE_WALLET.balance - feeBefore, 0.000075 ether, "agent fee");

        // Kill switch: only the admin; no new wallets afterwards; existing ones keep working.
        vm.expectRevert();
        sf.kill();
        vm.prank(PROD_ADMIN);
        sf.kill();
        (uint256 x2, uint256 y2) = vm.publicKeyP256(PK2);
        bytes memory sig2 = _credentialSig(PK2, sf.getWalletAddress(bytes32(x2), bytes32(y2)), CRED);
        vm.expectRevert(BVCCWalletFactoryV5.FactoryKilledError.selector);
        sf.createWallet(bytes32(x2), bytes32(y2), CRED, sig2);
        _ownerOp(smart, abi.encodeCall(BVCCSmartWalletV5.execute, (_mode(), _one(RECIPIENT, 0.01 ether, ""))));
        assertFalse(af.killed(), "factories are killed one by one");
    }

    function _ownerOp(address sender, bytes memory callData) internal {
        PackedUserOperation memory op;
        op.sender = sender;
        op.nonce = IEntryPointV09Min(ENTRYPOINT).getNonce(sender, 0);
        op.callData = callData;
        op.accountGasLimits = bytes32((uint256(2_000_000) << 128) | uint256(500_000));
        op.preVerificationGas = 100_000;
        op.gasFees = bytes32((uint256(0.01 gwei) << 128) | uint256(1 gwei));
        bytes32 h = IEntryPointV09Min(ENTRYPOINT).getUserOpHash(op);
        uint48 validUntil = uint48(vm.getBlockTimestamp() + 900);
        op.signature = abi.encode(validUntil, _webauthn(PK, keccak256(abi.encode(h, validUntil))));
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        address bundler = address(0xB0DD1E);
        vm.prank(bundler, bundler);
        IEntryPointV09Min(ENTRYPOINT).handleOps(ops, payable(bundler));
    }
}
