// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IBVCCValidatorV5} from "./IBVCCValidatorV5.sol";

/// @title BVCCValidatorRegistryV5
/// @notice Dispatches deep validation of agent protocol calls to one validator per
///         target contract. Agent wallets fix this registry's address for life.
///         Governance only restricts at once (cancel, freeze); allowing a new or
///         replaced validator waits UPDATE_DELAY behind a visible on-chain event.
///         No validator for a target means no.
contract BVCCValidatorRegistryV5 is IBVCCValidatorV5, Ownable2Step {
    uint256 public constant UPDATE_DELAY = 48 hours;

    mapping(address target => address) public validators;
    mapping(address target => address) public pendingValidator;
    mapping(address target => uint256) public pendingReadyAt;

    error NothingPending();
    error TimelockActive();
    error ZeroAddress();

    event ValidatorProposed(address indexed target, address indexed validator, uint256 readyAt);
    event ValidatorActivated(address indexed target, address indexed validator);
    event ValidatorFrozen(address indexed target);
    event ProposalCancelled(address indexed target);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @inheritdoc IBVCCValidatorV5
    function validate(address agent, address wallet, address target, uint256 value, bytes calldata data)
        external
        view
        returns (
            bool ok,
            address[] memory tokensToMeasure,
            Cost[] memory costs,
            bool wantsPostCheck,
            bool chargeInflow
        )
    {
        address v = validators[target];
        if (v == address(0)) return (false, tokensToMeasure, costs, false, false);
        return IBVCCValidatorV5(v).validate(agent, wallet, target, value, data);
    }

    /// @inheritdoc IBVCCValidatorV5
    function validateAfter(address agent, address wallet, address target, bytes calldata data)
        external
        view
        returns (bool)
    {
        address v = validators[target];
        if (v == address(0)) return false;
        return IBVCCValidatorV5(v).validateAfter(agent, wallet, target, data);
    }

    function proposeValidator(address target, address validator) external onlyOwner {
        if (validator == address(0) || target == address(0)) revert ZeroAddress();
        uint256 readyAt = block.timestamp + UPDATE_DELAY;
        pendingValidator[target] = validator;
        pendingReadyAt[target] = readyAt;
        emit ValidatorProposed(target, validator, readyAt);
    }

    function activateValidator(address target) external onlyOwner {
        address v = pendingValidator[target];
        if (v == address(0)) revert NothingPending();
        if (block.timestamp < pendingReadyAt[target]) revert TimelockActive();
        validators[target] = v;
        delete pendingValidator[target];
        delete pendingReadyAt[target];
        emit ValidatorActivated(target, v);
    }

    function cancelProposal(address target) external onlyOwner {
        delete pendingValidator[target];
        delete pendingReadyAt[target];
        emit ProposalCancelled(target);
    }

    /// @notice Disables the validator of a target at once. Any pending proposal for it is cancelled too.
    function freezeValidator(address target) external onlyOwner {
        delete validators[target];
        delete pendingValidator[target];
        delete pendingReadyAt[target];
        emit ValidatorFrozen(target);
    }

    /// @dev Ownership can be handed over (two steps) but never dropped: without an
    ///      owner, no frozen validator could ever be replaced.
    function renounceOwnership() public view override onlyOwner {
        revert OwnableInvalidOwner(address(0));
    }
}
