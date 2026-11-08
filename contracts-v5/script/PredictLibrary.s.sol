// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";

/// @notice Prints the CREATE2 address of the agent library. That address must be the
///         one set in foundry.toml `libraries`, because the agent wallet logic links it.
contract PredictLibrary is Script {
    bytes32 internal constant SALT_LIBRARY = bytes32(uint256(0x4256434305000001));

    function run() external view {
        bytes memory code = vm.getCode("BVCCAgentLogicV5.sol:BVCCAgentLogicV5");
        console.log("BVCCAgentLogicV5:", vm.computeCreate2Address(SALT_LIBRARY, keccak256(code)));
    }
}
