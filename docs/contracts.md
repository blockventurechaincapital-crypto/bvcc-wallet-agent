<!-- Mirrored in the web app at /docs/contracts — keep in sync -->

# Contract Reference

Solidity sources live in [`contracts/`](../contracts). Built with Foundry + OpenZeppelin, `pragma ^0.8.27`, `via_ir = true`.

## Deployed addresses

Deterministic CREATE2 — **same address on every network**:

| Contract | Address |
|---|---|
| `BVCCSmartWalletFactoryV2` | `0x230b7010529AB6977Dd8581B3eF018ef865BdEf1` |
| `BVCCAgentWalletFactoryV2` | `0x8D9e24022777173AD6336e00884b6C87c7EF054c` |
| EntryPoint (OpenZeppelin v0.9) | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |

Live on **Arbitrum One**, **BNB Chain** and **Arbitrum Sepolia** (testnet). Ethereum and Base deployments are pending and will use the same addresses.

## BVCCSmartWalletV2 — personal wallet (`walletType() = 0`)

One contract per user, deployed by the factory. No proxies, no upgradability.

- **Signer**: WebAuthn / P-256 public key (passkey), fixed at deployment. Every `execute()` is authenticated via ERC-4337 UserOp signature validation.
- **Execution**: ERC-7821 batched execution (`execute(bytes32 mode, bytes executionData)` with `Execution[]` batches).
- **Fee**: 0.05% per operation to the BVCC fee wallet (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), three cases:
  1. *ETH send* — fee deducted from the sent value.
  2. *ERC-20 transfer* — fee charged on top (wallet must hold `amount + fee`).
  3. *DeFi / swap* — balance snapshot before/after, fee on detected token balance increases.
- **Recovery**: 3 guardian addresses, set once at creation. Replacing the WebAuthn signer requires **2-of-3 guardian signatures + a 48-hour timelock**. Recovery functions bypass `execute()` and pay no fee.

## BVCCAgentWalletV2 — AI agent wallet (`walletType() = 1`)

Extends `BVCCSmartWalletV2`; adds delegated execution for authorized agent EOAs. Fee is **0.15%**.

### `AuthorizeParams` (input to `authorizeAgent`)

| Field | Type | Meaning (`0` = unlimited/disabled) |
|---|---|---|
| `agent` | `address` | agent EOA (must have no code) |
| `maxPerTxWei` | `uint128` | max ETH per single `Execution` item |
| `dailyLimitWei` | `uint128` | max ETH per UTC day |
| `totalBudgetWei` | `uint128` | lifetime ETH budget |
| `periodBudgetWei` | `uint128` | max ETH per rolling period |
| `periodDuration` | `uint64` | period length in seconds |
| `expiry` | `uint64` | unix timestamp; agent disabled after |
| `allowedTokens` | `address[]` | ERC-20 whitelist; **empty = deny all** token ops |
| `tokenMaxAmounts` | `uint128[]` | parallel: token cap per batch |
| `tokenDailyLimits` | `uint128[]` | parallel: token cap per UTC day |
| `tokenTotalBudgets` | `uint128[]` | parallel: lifetime token budget |
| `allowedProtocols` | `address[]` | DeFi target whitelist; **empty = deny all** DeFi calls |
| `allowedRecipients` | `address[]` | unified destination whitelist (ETH recipients, token recipients, approve spenders); **empty = allow any** |

Whitelists max 20 entries each. The four token arrays must have equal length.

### Owner functions (callable only via the wallet's own `execute()`, i.e. Face ID)

```solidity
function authorizeAgent(AuthorizeParams calldata p) external; // re-auth PRESERVES spending history
function revokeAgent(address agent) external;                 // active = false, history kept
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgents() external;                              // emergency stop, blocks executeAsAgent
function unpauseAgents() external;
```

### Agent functions

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // nonReentrant, whenNotPaused
```

See the [Agent Integration Guide](./agent-integration.md) for call encoding, validation order and error reference.

### Getters

```solidity
function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 dailySpent, uint128 totalSpent);
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent
```

## Factories

Both factories share the same shape:

```solidity
constructor(address owner_); // owner = kill-switch admin, separate from deployer and fee wallet

function getWalletAddress(uint256 pubKeyX, uint256 pubKeyY) public view returns (address);
function createWallet(uint256 pubKeyX, uint256 pubKeyY, address[3] memory guardians, string calldata credentialId)
    external returns (address wallet);
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: permanently blocks NEW wallet creation
```

- **Deterministic address**: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derived only from the passkey's P-256 public key. Same key → same wallet address on every network. Guardians don't affect the address (set post-deploy via `setGuardians`, callable once).
- **Counterfactual**: `getWalletAddress` is a view — you can receive funds at the address before deploying.
- **Idempotent**: `createWallet` returns the existing wallet if already deployed.
- **Kill switch**: `kill()` stops new creations only; existing wallets are independent contracts and keep working with their funds.

## Security notes

- Internal security review (bilingual report in [`audits/`](../audits)): HIGH finding (approve cap-bypass) fixed; 131/131 Foundry tests pass; Slither clean of real findings. **No external audit yet** — this is experimental beta software.
- V2 (June 2026) fixed a gas-griefing edge on Arbitrum: balance probes are now capped at 100k gas (`PROBE_GAS_CAP`) so calldata that happens to contain a precompile address can't burn the transaction's gas.

## See also

- [Agent Integration](./agent-integration.md) · [Self-Hosting](./self-hosting.md) · [Bundler API](./bundler-api.md)
