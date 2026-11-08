// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";
import {console} from "forge-std/Test.sol";

/// @dev Gas of agent batches, from the lightest to the worst allowed case.
contract GasV5Test is V5Base {
    BVCCAgentWalletV5 internal wallet;
    address internal agent = address(0xA6E);
    MockToken[] internal tokens;
    Puller internal puller;

    function _setup(uint256 n) internal {
        wallet = _createAgent();
        puller = new Puller();
        _openTarget(address(puller));
        vm.deal(address(wallet), 10 ether);
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = agent;
        p.maxPerTxWei = 1 ether;
        p.dailyLimitWei = 1 ether;
        p.totalBudgetWei = 1 ether;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](n);
        p.tokenMaxAmounts = new uint128[](n);
        p.tokenDailyLimits = new uint128[](n);
        p.tokenTotalBudgets = new uint128[](n);
        for (uint256 i = 0; i < n; i++) {
            MockToken t = new MockToken("T");
            t.mint(address(wallet), 1_000e18);
            tokens.push(t);
            p.allowedTokens[i] = address(t);
            p.tokenMaxAmounts[i] = 100e18;
            p.tokenDailyLimits[i] = 100e18;
            p.tokenTotalBudgets[i] = 100e18;
        }
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = address(puller);
        p.allowedRecipients = new address[](1);
        p.allowedRecipients[0] = address(0xCAFE);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(BVCCAgentWalletV5.setAgentCallPolicy, (agent, address(puller), Puller.pullMany.selector, (1 << 255) | (1 << 254)))
        );
    }

    function _measure(string memory label, address target, uint256 value, bytes memory data) internal {
        vm.prank(agent);
        uint256 g = gasleft();
        wallet.executeAsAgent(_mode(), _one(target, value, data));
        console.log(label, g - gasleft());
    }

    function test_Gas_NativeSend_NoTokens() public {
        _setup(0);
        _measure("native send, 0 tokens:      ", address(0xCAFE), 0.1 ether, "");
    }

    function test_Gas_Transfer_OneToken() public {
        _setup(1);
        _measure("transfer, 1 token:          ", address(tokens[0]), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 1e18)));
    }

    function test_Gas_Transfer_TwentyTokens() public {
        _setup(20);
        _measure("transfer, 20 tokens:        ", address(tokens[0]), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 1e18)));
    }

    function test_Gas_Transfer_FourTokens() public {
        _setup(4);
        _measure("transfer, 4 tokens:         ", address(tokens[0]), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 1e18)));
    }

    function test_Gas_Transfer_FiftyTokens() public {
        _setup(50);
        _measure("transfer, 50 tokens:        ", address(tokens[0]), 0, abi.encodeCall(IERC20.transfer, (address(0xCAFE), 1e18)));
    }

    function test_Gas_Protocol_SixtyMeasured() public {
        _setup(50);
        address[] memory extra = new address[](10);
        for (uint256 i = 0; i < 10; i++) {
            extra[i] = address(new MockToken("X"));
        }
        _measure("protocol, 60 measured:      ", address(puller), 0, abi.encodeCall(Puller.pullMany, (extra)));
    }
}
