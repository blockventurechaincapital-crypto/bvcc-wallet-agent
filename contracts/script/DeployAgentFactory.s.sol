// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BVCCAgentWalletFactory.sol";

/**
 * @notice Redeploy de la AgentWalletFactory tras añadir límites por-token
 *         (authorizeAgent ahora toma el struct AuthorizeParams).
 *
 *  El bytecode del wallet cambió, así que el initCodeHash de CREATE2 cambia y la
 *  factory tendrá una ADDRESS NUEVA aunque el salt sea el mismo (es lo esperado).
 *  Como la address de la factory cambia, las addresses deterministas de los wallets
 *  también cambian → hay que recrear los agent wallets de testnet.
 *
 *  Tras desplegar:
 *    1. Copiar la address impresa
 *    2. Actualizar `contracts.agentFactory` de Arbitrum Sepolia en
 *       bvcc_wallet/lib/networks.ts
 *    3. Actualizar la memoria / CLAUDE.md
 */
contract DeployAgentFactory is Script {
    // Salt fijo — misma address en todas las redes PARA UN MISMO BYTECODE.
    // 0x42564343 = "BVCC" en ASCII; v5 = agent factory.
    bytes32 constant SALT = bytes32(uint256(0x4256434300000005));

    // Owner del kill-switch — wallet dedicada de admin, SEPARADA del deployer y
    // de la fee wallet. DEBE ser la misma address en todas las redes para
    // preservar la address determinista del factory.
    address constant FACTORY_OWNER = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    function run() external {
        require(FACTORY_OWNER != address(0), "Set FACTORY_OWNER (admin wallet) first");
        vm.startBroadcast();

        BVCCAgentWalletFactoryV4 factory = new BVCCAgentWalletFactoryV4{salt: SALT}(FACTORY_OWNER);

        console.log("Deployer:                 ", msg.sender);
        console.log("BVCCAgentWalletFactoryV4: ", address(factory));
        console.log("");
        console.log(">> Actualiza contracts.agentFactory (Arb Sepolia) en lib/networks.ts");

        vm.stopBroadcast();
    }
}
