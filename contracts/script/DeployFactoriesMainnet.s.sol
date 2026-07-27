// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/BVCCWalletFactory.sol";
import "../src/BVCCAgentWalletFactory.sol";
import "../src/BVCCValidatorRegistry.sol";

/**
 * @notice Deploy V3 en mainnet: BVCCValidatorRegistry PRIMERO (su address CREATE2
 *         va compilada como constante en BVCCAgentWalletV3), despues AMBAS
 *         factories. Network-agnostic y re-ejecutable (mismas addresses en todas
 *         las redes via CREATE2).
 *
 *  Checks antes de gastar gas:
 *    1. El EntryPoint canonico v0.9 de OZ debe existir en la chain.
 *    2. Las addresses CREATE2 predichas deben coincidir EXACTAMENTE con el build
 *       V3 esperado (call policies + registry). Si no coinciden, el bytecode
 *       compilado no es el V3 revisado y NO hay que desplegar.
 *    3. La prediccion del registry debe coincidir con la constante
 *       VALIDATOR_REGISTRY compilada en el wallet (test/Create2Consistency.t.sol
 *       verifica lo mismo en CI).
 *    4. Si un contrato ya existe en la chain (mismo bytecode → misma address),
 *       se salta — el script es re-ejecutable.
 *
 *  Uso (dry-run primero, sin --broadcast):
 *    forge script script/DeployFactoriesMainnet.s.sol --rpc-url https://arb1.arbitrum.io/rpc
 *
 *  Deploy real + verificacion (Etherscan API v2):
 *    forge script script/DeployFactoriesMainnet.s.sol \
 *      --rpc-url https://arb1.arbitrum.io/rpc \
 *      --broadcast --verify --chain 42161 \
 *      --etherscan-api-key $ETHERSCAN_API_KEY \
 *      --interactives 1
 *
 *  Tras desplegar: actualizar lib/networks.ts (frontend ambos folders + SDK/MCP)
 *  y CLAUDE.md. Las wallets V2 quedan solo para sacar fondos; kill() de las
 *  factories V2 con la admin wallet cuando proceda.
 */
contract DeployFactoriesMainnet is Script {
    // Salts V3 (0x42564343 = "BVCC"; V2 uso ...04/05)
    bytes32 public constant SALT_REGISTRY = bytes32(uint256(0x4256434300000006));
    bytes32 public constant SALT_SMART    = bytes32(uint256(0x4256434300000007));
    bytes32 public constant SALT_AGENT    = bytes32(uint256(0x4256434300000008));

    // Owner del kill-switch de factories Y del registry — admin dedicado,
    // separado del deployer y de la fee wallet. Mismo en todas las redes
    // (entra en el initCodeHash de CREATE2).
    address public constant FACTORY_OWNER = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    // EntryPoint canonico OZ v0.9 (constante ENTRYPOINT_V09 de ERC4337Utils)
    address public constant ENTRYPOINT_V09 = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;

    // Addresses CREATE2 esperadas para el build V3 CONGELADO. Se fijan al cerrar
    // C1-Core (test/Create2Consistency.t.sol las verifica contra el build en CI).
    // Con bytecode identico, CREATE2 reproduce estas mismas addresses en todas
    // las redes. Si la prediccion no coincide, NO desplegar.
    address public constant EXPECTED_REGISTRY      = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2; // FROZEN build 0.8.36/runs50/cancun
    address public constant EXPECTED_SMART_FACTORY = 0xD42F61AA856A4f47885Ecd2D0ce119411d53C192; // FROZEN build 0.8.36/runs50/cancun
    address public constant EXPECTED_AGENT_FACTORY = 0xd866a7563cDaC9F71423be3332b62c329C676064; // FROZEN build 0.8.36/runs50/cancun

    function predicted() public pure returns (address reg, address smart, address agent) {
        bytes memory ctorArgs = abi.encode(FACTORY_OWNER);
        reg = vm.computeCreate2Address(
            SALT_REGISTRY,
            keccak256(abi.encodePacked(type(BVCCValidatorRegistry).creationCode, ctorArgs))
        );
        smart = vm.computeCreate2Address(
            SALT_SMART,
            keccak256(abi.encodePacked(type(BVCCSmartWalletFactoryV3).creationCode, ctorArgs))
        );
        agent = vm.computeCreate2Address(
            SALT_AGENT,
            keccak256(abi.encodePacked(type(BVCCAgentWalletFactoryV3).creationCode, ctorArgs))
        );
    }

    function run() external {
        require(
            ENTRYPOINT_V09.code.length > 0,
            "EntryPoint v0.9 NO desplegado en esta chain - abortando"
        );

        (address predictedReg, address predictedSmart, address predictedAgent) = predicted();

        require(
            predictedReg == EXPECTED_REGISTRY,
            "ValidatorRegistry: bytecode distinto al build V3 esperado - NO desplegar"
        );
        require(
            predictedSmart == EXPECTED_SMART_FACTORY,
            "SmartWalletFactory: bytecode distinto al build V3 esperado - NO desplegar"
        );
        require(
            predictedAgent == EXPECTED_AGENT_FACTORY,
            "AgentWalletFactory: bytecode distinto al build V3 esperado - NO desplegar"
        );

        console.log("Chain ID:  ", block.chainid);
        console.log("Deployer:  ", msg.sender);
        console.log("EntryPoint v0.9 OK:", ENTRYPOINT_V09);
        console.log("");

        vm.startBroadcast();

        // 1) Registry — SIEMPRE primero: las wallets lo referencian como constante.
        if (EXPECTED_REGISTRY.code.length == 0) {
            new BVCCValidatorRegistry{salt: SALT_REGISTRY}(FACTORY_OWNER);
            console.log("BVCCValidatorRegistry desplegado:  ", EXPECTED_REGISTRY);
        } else {
            console.log("BVCCValidatorRegistry ya existia:  ", EXPECTED_REGISTRY);
        }

        // 2) Factories.
        if (EXPECTED_SMART_FACTORY.code.length == 0) {
            new BVCCSmartWalletFactoryV3{salt: SALT_SMART}(FACTORY_OWNER);
            console.log("BVCCSmartWalletFactoryV3 desplegada:", EXPECTED_SMART_FACTORY);
        } else {
            console.log("BVCCSmartWalletFactoryV3 ya existia: ", EXPECTED_SMART_FACTORY);
        }

        if (EXPECTED_AGENT_FACTORY.code.length == 0) {
            new BVCCAgentWalletFactoryV3{salt: SALT_AGENT}(FACTORY_OWNER);
            console.log("BVCCAgentWalletFactoryV3 desplegada:", EXPECTED_AGENT_FACTORY);
        } else {
            console.log("BVCCAgentWalletFactoryV3 ya existia: ", EXPECTED_AGENT_FACTORY);
        }

        vm.stopBroadcast();

        console.log("");
        console.log(">> Actualiza factory/agentFactory de esta chain en lib/networks.ts (frontend + SDK/MCP)");
    }
}
