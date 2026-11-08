// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {DeployV5} from "../script/DeployV5.s.sol";

contract DeployV5Test is V5Base {
    DeployV5 internal deployer;
    address internal constant FEE_SAFE = address(0xFEE5AFE);
    address internal constant ADMIN_SAFE = address(0xAD5AFE);

    function setUp() public override {
        vm.warp(1_800_000_000);
        if (CREATE2_DEPLOYER.code.length == 0) {
            vm.etch(
                CREATE2_DEPLOYER,
                hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3"
            );
        }
        deployer = new DeployV5();
        (uint256 x, uint256 y) = vm.publicKeyP256(PK);
        qx = bytes32(x);
        qy = bytes32(y);
    }

    function test_DeploysEverythingWhereItWasPredicted() public {
        DeployV5.Addresses memory predicted = deployer.predict(FEE_SAFE, ADMIN_SAFE);
        DeployV5.Addresses memory a = deployer.deployAll(FEE_SAFE, ADMIN_SAFE);
        assertEq(a.library_, AGENT_LIBRARY, "library at the linked address");
        assertEq(a.agentFactory, predicted.agentFactory);
        assertEq(a.smartFactory, predicted.smartFactory);
        deployer.verify(a, FEE_SAFE, ADMIN_SAFE);
    }

    function test_RerunIsHarmless() public {
        DeployV5.Addresses memory a = deployer.deployAll(FEE_SAFE, ADMIN_SAFE);
        DeployV5.Addresses memory b = deployer.deployAll(FEE_SAFE, ADMIN_SAFE);
        assertEq(a.agentFactory, b.agentFactory);
    }

    function test_InputsChangeAddresses() public view {
        DeployV5.Addresses memory a = deployer.predict(FEE_SAFE, ADMIN_SAFE);
        DeployV5.Addresses memory b = deployer.predict(FEE_SAFE, address(0xB0B));
        DeployV5.Addresses memory c = deployer.predict(address(0xB0B), ADMIN_SAFE);
        assertTrue(a.agentFactory != b.agentFactory, "admin is part of the address");
        assertTrue(a.agentFactory != c.agentFactory, "fee wallet is part of the address");
        assertEq(a.library_, b.library_, "library does not depend on the inputs");
    }

    function test_DeployedAgentWalletWorksEndToEnd() public {
        DeployV5.Addresses memory a = deployer.deployAll(FEE_SAFE, ADMIN_SAFE);
        BVCCWalletFactoryV5 f = BVCCWalletFactoryV5(a.agentFactory);
        address predicted = f.getWalletAddress(qx, qy);
        BVCCAgentWalletV5 w = BVCCAgentWalletV5(payable(f.createWallet(qx, qy, CRED, _credentialSig(PK, predicted, CRED))));
        assertEq(address(w), predicted);
        assertEq(w.VALIDATOR_REGISTRY(), a.registry);

        address agent = address(0xA6E);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.maxPerTxWei = 1 ether;
        p.dailyLimitWei = 1 ether;
        p.totalBudgetWei = 1 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = address(0xCAFE);
        _self(address(w), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        vm.deal(address(w), 1 ether);
        vm.prank(agent);
        w.executeAsAgent(_mode(), _one(address(0xCAFE), 0.5 ether, ""));
        assertEq(address(0xCAFE).balance, 0.5 ether);
        assertEq(FEE_SAFE.balance, 0.00075 ether);
    }

    function test_LibraryCannotBeCalledDirectly() public {
        DeployV5.Addresses memory a = deployer.deployAll(FEE_SAFE, ADMIN_SAFE);
        (bool ok,) = a.library_.call(abi.encodeWithSelector(bytes4(0xc6113341), uint256(0), address(1), true));
        assertFalse(ok, "state-changing library functions refuse direct calls");
    }
}
