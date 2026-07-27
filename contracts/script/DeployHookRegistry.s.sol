// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/BVCCHookRegistry.sol";

/**
 * @notice Deploy BVCCHookRegistry via CREATE2 — SAME address on every chain (fixed
 *         salt + fixed owner arg + the standard deterministic CREATE2 proxy). This
 *         determinism matters: the BVCCPositionManagerValidator on every chain
 *         carries this registry's address, so it must match everywhere. Deploy the
 *         hook registry FIRST, then the PM validators.
 *
 *         Standalone: it does NOT touch the BVCCValidatorRegistry or the deployed
 *         wallets. Owner = the BVCC admin (kill-switch) wallet — the same admin that
 *         governs the validators. Approving a hook is a separate, timelocked step:
 *           1) hookRegistry.proposeHook(<hook>)
 *           2) after 48h: hookRegistry.activateHook(<hook>)
 *         Pools with no hook (address(0)) work without registering anything.
 *
 *  Dry-run:  forge script script/DeployHookRegistry.s.sol --rpc-url <rpc>
 *  Deploy:   add --broadcast --verify --chain <id> --etherscan-api-key $KEY --interactives 1
 */
contract DeployHookRegistry is Script {
    // 0x42564343 = "BVCC"; ...0B follows the UR validator (...09) and PM validator (...0A) salts.
    bytes32 public constant SALT_HOOK_REGISTRY = bytes32(uint256(0x425643430000000B));

    /// @notice Admin / kill-switch owner — same on every chain (fixed → deterministic address).
    address public constant ADMIN = 0x3145Bd5e2489d8bDdAb17F23F26F07Ac5aD55A4c;

    function predicted() public view returns (address) {
        return vm.computeCreate2Address(
            SALT_HOOK_REGISTRY,
            keccak256(abi.encodePacked(type(BVCCHookRegistry).creationCode, abi.encode(ADMIN)))
        );
    }

    function run() external {
        address hr = predicted();

        vm.startBroadcast();
        if (hr.code.length == 0) {
            new BVCCHookRegistry{salt: SALT_HOOK_REGISTRY}(ADMIN);
        }
        vm.stopBroadcast();

        // Post-deploy invariants.
        require(hr.code.length > 0, "hook registry not deployed");
        require(BVCCHookRegistry(hr).owner() == ADMIN, "owner mismatch - DO NOT USE");

        bytes32 codehash = hr.codehash;
        console.log("=== BVCC Hook Registry deployment record ===");
        console.log("chainId:          ", block.chainid);
        console.log("hookRegistry:     ", hr, "(same address on every chain)");
        console.log("owner (admin):    ", ADMIN);
        console.log("codehash:         ", vm.toString(codehash));

        string memory k = "hookregistry";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeAddress(k, "hookRegistry", hr);
        vm.serializeAddress(k, "owner", ADMIN);
        string memory json = vm.serializeBytes32(k, "codehash", codehash);
        vm.writeJson(json, string.concat("deployments/hook-registry.", vm.toString(block.chainid), ".json"));

        console.log("");
        console.log(">> Next: deploy BVCCPositionManagerValidator per chain (it takes this address).");
        console.log(">> To approve a curated hook (admin, timelocked):");
        console.log("   1) hookRegistry.proposeHook(<hook>)   2) +48h: hookRegistry.activateHook(<hook>)");
    }
}
