<!-- Mirrored in the web app at /docs/contracts — keep in sync -->

# Contract Reference

Solidity sources live in [`contracts/`](../contracts). Built with Foundry + OpenZeppelin. The V4 line uses a frozen toolchain — solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true` — so the CREATE2 addresses stay deterministic.

## Deployed addresses

Deterministic CREATE2 — the factories and both registries have the **same address on every network**:

| Contract | Address |
|---|---|
| `BVCCSmartWalletFactoryV4` | `0xfd105197109244483b5f870501326E6faec9F93c` |
| `BVCCAgentWalletFactoryV4` | `0xf3A61F9d64d45362E149A111289546523BCd26a6` |
| `BVCCValidatorRegistry` | `0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2` |
| `BVCCHookRegistry` | `0x551C6e7ABdA04a110790888e711198f25621b066` |
| EntryPoint (OpenZeppelin v0.9) | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |

Live on **Arbitrum One**, **Base**, **BNB Chain**, **Ethereum**, **Polygon** and **Arbitrum Sepolia** (testnet). The per-chain validators — `BVCCUniversalRouterValidator` and `BVCCPositionManagerValidator` — are each bound to that chain's router / position manager, so their addresses differ per network; they are recorded in [`contracts/deployments/`](../contracts/deployments). Previous V3 factories (`0xD42F61AA…` / `0xd866a756…`) and V2 factories (`0x230b…BdEf1` / `0x8D9e…054c`) are deprecated.

## BVCCSmartWalletV4 — personal wallet (`walletType() = 0`)

One contract per user, deployed by the factory. No proxies, no upgradability.

- **Signer**: WebAuthn / P-256 public key (passkey), fixed at deployment. Every `execute()` is authenticated via ERC-4337 UserOp signature validation.
- **Execution**: ERC-7821 batched execution (`execute(bytes32 mode, bytes executionData)` with `Execution[]` batches).
- **Typed-data signing**: ERC-7739. Messages a dApp asks the wallet to sign are nested inside a `TypedDataSign` struct carrying this wallet's EIP-712 domain (`EIP712("BVCCSmartWalletV4", "1")`), so a signature is bound to one contract and cannot be replayed against another wallet using the same passkey. Required for Uniswap's Permit2. Frontend and contract are pinned together by a cross-language vector — see [Signing with dApps](./signing.md).
- **NFTs**: inherits `ERC721Holder` and `ERC1155Holder`, so the wallet answers the receiver hooks and can be the destination of a `safeTransferFrom` — which is how marketplaces send. Without them a safe transfer reverts and the NFT never arrives. The owner moves NFTs back out through the normal `execute()` path. Covered by `test/NftReceipt.t.sol`, including a control proving the hooks are what make it work.
- **Fee**: 0.05% per operation to the BVCC fee wallet (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), three cases:
  1. *ETH send* — fee deducted from the sent value.
  2. *ERC-20 transfer* — fee charged on top (wallet must hold `amount + fee`).
  3. *DeFi / swap* — balance snapshot before/after, fee on detected token balance increases.
- **Recovery**: 3 guardian addresses, set once at creation. Replacing the WebAuthn signer requires **2-of-3 guardian signatures + a 48-hour timelock**. Recovery functions bypass `execute()` and pay no fee.

## BVCCAgentWalletV4 — AI agent wallet (`walletType() = 1`)

Extends `BVCCSmartWalletV4`; adds delegated execution for authorized agent EOAs. Fee is **0.15%**. On top of the whitelists below, V3 introduced **per-selector call policies** for DeFi calls (see [Call policies](#call-policies)).

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
| `allowedProtocols` | `address[]` | DeFi target whitelist; **empty reverts** (`NoProtocolsWhitelisted`) |
| `allowedRecipients` | `address[]` | unified destination whitelist (ETH recipients, token recipients, approve spenders); **empty = allow any** |

Whitelists max 20 entries each. The four token arrays must have equal length.

### Owner functions (callable only via the wallet's own `execute()`, i.e. biometrics / WebAuthn)

```solidity
function authorizeAgent(AuthorizeParams calldata p) external; // re-auth PRESERVES spending history
function revokeAgent(address agent) external;                 // active = false, history kept
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgents() external;                              // emergency stop, blocks executeAsAgent
function unpauseAgents() external;
function setCallPolicy(address target, bytes4 selector, uint256 policy) external; // V3 — see Call policies
```

### Agent functions

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // nonReentrant, whenNotPaused
```

See the [Agent Integration Guide](./agent-integration.md) for call encoding, validation order and error reference.

### Call policies

For DeFi calls (case 3), whitelisting a protocol in `allowedProtocols` is necessary but no longer sufficient: the call's selector must also have a policy registered by the owner, or the call reverts with `SelectorNotAllowed`. A policy is a packed `uint256`:

- **PIN_WALLET** — a fixed calldata word must equal the wallet. Used when the recipient sits at a known offset (Uniswap SwapRouter02, Aave Pool `supply`/`withdraw`/`borrow`/`repay`). A mismatch reverts with `PinnedArgMismatch`.
- **PIN_PROTOCOL** — a calldata word must be an already-whitelisted protocol (e.g. the spender in `Permit2.approve`).
- **DEEP** — defers to `BVCCValidatorRegistry`, which routes to the target's validator (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`). The validator decodes variable-length calldata and checks every recipient. Fail-closed: no validator, `false`, or a revert denies the call (`PolicyValidationFailed`).

Registering a validator that *allows* a protocol carries a **48-hour timelock**; *denying* one (`freezeValidator`) is immediate. Enabling a complex protocol needs both halves — BVCC registers the validator and the owner adds the policy — so neither side alone can widen an agent's reach. The biometric owner is never subject to call policies; they apply only to agents. Policies are set with `setCallPolicy`, typically bundled into the same passkey signature that authorizes the agent.

### Getters

```solidity
function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 dailySpent, uint128 totalSpent);
function getCallPolicy(address target, bytes4 selector) external view returns (uint256); // V3
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
- **V4 addresses differ from V3**: the wallet bytecode changed, so the same passkey resolves to a different address. Users on V3 recreate their wallet and move funds (same playbook as every generation before). The app shows a banner on wallets that are behind.

## Registries & validators

- **`BVCCValidatorRegistry`** — fixed dispatch point (compiled as a constant inside the wallet, so a forged validator can't be injected). Maps a protocol target to its validator. Asymmetric governance: *allow* is timelocked 48h, *deny* is immediate.
- **`BVCCUniversalRouterValidator`** — decodes Universal Router `execute(bytes,bytes[],uint256)` and forces every recipient (including v4 `TAKE`) to the wallet or `MSG_SENDER`. Bound to one router address; exact command-byte matching (no masking).
- **`BVCCPositionManagerValidator`** — validates Uniswap v4 `modifyLiquidities`, whose recipient is buried in dynamic encoding.
- **`BVCCHookRegistry`** — allowlist of BVCC-approved v4 hooks, gated by the same 48h governance.
- **`IBVCCValidator`** — the shared `validate(address wallet, address target, uint256 value, bytes data) view returns (bool)` interface. It is an interface, not a deployed contract; the concrete validators above implement it and are staticcalled fail-closed.

## Security notes

- Internal security review, bilingual report in [`audits/`](../audits). Four rounds so far and thirteen findings with identifiers (`BVCC-01` … `BVCC-13`): 2 critical, 3 high, 5 medium, 1 low, 2 informational. Nine are remediated and live on all six networks, including a cross-function reentrancy that let a compromised agent bypass every limit, and guardian squatting through the factory. Four stay open or accepted by decision, each documented with its mitigation; the one that should change how you operate is `BVCC-03`. The V4 suite is **312 Foundry tests** (unit, fork & fuzz). **No independent party has audited this code** — it is experimental beta software.
- V2 (June 2026) fixed a gas-griefing edge on Arbitrum: balance probes are capped at 100k gas (`PROBE_GAS_CAP`) so calldata that happens to contain a precompile address can't burn the transaction's gas. Every generation since keeps this fix.
- V3 (July 2026) closed an agent fund-exfiltration path: a stolen agent key could previously name its own address as the `recipient`/`to` of a swap or `Pool.withdraw` and move funds without touching the ETH/token budget. V3 makes case-3 calls default-deny per selector and pins the recipient to the wallet (or validates it on-chain). The owner's biometric path is unaffected.
- V4 (July 2026) shipped seven fixes together, the reason wallets had to be redeployed: the cross-function reentrancy above; guardian squatting (the factory no longer chooses guardians, and `setGuardians` requires a self-call); the passkey credential is now announced by the wallet in a signed call instead of travelling unauthenticated through the factory, and can be rotated after a recovery; completing a recovery pauses every agent; guardians became replaceable by the owner; and token calls may no longer carry native value.

**A deployed wallet cannot be upgraded in place.** Wallets still on V1, V2 or V3 run the older bytecode, including the critical `BVCC-01`, until their owners migrate.

## See also

- [Agent Integration](./agent-integration.md) · [Self-Hosting](./self-hosting.md) · [Bundler API](./bundler-api.md)
