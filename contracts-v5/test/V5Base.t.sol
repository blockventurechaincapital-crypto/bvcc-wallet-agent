// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {ERC7579Utils} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

import {BVCCSmartWalletV5} from "../src/BVCCSmartWalletV5.sol";
import {BVCCAgentWalletV5} from "../src/BVCCAgentWalletV5.sol";
import {BVCCAgentLogicV5} from "../src/BVCCAgentLogicV5.sol";
import {BVCCWalletFactoryV5} from "../src/BVCCWalletFactoryV5.sol";
import {BVCCValidatorRegistryV5} from "../src/BVCCValidatorRegistryV5.sol";
import {BVCCHookRegistryV5} from "../src/BVCCHookRegistryV5.sol";
import {IBVCCValidatorV5} from "../src/IBVCCValidatorV5.sol";

// -----------------------------------------------------------------------------
// Test doubles
// -----------------------------------------------------------------------------

contract MockToken is ERC20 {
    constructor(string memory n) ERC20(n, n) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev transfer/approve return false instead of reverting.
contract FalseToken is ERC20 {
    constructor() ERC20("F", "F") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }
}

/// @dev USDT-like: no return value, approve from non-zero to non-zero reverts.
contract UsdtLike {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        require(amount == 0 || allowance[msg.sender][spender] == 0, "USDT: reset first");
        allowance[msg.sender][spender] = amount;
    }
}

/// @dev Protocol that pulls tokens from the caller with whatever allowance exists.
contract Puller {
    using SafeERC20 for IERC20;

    function pull(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function pullTo(address token, uint256 amount, address to) external {
        IERC20(token).transferFrom(msg.sender, to, amount);
    }

    function pullFrom(address token, address from, uint256 amount) external {
        IERC20(token).transferFrom(from, address(this), amount);
    }

    function give(address token, uint256 amount) external {
        IERC20(token).transfer(msg.sender, amount);
    }

    function pin(address a, address b, uint256 c, bytes32 d) external {}

    function noop() external payable {}

    function pullMany(address[] calldata tokens) external {}

    /// @dev Token packed in a path, as routers do: not an ABI-aligned word.
    function pullPacked(bytes calldata path, uint256 amount) external {
        IERC20(address(bytes20(path[0:20]))).safeTransferFrom(msg.sender, address(this), amount);
    }
}

/// @dev Protocol that tries to re-enter the wallet during an agent batch.
contract Reenterer {
    function hit(address wallet, bytes32 mode, bytes calldata data) external {
        BVCCAgentWalletV5(payable(wallet)).execute(mode, data);
    }
}

/// @dev Validator double: answers whatever it was told.
contract MockValidator is IBVCCValidatorV5 {
    bool public ok = true;
    bool public post;
    bool public afterOk = true;
    bool public inflow;
    address[] public extra;
    Cost[] internal _costs;

    function set(bool ok_, bool post_, bool afterOk_) external {
        ok = ok_;
        post = post_;
        afterOk = afterOk_;
    }

    function setInflow(bool inflow_) external {
        inflow = inflow_;
    }

    function addExtra(address t) external {
        extra.push(t);
    }

    function addCost(address t, uint256 a) external {
        _costs.push(Cost(t, a));
    }

    function validate(address, address, address, uint256, bytes calldata)
        external
        view
        returns (bool, address[] memory, Cost[] memory, bool, bool)
    {
        return (ok, extra, _costs, post, inflow);
    }

    function validateAfter(address, address, address, bytes calldata) external view returns (bool) {
        return afterOk;
    }
}

/// @dev Minimal lending pool double: borrow sends tokens, health factor is settable.
contract MockLendingPool {
    uint256 public debt;
    uint256 public hf = 2e18;

    function setHealth(uint256 debt_, uint256 hf_) external {
        debt = debt_;
        hf = hf_;
    }

    function borrow(address asset, uint256 amount, uint256, uint16, address onBehalfOf) external {
        MockToken(asset).mint(onBehalfOf, amount);
        debt += amount;
    }

    function setUserEMode(uint8) external {}

    function getUserAccountData(address)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return (0, debt, 0, 0, 0, hf);
    }
}

// -----------------------------------------------------------------------------
// Base
// -----------------------------------------------------------------------------

abstract contract V5Base is Test {
    uint256 internal constant PK = 0xA11CE;
    uint256 internal constant PK2 = 0xB0B;
    address internal constant FEE = address(0xFEE);
    address internal constant ADMIN = address(0xAD);
    bytes internal constant CRED = hex"c0ffee01";

    BVCCValidatorRegistryV5 internal registry;
    BVCCHookRegistryV5 internal hookRegistry;
    BVCCSmartWalletV5 internal smartLogic;
    BVCCAgentWalletV5 internal agentLogic;
    BVCCWalletFactoryV5 internal smartFactory;
    BVCCWalletFactoryV5 internal agentFactory;

    bytes32 internal qx;
    bytes32 internal qy;

    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address internal constant AGENT_LIBRARY = 0x7504bf3c1230eF99eaEFAc03287c8F036CBb6D0E;
    bytes32 internal constant SALT_LIBRARY = bytes32(uint256(0x4256434305000001));

    /// @dev Places the agent library at its linked CREATE2 address, as on a real chain.
    function _deployLibrary() internal {
        if (AGENT_LIBRARY.code.length > 0) return;
        if (CREATE2_DEPLOYER.code.length == 0) {
            vm.etch(
                CREATE2_DEPLOYER,
                hex"7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3"
            );
        }
        (bool ok,) = CREATE2_DEPLOYER.call(
            abi.encodePacked(SALT_LIBRARY, vm.getCode("BVCCAgentLogicV5.sol:BVCCAgentLogicV5"))
        );
        require(ok && AGENT_LIBRARY.code.length > 0, "library not at its linked address");
    }

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        _deployLibrary();
        registry = new BVCCValidatorRegistryV5(ADMIN);
        hookRegistry = new BVCCHookRegistryV5(ADMIN);
        smartLogic = new BVCCSmartWalletV5(FEE);
        agentLogic = new BVCCAgentWalletV5(FEE, address(registry));
        smartFactory = new BVCCWalletFactoryV5(address(smartLogic), ADMIN);
        agentFactory = new BVCCWalletFactoryV5(address(agentLogic), ADMIN);
        (uint256 x, uint256 y) = vm.publicKeyP256(PK);
        qx = bytes32(x);
        qy = bytes32(y);
    }

    // ---------------------------------------------------------------- signing

    function _webauthn(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        bytes memory authData = abi.encodePacked(bytes32(0), bytes1(0x05), bytes4(0));
        string memory clientData = string.concat(
            '{"type":"webauthn.get","challenge":"', Base64.encodeURL(abi.encodePacked(digest)), '"}'
        );
        bytes32 messageHash = sha256(abi.encodePacked(authData, sha256(bytes(clientData))));
        (bytes32 r, bytes32 s) = vm.signP256(pk, messageHash);
        s = bytes32(Math.min(uint256(s), P256.N - uint256(s)));
        return abi.encode(r, s, uint256(23), uint256(1), authData, clientData);
    }

    function _credentialSig(uint256 pk, address wallet, bytes memory cred) internal pure returns (bytes memory) {
        return _webauthn(pk, keccak256(abi.encode("BVCC-V5-credential", wallet, cred)));
    }

    // ---------------------------------------------------------------- wallets

    function _createSmart() internal returns (BVCCSmartWalletV5) {
        address predicted = smartFactory.getWalletAddress(qx, qy);
        address w = smartFactory.createWallet(qx, qy, CRED, _credentialSig(PK, predicted, CRED));
        return BVCCSmartWalletV5(payable(w));
    }

    function _createAgent() internal returns (BVCCAgentWalletV5) {
        address predicted = agentFactory.getWalletAddress(qx, qy);
        address w = agentFactory.createWallet(qx, qy, CRED, _credentialSig(PK, predicted, CRED));
        return BVCCAgentWalletV5(payable(w));
    }

    // ---------------------------------------------------------------- batches

    function _mode() internal pure returns (bytes32) {
        return bytes32(abi.encodePacked(bytes1(0x01), bytes31(0)));
    }

    function _one(address target, uint256 value, bytes memory data) internal pure returns (bytes memory) {
        Execution[] memory b = new Execution[](1);
        b[0] = Execution(target, value, data);
        return abi.encode(b);
    }

    function _batch(Execution[] memory b) internal pure returns (bytes memory) {
        return abi.encode(b);
    }

    /// @dev Owner operation: the wallet calls itself (what a passkey UserOp ends up doing).
    function _asOwner(address wallet, address target, uint256 value, bytes memory data) internal {
        vm.prank(wallet);
        BVCCSmartWalletV5(payable(wallet)).execute(_mode(), _one(target, value, data));
    }

    function _self(address wallet, bytes memory data) internal {
        _asOwner(wallet, wallet, 0, data);
    }

    /// @dev Every agent protocol call needs a validator: registers a permissive one
    ///      (declares nothing, says yes) for a test protocol, through the 48 h timelock.
    function _openTarget(address target) internal returns (MockValidator v) {
        v = new MockValidator();
        vm.prank(ADMIN);
        registry.proposeValidator(target, address(v));
        vm.warp(vm.getBlockTimestamp() + 48 hours);
        vm.prank(ADMIN);
        registry.activateValidator(target);
    }
}
