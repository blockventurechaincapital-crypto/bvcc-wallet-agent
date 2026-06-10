// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BVCCWalletFactory.sol";

contract DeployFactory is Script {
    // Salt fijo — mismo valor en todas las redes para garantizar misma address de factory
    // 0x42564343 = "BVCC" en ASCII
    // v5: fix Case 3 — forwarda exec.value al target (swap ETH→token)
    bytes32 constant SALT = bytes32(uint256(0x4256434300000004));

    // Owner del kill-switch — wallet dedicada de admin, SEPARADA del deployer y
    // de la fee wallet. DEBE ser la misma address en todas las redes para
    // preservar la address determinista del factory (los args de constructor
    // entran en el initCodeHash de CREATE2).
    address constant FACTORY_OWNER = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    function run() external {
        require(FACTORY_OWNER != address(0), "Set FACTORY_OWNER (admin wallet) first");
        vm.startBroadcast();

        BVCCSmartWalletFactoryV2 factory = new BVCCSmartWalletFactoryV2{salt: SALT}(FACTORY_OWNER);

        console.log("Factory deployed at:");
        console.log(address(factory));

        vm.stopBroadcast();
    }
}
