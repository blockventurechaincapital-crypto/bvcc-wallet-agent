// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/BVCCUniversalRouterValidator.sol";

/**
 * @notice Stage-2b: deploy BVCCUniversalRouterValidator (CREATE2 — same address on
 *         every chain; chain-agnostic, no constructor args) and print the governance
 *         steps to enable it.
 *
 *         The validator's address is NOT baked into the wallet — the wallet only
 *         hardcodes the registry. Enabling UR swaps for agents is a two-step,
 *         timelocked governance action performed by the registry owner (admin
 *         wallet), NOT by this deployer:
 *
 *           1) registry.proposeValidator(UNIVERSAL_ROUTER, <thisValidator>)
 *           2) after 48h: registry.activateValidator(UNIVERSAL_ROUTER)
 *
 *         Only after activation, and after each wallet owner sets a DEEP_VALIDATION
 *         call policy on (UR, execute) via Face ID, can agents swap through the UR.
 *
 *  Dry-run:  forge script script/DeployURValidator.s.sol --rpc-url <rpc>
 *  Deploy:   add --broadcast --verify --chain <id> --etherscan-api-key $KEY --interactives 1
 */
contract DeployURValidator is Script {
    // 0x42564343 = "BVCC"; ...09 follows the registry/factory V3 salts (...06/07/08).
    bytes32 public constant SALT_URVALIDATOR = bytes32(uint256(0x4256434300000009));

    address public constant REGISTRY = 0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2;

    // The validator is BOUND to one Universal Router address (≈ one command-table
    // version). Set UR per chain — the address differs by network, so the validator's
    // CREATE2 address also differs per network (that is fine: only the registry needs a
    // fixed address). ALWAYS pass UNIVERSAL_ROUTER per chain; the default is only
    // Arbitrum One's canonical v4 UR (from Uniswap's official v4 deployments docs).
    function universalRouter() public view returns (address) {
        return vm.envOr("UNIVERSAL_ROUTER", 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3);
    }

    function predicted() public view returns (address) {
        return vm.computeCreate2Address(
            SALT_URVALIDATOR,
            keccak256(abi.encodePacked(type(BVCCUniversalRouterValidator).creationCode, abi.encode(universalRouter())))
        );
    }

    function run() external {
        address ur = universalRouter();
        address pv = predicted();
        require(ur.code.length > 0, "UNIVERSAL_ROUTER sin bytecode en esta red - revisa la address");

        vm.startBroadcast();
        if (pv.code.length == 0) {
            new BVCCUniversalRouterValidator{salt: SALT_URVALIDATOR}(ur);
        }
        vm.stopBroadcast();

        // ---- Pre-registration safety checks ----
        // 1) The validator must be bound to EXACTLY the router that will be registered.
        address boundRouter = BVCCUniversalRouterValidator(pv).UNIVERSAL_ROUTER();
        require(boundRouter == ur, "validator.UNIVERSAL_ROUTER() != target a registrar - NO registrar");

        // 2) Per-network provenance record (chainId, UR + its codehash, validator + codehash).
        bytes32 routerCodehash = ur.codehash;
        bytes32 validatorCodehash = pv.codehash;

        console.log("=== BVCC UR Validator deployment record ===");
        console.log("chainId:            ", block.chainid);
        console.log("registry (fixed):   ", REGISTRY);
        console.log("universalRouter:    ", ur);
        console.log("router codehash:    ", vm.toString(routerCodehash));
        console.log("validator:          ", pv);
        console.log("validator codehash: ", vm.toString(validatorCodehash));
        console.log("bound check OK:     ", boundRouter == ur);

        // Write a JSON manifest per chain so registration is auditable off-chain.
        string memory k = "urvalidator";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "registry", REGISTRY);
        vm.serializeAddress(k, "universalRouter", ur);
        vm.serializeBytes32(k, "routerCodehash", routerCodehash);
        vm.serializeAddress(k, "validator", pv);
        string memory json = vm.serializeBytes32(k, "validatorCodehash", validatorCodehash);
        vm.writeJson(json, string.concat("deployments/ur-validator.", vm.toString(block.chainid), ".json"));

        console.log("");
        console.log(">> GOBERNANZA (admin wallet, NO el deployer):");
        console.log("   1) registry.proposeValidator(universalRouter, validator)  [address arriba]");
        console.log("   2) +48h: registry.activateValidator(universalRouter)");
        console.log(">> Antes de activar: re-verifica router codehash contra el manifiesto.");
        console.log(">> Luego cada owner activa DEEP en su policy (UR, execute) con Face ID.");
    }
}
