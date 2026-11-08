// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";
import {BVCCValidatorRegistryV5} from "../src/BVCCValidatorRegistryV5.sol";
import {BVCCUniversalRouterValidatorV5} from "../src/validators/BVCCUniversalRouterValidatorV5.sol";
import {BVCCPositionManagerValidatorV5} from "../src/validators/BVCCPositionManagerValidatorV5.sol";
import {BVCCAaveV3ValidatorV5} from "../src/validators/BVCCAaveV3ValidatorV5.sol";
import {BVCCV3PositionManagerValidatorV5} from "../src/validators/BVCCV3PositionManagerValidatorV5.sol";
import {BVCCWrappedNativeValidatorV5} from "../src/validators/BVCCWrappedNativeValidatorV5.sol";
import {DeployV5} from "./DeployV5.s.sol";

/// @notice Deploys the validators of one chain with CREATE2 and prints the registry
///         calls the ADMIN must send. Registering is not done here: it is the
///         ADMIN's job (proposeValidator, then activateValidator after 48 hours).
///
///         Inputs (environment): FEE_WALLET and ADMIN (as for DeployV5, to find the
///         registries), and the protocol addresses of this chain. A protocol left
///         unset is skipped:
///           UNIVERSAL_ROUTER, POSITION_MANAGER (Uniswap v4), AAVE_POOL (Aave v3),
///           NFPM_V3 (Uniswap v3 NonfungiblePositionManager),
///           WRAPPED_NATIVE (WETH / WBNB / WPOL, the WETH9 interface)
contract DeployValidatorsV5 is Script {
    address public constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 public constant SALT_VALIDATOR = bytes32(uint256(0x4256434305000010));

    function run() external {
        DeployV5 core = new DeployV5();
        DeployV5.Addresses memory a = core.predict(vm.envAddress("FEE_WALLET"), vm.envAddress("ADMIN"));
        require(a.registry.code.length > 0 && a.hookRegistry.code.length > 0, "deploy the V5 core first");

        address router = vm.envOr("UNIVERSAL_ROUTER", address(0));
        address positionManager = vm.envOr("POSITION_MANAGER", address(0));
        address aavePool = vm.envOr("AAVE_POOL", address(0));
        address nfpmV3 = vm.envOr("NFPM_V3", address(0));
        address wrappedNative = vm.envOr("WRAPPED_NATIVE", address(0));

        vm.startBroadcast();
        if (router != address(0)) {
            _deploy(
                "UniversalRouter",
                router,
                abi.encodePacked(
                    type(BVCCUniversalRouterValidatorV5).creationCode, abi.encode(router, a.hookRegistry)
                ),
                a.registry
            );
        }
        if (positionManager != address(0)) {
            _deploy(
                "PositionManager",
                positionManager,
                abi.encodePacked(
                    type(BVCCPositionManagerValidatorV5).creationCode, abi.encode(positionManager, a.hookRegistry)
                ),
                a.registry
            );
        }
        if (aavePool != address(0)) {
            _deploy(
                "AaveV3Pool",
                aavePool,
                abi.encodePacked(type(BVCCAaveV3ValidatorV5).creationCode, abi.encode(aavePool)),
                a.registry
            );
        }
        if (nfpmV3 != address(0)) {
            _deploy(
                "UniswapV3PositionManager",
                nfpmV3,
                abi.encodePacked(type(BVCCV3PositionManagerValidatorV5).creationCode, abi.encode(nfpmV3)),
                a.registry
            );
        }
        if (wrappedNative != address(0)) {
            _deploy(
                "WrappedNative",
                wrappedNative,
                abi.encodePacked(type(BVCCWrappedNativeValidatorV5).creationCode, abi.encode(wrappedNative)),
                a.registry
            );
        }
        vm.stopBroadcast();
    }

    function _deploy(string memory name, address target, bytes memory initCode, address registry) internal {
        address v = vm.computeCreate2Address(SALT_VALIDATOR, keccak256(initCode), CREATE2_DEPLOYER);
        if (v.code.length == 0) {
            (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(SALT_VALIDATOR, initCode));
            require(ok && v.code.length > 0, "validator deployment failed");
        }
        console.log(name);
        console.log("  target   ", target);
        console.log("  validator", v);
        console.log("  ADMIN call to the registry", registry, ", then activateValidator(target) after 48 h:");
        console.logBytes(abi.encodeCall(BVCCValidatorRegistryV5.proposeValidator, (target, v)));
    }
}
