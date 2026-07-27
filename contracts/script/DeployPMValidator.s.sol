// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/BVCCPositionManagerValidator.sol";
import "../src/BVCCHookRegistry.sol";

/**
 * @notice Deploy BVCCPositionManagerValidator (v4 LP deep-validation) and print the
 *         governance steps to enable it. Deploy the BVCCHookRegistry FIRST — this
 *         validator carries its address as a constructor arg (recomputed here from
 *         the same deterministic CREATE2 inputs, so it matches on every chain).
 *
 *         The validator is BOUND to one v4 PositionManager (per chain), so its own
 *         CREATE2 address differs by network — that is fine, only the hook registry
 *         needs a fixed address. Pass POSITION_MANAGER per chain.
 *
 *         Enabling v4 LP for agents is a two-step, timelocked governance action by
 *         the BVCCValidatorRegistry owner (admin wallet), NOT this deployer:
 *           1) registry.proposeValidator(POSITION_MANAGER, <thisValidator>)
 *           2) after 48h: registry.activateValidator(POSITION_MANAGER)
 *         Then each wallet owner sets a DEEP_VALIDATION policy on
 *         (PositionManager, modifyLiquidities) via Face ID.
 *
 *  Dry-run:  POSITION_MANAGER=<pm> forge script script/DeployPMValidator.s.sol --rpc-url <rpc>
 *  Deploy:   add --broadcast --verify --chain <id> --etherscan-api-key $KEY --interactives 1
 */
contract DeployPMValidator is Script {
    // ...0A follows the UR validator salt (...09); the hook registry is ...0B.
    bytes32 public constant SALT_PMVALIDATOR = bytes32(uint256(0x425643430000000A));
    bytes32 public constant SALT_HOOK_REGISTRY = bytes32(uint256(0x425643430000000B));

    address public constant REGISTRY = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2;
    address public constant ADMIN = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    /// @notice v4 PositionManager per chain. Default = Arbitrum One. ALWAYS pass per chain.
    function positionManager() public view returns (address) {
        return vm.envOr("POSITION_MANAGER", 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869);
    }

    /// @dev The hook registry's deterministic address (same on every chain).
    function hookRegistry() public view returns (address) {
        return vm.computeCreate2Address(
            SALT_HOOK_REGISTRY,
            keccak256(abi.encodePacked(type(BVCCHookRegistry).creationCode, abi.encode(ADMIN)))
        );
    }

    function predicted() public view returns (address) {
        return vm.computeCreate2Address(
            SALT_PMVALIDATOR,
            keccak256(
                abi.encodePacked(
                    type(BVCCPositionManagerValidator).creationCode,
                    abi.encode(positionManager(), hookRegistry())
                )
            )
        );
    }

    function run() external {
        address pm = positionManager();
        address hr = hookRegistry();
        address pv = predicted();
        require(pm.code.length > 0, "POSITION_MANAGER sin bytecode en esta red - revisa la address");
        require(hr.code.length > 0, "hook registry no desplegado en esta red - despliegalo primero");

        vm.startBroadcast();
        if (pv.code.length == 0) {
            new BVCCPositionManagerValidator{salt: SALT_PMVALIDATOR}(pm, hr);
        }
        vm.stopBroadcast();

        // ---- Pre-registration safety checks ----
        require(pv.code.length > 0, "validator not deployed");
        // 1) Bound to EXACTLY the PositionManager that will be registered.
        require(
            BVCCPositionManagerValidator(pv).POSITION_MANAGER() == pm,
            "validator.POSITION_MANAGER() != target a registrar - NO registrar"
        );
        // 2) Points at the fixed hook registry.
        require(
            address(BVCCPositionManagerValidator(pv).HOOK_REGISTRY()) == hr,
            "validator.HOOK_REGISTRY() != registry esperado - NO registrar"
        );

        bytes32 pmCodehash = pm.codehash;
        bytes32 validatorCodehash = pv.codehash;

        console.log("=== BVCC PositionManager Validator deployment record ===");
        console.log("chainId:             ", block.chainid);
        console.log("registry (fixed):    ", REGISTRY);
        console.log("hookRegistry (fixed):", hr);
        console.log("positionManager:     ", pm);
        console.log("pm codehash:         ", vm.toString(pmCodehash));
        console.log("validator:           ", pv);
        console.log("validator codehash:  ", vm.toString(validatorCodehash));

        string memory k = "pmvalidator";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "registry", REGISTRY);
        vm.serializeAddress(k, "hookRegistry", hr);
        vm.serializeAddress(k, "positionManager", pm);
        vm.serializeBytes32(k, "pmCodehash", pmCodehash);
        vm.serializeAddress(k, "validator", pv);
        string memory json = vm.serializeBytes32(k, "validatorCodehash", validatorCodehash);
        vm.writeJson(json, string.concat("deployments/pm-validator.", vm.toString(block.chainid), ".json"));

        console.log("");
        console.log(">> GOBERNANZA (admin wallet, NO el deployer):");
        console.log("   1) registry.proposeValidator(positionManager, validator)  [addresses arriba]");
        console.log("   2) +48h: registry.activateValidator(positionManager)");
        console.log(">> Antes de activar: re-verifica pm codehash contra el manifiesto.");
        console.log(">> Luego cada owner activa DEEP en su policy (PositionManager, modifyLiquidities) con Face ID.");
    }
}
