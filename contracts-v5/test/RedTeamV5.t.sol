// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import "./V5Base.t.sol";

/// @dev A protocol that is also a position NFT, like the Uniswap v4 PositionManager:
///      balanceOf counts positions, and burn() removes one. It can claim ERC-721 or not.
contract MockPositionNft {
    mapping(address => uint256) public balanceOf;
    bool internal immutable _isNft;

    constructor(bool isNft) {
        _isNft = isNft;
    }

    function mint(address to) external {
        balanceOf[to]++;
    }

    function burn() external {
        balanceOf[msg.sender]--;
    }

    function supportsInterface(bytes4 id) external view returns (bool) {
        return id == 0x01ffc9a7 || (_isNft && id == 0x80ac58cd);
    }
}

/// @title Red team regressions (local)
contract RedTeamV5Test is V5Base {
    address internal constant AGENT = address(0xA6E);
    uint256 internal constant ALLOWED_DEEP = (uint256(1) << 255) | (uint256(1) << 254);

    function _agentFor(BVCCAgentWalletV5 wallet, address protocol) internal {
        MockToken token = new MockToken("T");
        BVCCAgentLogicV5.AuthorizeParams memory p;
        p.agent = AGENT;
        p.expiry = uint64(vm.getBlockTimestamp() + 30 days);
        p.allowedTokens = new address[](1);
        p.allowedTokens[0] = address(token);
        p.tokenMaxAmounts = new uint128[](1);
        p.tokenDailyLimits = new uint128[](1);
        p.tokenTotalBudgets = new uint128[](1);
        p.tokenMaxAmounts[0] = 1e18;
        p.tokenDailyLimits[0] = 1e18;
        p.tokenTotalBudgets[0] = 1e18;
        p.allowedProtocols = new address[](1);
        p.allowedProtocols[0] = protocol;
        p.allowedRecipients = new address[](0);
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.authorizeAgent, (p)));
        _self(
            address(wallet),
            abi.encodeCall(
                BVCCAgentWalletV5.setAgentCallPolicy, (AGENT, protocol, MockPositionNft.burn.selector, ALLOWED_DEEP)
            )
        );
        _openTarget(protocol);
    }

    /// @dev RT-55: burning a position lowers an ERC-721 balanceOf. That count is not an
    ///      amount and must not read as an outflow of an unallowed token.
    function test_RT55_AgentBurnsPositionOfErc721Protocol() public {
        BVCCAgentWalletV5 wallet = _createAgent();
        MockPositionNft nft = new MockPositionNft(true);
        nft.mint(address(wallet));
        _agentFor(wallet, address(nft));

        vm.prank(AGENT);
        wallet.executeAsAgent(_mode(), _one(address(nft), 0, abi.encodeCall(MockPositionNft.burn, ())));
        assertEq(nft.balanceOf(address(wallet)), 0, "position burned");
    }

    /// @dev Control: a protocol that answers balanceOf and does not claim ERC-721 is still
    ///      measured, so a drop in it is still an outflow of an unallowed token.
    function test_RT55_NonNftProtocolStillMeasured() public {
        BVCCAgentWalletV5 wallet = _createAgent();
        MockPositionNft notNft = new MockPositionNft(false);
        notNft.mint(address(wallet));
        _agentFor(wallet, address(notNft));

        vm.prank(AGENT);
        vm.expectRevert(BVCCAgentLogicV5.TokenNotAllowed.selector);
        wallet.executeAsAgent(_mode(), _one(address(notNft), 0, abi.encodeCall(MockPositionNft.burn, ())));
    }

    /// @dev RT-30-A: pausing a paused wallet, or unpausing an unpaused one, is a no-op, so
    ///      a batch that repeats it does not revert.
    function test_RT30A_PauseAndUnpauseAreIdempotent() public {
        BVCCAgentWalletV5 wallet = _createAgent();
        Execution[] memory items = new Execution[](2);
        items[0] = Execution(address(wallet), 0, abi.encodeCall(BVCCAgentWalletV5.pauseAgents, ()));
        items[1] = items[0];
        _asOwnerBatch(wallet, items);
        assertTrue(wallet.paused(), "paused");

        items[0] = Execution(address(wallet), 0, abi.encodeCall(BVCCAgentWalletV5.unpauseAgents, ()));
        items[1] = items[0];
        _asOwnerBatch(wallet, items);
        assertFalse(wallet.paused(), "unpaused");

        // Unpausing an unpaused wallet on its own is fine too.
        _self(address(wallet), abi.encodeCall(BVCCAgentWalletV5.unpauseAgents, ()));
        assertFalse(wallet.paused());
    }

    function _asOwnerBatch(BVCCAgentWalletV5 wallet, Execution[] memory items) internal {
        vm.prank(address(wallet));
        wallet.execute(_mode(), _batch(items));
    }
}
