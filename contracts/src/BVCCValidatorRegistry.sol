// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IBVCCValidator} from "./IBVCCValidator.sol";

/**
 * @title BVCCValidatorRegistry
 * @notice Fixed-address dispatch point for deep calldata validation of agent DeFi
 *         calls. Agent wallets (V3+) compile this registry's CREATE2 address in as
 *         a constant, so policies never carry validator addresses — a wallet owner
 *         cannot be phished into trusting a fake validator.
 *
 *         Trust model (disclosed in docs/legal):
 *          - Validators are pure view contracts dispatched by target protocol.
 *            They can only ANSWER yes/no; they can never move funds, and the
 *            in-wallet layers (selector default-deny, arg pinning, budgets)
 *            cannot be weakened from here.
 *          - Fail-closed: no validator registered for a target => validate()
 *            returns false => the wallet reverts the agent call.
 *          - Governance is asymmetric: freezing (deny direction) is immediate;
 *            registering or replacing a validator (allow direction) sits behind
 *            a 48h timelock with an on-chain event, giving wallet owners time to
 *            react (pauseAgents / revoke) to a malicious proposal.
 */
contract BVCCValidatorRegistry is IBVCCValidator {

    /// @notice Delay between proposing a validator (allow direction) and activation.
    uint256 public constant UPDATE_DELAY = 48 hours;

    /// @notice Admin allowed to manage validators (BVCC kill-switch admin wallet).
    address public immutable owner;

    /// @notice Active validator per target protocol. address(0) = none (deny).
    mapping(address => address) public validators;

    /// @notice Pending (timelocked) validator proposals per target protocol.
    mapping(address => address) public pendingValidator;
    mapping(address => uint256) public pendingReadyAt;

    error NotOwner();
    error NothingPending();
    error TimelockActive();
    error ZeroAddress();

    event ValidatorProposed(address indexed target, address indexed validator, uint256 readyAt);
    event ValidatorActivated(address indexed target, address indexed validator);
    event ValidatorFrozen(address indexed target);
    event ProposalCancelled(address indexed target);

    constructor(address owner_) {
        require(owner_ != address(0), ZeroAddress());
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, NotOwner());
        _;
    }

    // -------------------------------------------------------------------------
    // Dispatch (called by agent wallets via staticcall)
    // -------------------------------------------------------------------------

    /// @notice Fail-closed dispatch: no validator for `target` => false.
    ///         A revert inside the validator bubbles up and equally denies.
    function validate(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool) {
        address v = validators[target];
        if (v == address(0)) return false;
        return IBVCCValidator(v).validate(wallet, target, value, data);
    }

    // -------------------------------------------------------------------------
    // Governance — immediate to deny, timelocked to allow
    // -------------------------------------------------------------------------

    /// @notice Propose a validator for a target protocol. Activates after 48h.
    function proposeValidator(address target, address validator) external onlyOwner {
        require(validator != address(0), ZeroAddress());
        pendingValidator[target] = validator;
        uint256 readyAt = block.timestamp + UPDATE_DELAY;
        pendingReadyAt[target] = readyAt;
        emit ValidatorProposed(target, validator, readyAt);
    }

    /// @notice Activate a proposal once its timelock has elapsed.
    function activateValidator(address target) external onlyOwner {
        address v = pendingValidator[target];
        require(v != address(0), NothingPending());
        require(block.timestamp >= pendingReadyAt[target], TimelockActive());
        validators[target] = v;
        delete pendingValidator[target];
        delete pendingReadyAt[target];
        emit ValidatorActivated(target, v);
    }

    /// @notice Cancel a pending proposal (deny direction — immediate).
    function cancelProposal(address target) external onlyOwner {
        delete pendingValidator[target];
        delete pendingReadyAt[target];
        emit ProposalCancelled(target);
    }

    /// @notice Immediately disable the validator for a target (deny direction).
    ///         Agent calls gated by DEEP_VALIDATION on that target revert until a
    ///         new validator passes the timelock.
    function freezeValidator(address target) external onlyOwner {
        delete validators[target];
        emit ValidatorFrozen(target);
    }
}
