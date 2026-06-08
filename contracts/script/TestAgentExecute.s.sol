// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Execution} from "openzeppelin-contracts/contracts/account/utils/draft-ERC7579Utils.sol";

interface IAgentWallet {
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
}

contract TestAgentExecute is Script {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    function run() external {
        address agentWallet = 0x43033aF17147D118c5eDf91367331deB64AB4858;
        address recipient   = 0x7f71364c210912c2d3aAE2A3F68D6d6554F0a087;
        uint256 amount      = 0.0007 ether;

        Execution[] memory execs = new Execution[](1);
        execs[0] = Execution({ target: recipient, value: amount, callData: "" });

        vm.startBroadcast();
        IAgentWallet(agentWallet).executeAsAgent(BATCH_MODE, abi.encode(execs));
        vm.stopBroadcast();
    }
}
