// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";

/// @dev Random guardian behaviour over three candidate keys.
contract RecoveryHandler is Test {
    BVCCSmartWalletV5 internal wallet;
    address[3] internal guardians;
    bytes32[3] internal xs;
    bytes32[3] internal ys;

    /// Times a guardian disarmed or replaced a proposal it was not holding up.
    uint256 public soloInterference;
    /// Times the owner key changed without an armed proposal past its delay.
    uint256 public earlyRotation;
    uint256 public executed;

    constructor(BVCCSmartWalletV5 w, address[3] memory g, bytes32[3] memory x, bytes32[3] memory y) {
        wallet = w;
        guardians = g;
        xs = x;
        ys = y;
    }

    function _id(uint256 k) internal view returns (bytes32) {
        return keccak256(abi.encode(xs[k], ys[k], keccak256(hex"01")));
    }

    function _heldUpBy(bytes32 id, uint256 slot) internal view returns (bool) {
        return wallet.recoveryVotes()[slot] == id;
    }

    function _countFor(bytes32 id) internal view returns (uint256 c) {
        bytes32[3] memory v = wallet.recoveryVotes();
        for (uint256 i = 0; i < 3; i++) {
            if (v[i] == id) c++;
        }
    }

    function _afterAction(uint256 slot, bytes32 armedBefore, bool actorHeldIt) internal {
        (bytes32 armedAfter,) = wallet.armedRecovery();
        if (armedBefore != bytes32(0) && armedAfter != armedBefore && !actorHeldIt) soloInterference++;
    }

    function vote(uint256 g, uint256 k) external {
        g = bound(g, 0, 2);
        k = bound(k, 0, 2);
        (bytes32 armedBefore,) = wallet.armedRecovery();
        bool held = armedBefore != bytes32(0) && _heldUpBy(armedBefore, g);
        vm.prank(guardians[g]);
        try wallet.voteRecovery(xs[k], ys[k], hex"01") {} catch {}
        _afterAction(g, armedBefore, held);
    }

    function withdraw(uint256 g) external {
        g = bound(g, 0, 2);
        (bytes32 armedBefore,) = wallet.armedRecovery();
        bool held = armedBefore != bytes32(0) && _heldUpBy(armedBefore, g);
        vm.prank(guardians[g]);
        try wallet.withdrawRecoveryVote() {} catch {}
        _afterAction(g, armedBefore, held);
    }

    function execute(uint256 g) external {
        g = bound(g, 0, 2);
        (bytes32 armedBefore, uint256 readyAt) = wallet.armedRecovery();
        (bytes32 keyBefore,) = wallet.signer();
        vm.prank(guardians[g]);
        try wallet.executeRecovery() {
            executed++;
        } catch {}
        (bytes32 keyAfter,) = wallet.signer();
        if (keyAfter != keyBefore && (armedBefore == bytes32(0) || vm.getBlockTimestamp() < readyAt)) {
            earlyRotation++;
        }
    }

    function wait(uint256 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1, 30 hours));
    }
}

contract RecoveryInvariantsV5Test is V5Base {
    BVCCSmartWalletV5 internal wallet;
    RecoveryHandler internal handler;

    function setUp() public override {
        super.setUp();
        wallet = _createSmart();
        address[3] memory g = [address(0x6000), address(0x6001), address(0x6002)];
        _self(address(wallet), abi.encodeCall(BVCCSmartWalletV5.setGuardians, (g)));
        bytes32[3] memory xs;
        bytes32[3] memory ys;
        uint256[3] memory pks = [uint256(0xB0B), 0xC0DE, 0xD00D];
        for (uint256 i = 0; i < 3; i++) {
            (uint256 x, uint256 y) = vm.publicKeyP256(pks[i]);
            xs[i] = bytes32(x);
            ys[i] = bytes32(y);
        }
        handler = new RecoveryHandler(wallet, g, xs, ys);
        targetContract(address(handler));
    }

    function test_HandlerCanRecover() public {
        handler.vote(0, 1);
        handler.vote(1, 1);
        handler.wait(30 hours);
        handler.wait(30 hours);
        handler.execute(2);
        assertEq(handler.executed(), 1);
    }

    /// An armed proposal always has at least two votes; with none armed, no proposal has two.
    function invariant_ArmedIffTwoVotes() public view {
        (bytes32 armed, uint256 readyAt) = wallet.armedRecovery();
        bytes32[3] memory v = wallet.recoveryVotes();
        if (armed != bytes32(0)) {
            uint256 c = (v[0] == armed ? 1 : 0) + (v[1] == armed ? 1 : 0) + (v[2] == armed ? 1 : 0);
            assertGe(c, 2);
            assertGt(readyAt, 0);
        } else {
            assertEq(readyAt, 0);
            assertFalse(v[0] != bytes32(0) && (v[0] == v[1] || v[0] == v[2]));
            assertFalse(v[1] != bytes32(0) && v[1] == v[2]);
        }
    }

    /// A guardian never disarms or replaces an armed proposal it was not holding up.
    function invariant_NoSoloInterference() public view {
        assertEq(handler.soloInterference(), 0);
    }

    /// The owner key never changes before an armed proposal's delay has passed.
    function invariant_NoEarlyRotation() public view {
        assertEq(handler.earlyRotation(), 0);
    }
}
