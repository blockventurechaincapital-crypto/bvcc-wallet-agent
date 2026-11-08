// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script, console} from "forge-std/Script.sol";
import {BVCCSmartWalletV5} from "../src/BVCCSmartWalletV5.sol";
import {BVCCAgentWalletV5} from "../src/BVCCAgentWalletV5.sol";
import {BVCCWalletFactoryV5} from "../src/BVCCWalletFactoryV5.sol";
import {BVCCValidatorRegistryV5} from "../src/BVCCValidatorRegistryV5.sol";
import {BVCCHookRegistryV5} from "../src/BVCCHookRegistryV5.sol";

/// @notice Deploys the V5 core with CREATE2 through the standard deployer, so every
///         address is the same on every chain for the same build and the same inputs.
///
///         Order: agent library, validator registry, hook registry, standard logic,
///         agent logic, standard factory, agent factory. Validators are per chain and
///         go in DeployValidatorsV5.s.sol.
///
///         Inputs (environment):
///           FEE_WALLET  fee treasury, the same address on every chain
///           ADMIN       owner of the registries and of the factories' kill switch
///         Both enter the constructors, so they fix the addresses. On a mainnet the
///         predicted addresses must equal the pinned EXPECTED_* values or nothing is sent.
///
///         Dry run:  forge script script/DeployV5.s.sol --rpc-url <rpc>
///         Deploy:   forge script script/DeployV5.s.sol --rpc-url <rpc> --broadcast --verify \
///                     --chain <id> --etherscan-api-key $ETHERSCAN_API_KEY --interactives 1
///         Re-running is safe: anything already deployed is skipped.
contract DeployV5 is Script {
    address public constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address public constant ENTRYPOINT_V09 = 0x433709009B8330FDa32311DF1C2AFA402eD8D009;

    /// @dev Must equal the address in foundry.toml `libraries`.
    address public constant LINKED_LIBRARY = 0x7504bf3c1230eF99eaEFAc03287c8F036CBb6D0E;

    bytes32 public constant SALT_LIBRARY = bytes32(uint256(0x4256434305000001));
    bytes32 public constant SALT_REGISTRY = bytes32(uint256(0x4256434305000002));
    bytes32 public constant SALT_HOOK_REGISTRY = bytes32(uint256(0x4256434305000003));
    bytes32 public constant SALT_SMART_LOGIC = bytes32(uint256(0x4256434305000004));
    bytes32 public constant SALT_AGENT_LOGIC = bytes32(uint256(0x4256434305000005));
    bytes32 public constant SALT_SMART_FACTORY = bytes32(uint256(0x4256434305000006));
    bytes32 public constant SALT_AGENT_FACTORY = bytes32(uint256(0x4256434305000007));

    /// @dev Pinned once FEE_WALLET and ADMIN are final and the build is frozen. Zero = not pinned.
    address public constant EXPECTED_SMART_FACTORY = 0x2672951DC1E3f865BA6Fc98e5509dc4B23B260a2;
    address public constant EXPECTED_AGENT_FACTORY = 0xE36fb66c21C38536454C1a58fBC5EB1Cb455aD52;

    struct Addresses {
        address library_;
        address registry;
        address hookRegistry;
        address smartLogic;
        address agentLogic;
        address smartFactory;
        address agentFactory;
    }

    // ------------------------------------------------------------------ prediction

    function initCodes(address feeWallet, address admin)
        public
        view
        returns (bytes[7] memory codes, bytes32[7] memory salts)
    {
        Addresses memory a = predict(feeWallet, admin);
        codes[0] = vm.getCode("BVCCAgentLogicV5.sol:BVCCAgentLogicV5");
        codes[1] = abi.encodePacked(type(BVCCValidatorRegistryV5).creationCode, abi.encode(admin));
        codes[2] = abi.encodePacked(type(BVCCHookRegistryV5).creationCode, abi.encode(admin));
        codes[3] = abi.encodePacked(type(BVCCSmartWalletV5).creationCode, abi.encode(feeWallet));
        codes[4] = abi.encodePacked(type(BVCCAgentWalletV5).creationCode, abi.encode(feeWallet, a.registry));
        codes[5] = abi.encodePacked(type(BVCCWalletFactoryV5).creationCode, abi.encode(a.smartLogic, admin));
        codes[6] = abi.encodePacked(type(BVCCWalletFactoryV5).creationCode, abi.encode(a.agentLogic, admin));
        salts = [
            SALT_LIBRARY,
            SALT_REGISTRY,
            SALT_HOOK_REGISTRY,
            SALT_SMART_LOGIC,
            SALT_AGENT_LOGIC,
            SALT_SMART_FACTORY,
            SALT_AGENT_FACTORY
        ];
    }

    function predict(address feeWallet, address admin) public view returns (Addresses memory a) {
        a.library_ = _at(SALT_LIBRARY, vm.getCode("BVCCAgentLogicV5.sol:BVCCAgentLogicV5"));
        a.registry = _at(SALT_REGISTRY, abi.encodePacked(type(BVCCValidatorRegistryV5).creationCode, abi.encode(admin)));
        a.hookRegistry =
            _at(SALT_HOOK_REGISTRY, abi.encodePacked(type(BVCCHookRegistryV5).creationCode, abi.encode(admin)));
        a.smartLogic =
            _at(SALT_SMART_LOGIC, abi.encodePacked(type(BVCCSmartWalletV5).creationCode, abi.encode(feeWallet)));
        a.agentLogic = _at(
            SALT_AGENT_LOGIC,
            abi.encodePacked(type(BVCCAgentWalletV5).creationCode, abi.encode(feeWallet, a.registry))
        );
        a.smartFactory = _at(
            SALT_SMART_FACTORY, abi.encodePacked(type(BVCCWalletFactoryV5).creationCode, abi.encode(a.smartLogic, admin))
        );
        a.agentFactory = _at(
            SALT_AGENT_FACTORY, abi.encodePacked(type(BVCCWalletFactoryV5).creationCode, abi.encode(a.agentLogic, admin))
        );
    }

    function _at(bytes32 salt, bytes memory initCode) internal pure returns (address) {
        return vm.computeCreate2Address(salt, keccak256(initCode), CREATE2_DEPLOYER);
    }

    // ------------------------------------------------------------------ deployment

    function run() external {
        address feeWallet = vm.envAddress("FEE_WALLET");
        address admin = vm.envAddress("ADMIN");
        require(ENTRYPOINT_V09.code.length > 0, "EntryPoint v0.9 missing on this chain");
        require(CREATE2_DEPLOYER.code.length > 0, "CREATE2 deployer missing on this chain");

        Addresses memory a = predict(feeWallet, admin);
        _checkPins(a);

        console.log("chainId      ", block.chainid);
        console.log("feeWallet    ", feeWallet);
        console.log("admin        ", admin);
        vm.startBroadcast();
        deployAll(feeWallet, admin);
        vm.stopBroadcast();
        verify(a, feeWallet, admin);
        _log(a);
    }

    /// @notice Deploys whatever is missing. Callers broadcast around it.
    function deployAll(address feeWallet, address admin) public returns (Addresses memory a) {
        a = predict(feeWallet, admin);
        require(a.library_ == LINKED_LIBRARY, "library address differs from the linked one");
        (bytes[7] memory codes, bytes32[7] memory salts) = initCodes(feeWallet, admin);
        address[7] memory targets =
            [a.library_, a.registry, a.hookRegistry, a.smartLogic, a.agentLogic, a.smartFactory, a.agentFactory];
        for (uint256 i = 0; i < 7; i++) {
            if (targets[i].code.length > 0) continue;
            (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(salts[i], codes[i]));
            require(ok && targets[i].code.length > 0, "CREATE2 deployment failed");
        }
    }

    /// @notice Reads every deployed contract back and checks how it was wired.
    function verify(Addresses memory a, address feeWallet, address admin) public view {
        require(BVCCValidatorRegistryV5(a.registry).owner() == admin, "registry owner");
        require(BVCCHookRegistryV5(a.hookRegistry).owner() == admin, "hook registry owner");
        require(BVCCSmartWalletV5(payable(a.smartLogic)).BVCC_FEE_WALLET() == feeWallet, "smart fee wallet");
        require(BVCCAgentWalletV5(payable(a.agentLogic)).BVCC_FEE_WALLET() == feeWallet, "agent fee wallet");
        require(BVCCAgentWalletV5(payable(a.agentLogic)).VALIDATOR_REGISTRY() == a.registry, "agent registry");
        require(BVCCWalletFactoryV5(a.smartFactory).implementation() == a.smartLogic, "smart factory logic");
        require(BVCCWalletFactoryV5(a.agentFactory).implementation() == a.agentLogic, "agent factory logic");
        require(BVCCWalletFactoryV5(a.smartFactory).owner() == admin, "smart factory owner");
        require(BVCCWalletFactoryV5(a.agentFactory).owner() == admin, "agent factory owner");
        require(!BVCCWalletFactoryV5(a.smartFactory).killed() && !BVCCWalletFactoryV5(a.agentFactory).killed(), "killed");
    }

    function _checkPins(Addresses memory a) internal view {
        bool mainnet = block.chainid == 1 || block.chainid == 42161 || block.chainid == 56 || block.chainid == 8453
            || block.chainid == 137;
        if (!mainnet) return;
        require(EXPECTED_SMART_FACTORY != address(0) && EXPECTED_AGENT_FACTORY != address(0), "mainnet: pins not set");
        require(a.smartFactory == EXPECTED_SMART_FACTORY, "mainnet: smart factory differs from the pinned build");
        require(a.agentFactory == EXPECTED_AGENT_FACTORY, "mainnet: agent factory differs from the pinned build");
    }

    function _log(Addresses memory a) internal pure {
        console.log("agentLibrary ", a.library_);
        console.log("registry     ", a.registry);
        console.log("hookRegistry ", a.hookRegistry);
        console.log("smartLogic   ", a.smartLogic);
        console.log("agentLogic   ", a.agentLogic);
        console.log("smartFactory ", a.smartFactory);
        console.log("agentFactory ", a.agentFactory);
    }
}
