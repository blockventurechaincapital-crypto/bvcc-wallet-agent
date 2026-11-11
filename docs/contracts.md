<!-- Mirrored in the web app at /docs/contracts — keep in sync -->

# Contract Reference

V5 is the current generation; its Solidity sources are in `contracts-v5/` in the monorepo. V4, the previous generation, is in `contracts/` and is described at the end of this page. Both are built with Foundry and OpenZeppelin on a frozen toolchain (solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true`), so the CREATE2 addresses stay deterministic. V5 also builds without a metadata hash, so the build reproduces the deployed bytecode byte for byte.

> Browsable on the web at [bvccwallet.blockventurechaincapital.com/docs/contracts](https://bvccwallet.blockventurechaincapital.com/docs/contracts).

## Deployed addresses (V5)

Same CREATE2 address on Ethereum, Arbitrum One, Base, BNB Chain, Polygon and Arbitrum Sepolia. Every contract is source-verified on the block explorers.

| Contract | Address |
|---|---|
| `BVCCWalletFactoryV5` (personal wallets) | `0x2672951DC1E3f865BA6Fc98e5509dc4B23B260a2` |
| `BVCCWalletFactoryV5` (agent wallets) | `0xE36fb66c21C38536454C1a58fBC5EB1Cb455aD52` |
| `BVCCSmartWalletV5` (logic) | `0xc9dE89d54beB786bc916131CA6c8c5374507Bd15` |
| `BVCCAgentWalletV5` (logic) | `0x360f991B23a3D5202Dc422292697aB07dA279cFA` |
| `BVCCAgentLogicV5` (library) | `0x7504bf3c1230eF99eaEFAc03287c8F036CBb6D0E` |
| `BVCCValidatorRegistryV5` | `0x7269334AE74DCE4e607eec36268383DD35f28350` |
| `BVCCHookRegistryV5` | `0xEaEaC7F6071f7F576Be2aD97898Dd0c0F51BE78A` |
| EntryPoint (v0.9) | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |

Validators are bound to one protocol contract each, so most addresses differ per network. All 30 are active in the V5 registry:

| Network | Validator for | Address |
|---|---|---|
| Ethereum | Universal Router | `0x48A6d5415C369Fa38E0ebEafC779527fb6cF32A0` |
| Ethereum | Uniswap v4 PositionManager | `0xb05fc3aaD6E4cAaD69b680C1adae645DB0B56f1f` |
| Ethereum | Aave v3 Pool | `0xeD51c5063dB3bB4609Cf95fC349d87b68bEECC28` |
| Ethereum | Uniswap v3 positions | `0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678` |
| Ethereum | Wrapped native | `0xDC2480bD3DfDC5A4c92ab1C37f2234FF5f91521F` |
| Arbitrum One | Universal Router | `0x332E88FDc5f26a7421534902Cbb9C95B70E8AA0d` |
| Arbitrum One | Uniswap v4 PositionManager | `0xc9Ae38709cd76b51F4f11a21Ee2aAC1cf67a013D` |
| Arbitrum One | Aave v3 Pool | `0xC7bD86E147b211DDC1c6bbCad07A01B51C7CAff4` |
| Arbitrum One | Uniswap v3 positions | `0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678` |
| Arbitrum One | Wrapped native | `0x80DBf05b4406927c22cDFaFb3f226665F863A58D` |
| Base | Universal Router | `0x5b9cDCC1a4Ac139E8b13A4FC4ca4519906F651A5` |
| Base | Uniswap v4 PositionManager | `0x0E43866CFFC41E814C1f4e0341Fed09234d1d8B1` |
| Base | Aave v3 Pool | `0x30Bd59CF41c2F4FE02e9666065dd294FD44333bb` |
| Base | Uniswap v3 positions | `0x2B52943E9F361CCA42f1100a78b74daaEB25F02e` |
| Base | Wrapped native | `0xEF913B99C970E4Bc3B987F0668d0F20CD8B90c6E` |
| BNB Chain | Universal Router | `0x656f0EB67ce76c3b416D8F3dFB46e81c7aA442D7` |
| BNB Chain | Uniswap v4 PositionManager | `0x12298d84D1d3272a51a7b21755D222da26996786` |
| BNB Chain | Aave v3 Pool | `0x822E3ab17d7AC4E49cA18E881392CED15ba1E7bb` |
| BNB Chain | Uniswap v3 positions | `0x5C700655e00FA7003672617d8723d5AeBF9E9c9A` |
| BNB Chain | Wrapped native | `0x4F2974859169262158065a1506070ee52EFeD6De` |
| Polygon | Universal Router | `0xDd313C3884a6fA1636fc5cba3E251874073e1B3f` |
| Polygon | Uniswap v4 PositionManager | `0xd5315B0B30Fa25C5EcbFAA2BBD514262E33Db911` |
| Polygon | Aave v3 Pool | `0xC7bD86E147b211DDC1c6bbCad07A01B51C7CAff4` |
| Polygon | Uniswap v3 positions | `0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678` |
| Polygon | Wrapped native | `0xc4E512BEEbBCb03A79C10c109B4CD6cef8aa5E5e` |
| Arbitrum Sepolia | Universal Router | `0x1D0394e997a0799883AE433383Bc82280E17E403` |
| Arbitrum Sepolia | Uniswap v4 PositionManager | `0x6Cd6e2D7328b0128Ab82921939526dde6f45F2d3` |
| Arbitrum Sepolia | Aave v3 Pool | `0xA61ac81B9fAA48eE33Ac8A1f28ad80C577e276FA` |
| Arbitrum Sepolia | Uniswap v3 positions | `0xbaBA421723a25363BB25468B94A1100B3972DB84` |
| Arbitrum Sepolia | Wrapped native | `0x0A9F4027e3A2136d4e688D0Ee0A5b42cE94b3702` |

Fees go to `0x3e3eb089169a7315a994947465ce5f5FC3A307D4`, a constant in the logic contracts.

## How V5 is built

- Each wallet is a small ERC-1167 clone of a logic contract (`BVCCSmartWalletV5` or `BVCCAgentWalletV5`). Clones cannot be upgraded, and the logic contracts have their initializers disabled. Creating a wallet costs about 537,000 gas, against about 4.7 million for V4.
- One factory contract, `BVCCWalletFactoryV5`, is deployed twice: once for personal wallets and once for agent wallets.
- The agent permission code lives in the external library `BVCCAgentLogicV5`, reached by `DELEGATECALL`. It has no storage of its own.
- The validator registry address is a constant inside every wallet, so nobody can point a wallet at a different registry.
- A wallet cannot move to a newer generation in place. Owners of older wallets create a V5 wallet with the same passkey and move their funds (see Move to wallet V5).

## BVCCSmartWalletV5 — personal wallet (walletType 0)

- Signer: the passkey’s P-256 public key (WebAuthn), checked through ERC-4337 UserOperation validation on EntryPoint v0.9.
- Creation needs the passkey. `createWallet` verifies a passkey signature over the wallet address and the credential, so nobody can deploy your wallet or choose its guardians for you. The signature has no chain id on purpose, so the same wallet can be deployed on every network.
- Signatures expire. Each UserOperation signature is `abi.encode(uint48 validUntil, webauthnSig)` and the passkey signs `keccak256(abi.encode(userOpHash, validUntil))`. `validUntil` cannot be 0; the app uses about 15 minutes.
- The credential id is stored in the wallet (`credentialId()`). It changes only at creation, through `setCredentialId` (passkey) or through a recovery.
- Execution: ERC-7821 batches (`execute(bytes32 mode, bytes executionData)`). Fee 0.05% to the fee wallet, in three cases: (1) native send: fee taken from the value; (2) ERC-20 `transfer`: fee on top, the recipient gets the exact amount; (3) any other call: fee on the balance increases the wallet detects. Token calls use SafeERC20 semantics, and balance reads copy at most 32 bytes of return data with a gas cap. If the fee cannot be paid, the operation reverts.
- ERC-1271 signatures (`isValidSignature`) accept only the owner’s passkey, through ERC-7739. An agent never signs for the wallet.

### Owner functions

```solidity
function execute(bytes32 mode, bytes calldata executionData) external payable; // ERC-7821 batch, via UserOp
function credentialId() external view returns (bytes memory);
function setCredentialId(bytes calldata newCredentialId) external;            // self-call only (passkey)
function setGuardians(address[3] calldata newGuardians) external;             // self-call; reverts while a recovery is armed
function cancelRecovery() external;                                           // self-call; clears votes and the armed proposal
```

### Guardian recovery

Three guardians, two must agree. Each guardian votes for one concrete proposal (new public key and credential) and controls only its own vote. Two matching votes arm the proposal and start a 48-hour wait; a third guardian cannot reset or remove the other votes, and the proposal stays armed while it holds two votes. The owner can cancel at any time with the passkey. After the wait, `executeRecovery` sets the new key and credential and, on an agent wallet, pauses every agent.

```solidity
function voteRecovery(bytes32 newX, bytes32 newY, bytes calldata newCredentialId) external; // one vote per guardian
function withdrawRecoveryVote() external;
function executeRecovery() external;            // after the 48 h wait; sets key + credential, pauses every agent
function guardians() external view returns (address[3] memory);
function recoveryVotes() external view returns (bytes32[3] memory);
function armedRecovery() external view returns (bytes32 proposalId, uint256 readyAt);
```

## BVCCAgentWalletV5 — AI agent wallet (walletType 1)

Extends `BVCCSmartWalletV5` with agents: plain EOAs the owner authorizes with their own limits. The owner pays 0.15% on this wallet type. Every setting is per agent.

### AuthorizeParams (input to authorizeAgent)

| Field | Type | Meaning (`0` or empty = nothing allowed) |
|---|---|---|
| `agent` | `address` | agent EOA; must have no code when authorized and at every call (an EIP-7702 delegation stops it) |
| `maxPerTxWei` | `uint128` | max native value of the whole batch |
| `dailyLimitWei` | `uint128` | max native per UTC day |
| `totalBudgetWei` | `uint128` | lifetime native budget |
| `periodBudgetWei` | `uint128` | max native per rolling period (only if `periodDuration > 0`) |
| `periodDuration` | `uint64` | period length in seconds |
| `expiry` | `uint64` | required: later than now and at most 365 days ahead |
| `allowedTokens` | `address[]` | up to 50 ERC-20s the agent may use |
| `tokenMaxAmounts` | `uint128[]` | parallel: token cap per batch |
| `tokenDailyLimits` | `uint128[]` | parallel: token cap per UTC day |
| `tokenTotalBudgets` | `uint128[]` | parallel: lifetime token budget |
| `allowedProtocols` | `address[]` | up to 20 protocol contracts; also the only valid `approve` spenders |
| `allowedRecipients` | `address[]` | up to 20 destinations for native sends and token transfers; empty = nobody |

"Unlimited" exists only as the explicit maximum (`type(uint128).max`). Every limit already includes the 0.15% agent fee.

### Owner functions (self-calls, signed with the passkey)

```solidity
function authorizeAgent(AuthorizeParams calldata p) external;   // re-authorizing keeps spending history
function revokeAgent(address agent) external;
function renewAgent(address agent, uint64 newExpiry) external;  // at most 365 days ahead
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgent(address agent) external;                    // one agent
function unpauseAgent(address agent) external;
function pauseAgents() external;                                // every agent; does nothing if already paused
function unpauseAgents() external;
function setAgentCallPolicy(address agent, address target, bytes4 selector, uint256 policy) external;
function setAgentValueSet(address agent, address target, bytes4 selector, bytes32[] calldata values) external;
function setTargetBlocked(address target, bool blocked) external; // block a contract for every agent
```

### Agent function

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // batch mode only, nonReentrant
```

### What happens in an agent batch

- Agent check: a plain EOA right now, active, not expired, not paused on its own and no global pause.
- Per item, before anything runs: the target is not the wallet and not blocked. A native send goes to an allowed recipient. A `transfer` is an allowed token to an allowed recipient. An `approve` is an allowed token to an allowed protocol. Any other call needs an allowed protocol, a policy for that agent and function with the `DEEP` bit, the anchors the owner set, and a yes from that protocol’s validator.
- Measure: read the balance of every allowed token, every token found in the calldata and every token a validator declares (up to 60). A failed read reverts.
- Execute the batch. Where a validator asks for it (Aave `withdraw`, Uniswap position calls), what comes into the wallet during that call is counted as a cost too.
- Every approval the agent made goes back to its previous value. The agent never leaves an allowance behind.
- Measure again. A token that is not allowed and went down reverts the batch. For an allowed token, outflow + costs + 0.15% fee is checked against the per-batch, daily and total limits, and the fee is paid in that token.
- Post-checks: validators that asked for one decide again. For Aave, the health factor must stay at or above 1.2.

### Call policies

A policy is a `uint256` per agent, contract and function, set by the owner with `setAgentCallPolicy`. Bit 255 allows the function and bit 254 (`DEEP`) sends it to the validator; in V5 every protocol call needs both, or it reverts with `SelectorNotAllowed` or `CallNeedsValidator`. Optional anchors add checks on fixed calldata words: W (must be the wallet), P (an allowed protocol), T (an allowed token), R (an allowed recipient) and S (one of a value set kept with `setAgentValueSet`, up to 20 values). Reserved bits must be 0.

### Getters

```solidity
function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgentSpending(address agent) external view returns (AgentSpending memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 daily, uint128 total);
function getAgentCallPolicy(address agent, address target, bytes4 selector) external view returns (uint256);
function getAgentValueSet(address agent, address target, bytes4 selector) external view returns (bytes32[] memory);
function isTargetBlocked(address target) external view returns (bool);
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent
```

### Errors an agent can hit

| Error | Meaning |
|---|---|
| `NotAuthorizedAgent`, `AgentPermissionsExpired`, `AgentPaused`, `EnforcedPause` | not authorized, expired, paused on its own, or every agent paused |
| `AgentMustBeEOA` | the agent address has code (for example an EIP-7702 delegation) |
| `AgentCannotCallWallet`, `TargetIsBlocked` | target is the wallet itself, or blocked by the owner |
| `RecipientNotAllowed`, `TokenNotAllowed`, `ProtocolNotAllowed` | destination, token or protocol not on the agent’s lists |
| `SelectorNotAllowed`, `CallNeedsValidator`, `PinnedArgMismatch`, `PolicyValidationFailed` | no policy, policy without `DEEP`, an anchor failed, or the validator said no |
| `ExceedsPerTxLimit`, `DailyLimitExceeded`, `TotalBudgetExceeded`, `PeriodBudgetExceeded` | a native limit, fee included |
| `TokenBatchLimitExceeded`, `TokenDailyLimitExceeded`, `TokenTotalBudgetExceeded` | a token limit, fee included |
| `MeasurementFailed`, `TooManyMeasuredTokens` | a balance could not be read, or more than 60 tokens to measure |
| `PostCheckFailed` | a validator’s post-check failed (for example Aave health below 1.2) |
| `FeeTransferFailed`, `TokenCallWithValue` | the fee could not be paid exactly, or a token call carried native value |

## Factory — BVCCWalletFactoryV5

```solidity
function getWalletAddress(bytes32 pubKeyX, bytes32 pubKeyY) public view returns (address);
function createWallet(bytes32 pubKeyX, bytes32 pubKeyY, bytes calldata credentialId, bytes calldata credentialSig)
    external returns (address wallet); // credentialSig: passkey signature over the wallet address + credential
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: stops NEW wallets; existing wallets keep working
```

- Deterministic address: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))`. The same passkey gives the same address on every network, and you can receive funds there before deploying.
- Idempotent: `createWallet` returns the existing wallet if it is already deployed.
- The V5 address differs from your V4 address for the same passkey, because the factory and the code differ.

## Registries & validators (V5)

- `BVCCValidatorRegistryV5` maps each protocol contract to its validator. Allowing or replacing a validator takes a proposal and 48 hours, visible on-chain; cancelling a proposal or freezing a validator is immediate. Ownership moves only in two steps.
- Validators are stateless `view` contracts called with `staticcall`. They return yes or no, the tokens to measure, the costs (such as an Aave loan), whether they want a post-check, and whether inflows are charged. A revert means no. Only immutable validators are registered.
- Universal Router: token-to-token swaps (v3 and v4). Exact command bytes; every recipient is the wallet; every v4 hop decoded, with each hook none or approved; native value refused.
- Uniswap v4 PositionManager: positions owned by the wallet only; adding needs no individual approval on the position; no removing and adding in the same call; hooks none or approved on every action; inflows charged.
- Aave v3 Pool: supply, withdraw, borrow (variable), repay, collateral and eMode settings, all for the wallet itself. A loan is charged as a cost against the budget, withdrawals are charged as inflows, and the health factor must stay at or above 1.2.
- Uniswap v3 positions: mint to the wallet; add, remove, burn and collect only on the wallet’s own positions; collect only to the wallet.
- Wrapped native (WETH, WBNB, WPOL): only `deposit()` and `withdraw(amount)`.
- `BVCCHookRegistryV5`: Uniswap v4 hooks approved for agents, with the same 48-hour delay and immediate freeze. An approved hook runs its own code, so approving one is a trust decision.

## Security notes

- Internal security review, bilingual report in the monorepo’s `audits/` folder and linked from these docs. It covers every generation. Thirty findings with identifiers: `BVCC-01` … `BVCC-13` from the review of V4 and earlier, and `BVCC-14` … `BVCC-30` from five V5 review rounds and a red-team exercise, run by the team with AI analysis tools.
- Nothing is open in V5: twenty-six findings are closed in code and four are documented trust assumptions (immutable validators, approved hooks, allowed tokens, and validators declaring every token they move). Every V5 finding was handled before deployment.
- V5 closes `BVCC-03`, the risk V4 left open, by measuring what each agent batch takes out of the wallet, whatever allowances already exist.
- The V5 suite is 191 Foundry tests (145 local, 46 on network forks), including invariants with 128,000 random actions.

> ⚠️ No external audit yet. This is experimental beta software.

## Previous generation: V4

> V4 wallets keep working, but new wallets are V5 and V4 keeps `BVCC-03` open. To move, see Move to wallet V5.

| Contract | Address |
|---|---|
| `BVCCSmartWalletFactoryV4` | `0xfd105197109244483b5f870501326E6faec9F93c` |
| `BVCCAgentWalletFactoryV4` | `0xf3A61F9d64d45362E149A111289546523BCd26a6` |
| `BVCCValidatorRegistry` | `0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2` |
| `BVCCHookRegistry` | `0x551C6e7ABdA04a110790888e711198f25621b066` |

Live on Arbitrum One, Base, BNB Chain, Ethereum, Polygon and Arbitrum Sepolia (testnet). The per-chain validators (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`) are bound to each chain’s router / position manager, so their addresses differ per network — see the monorepo’s `contracts/deployments/`. Previous V2 factories (`0x230b…BdEf1` / `0x8D9e…054c`) are deprecated.

### BVCCSmartWalletV4 — personal wallet (walletType 0)

One contract per user, deployed by the factory. No proxies, no upgradability.

- Signer: WebAuthn / P-256 public key (passkey), fixed at deployment. Every `execute()` is authenticated via ERC-4337 UserOp signature validation.
- Execution: ERC-7821 batched execution (`execute(bytes32 mode, bytes executionData)` with `Execution[]` batches).
- Fee: 0.05% per operation to the BVCC fee wallet (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), three cases — (1) ETH send: fee deducted from the sent value; (2) ERC-20 transfer: fee charged on top, the wallet must hold `amount + fee`; (3) DeFi/swap: balance snapshot before/after, fee on detected token balance increases.
- Recovery: 3 guardian addresses, set once at creation. Replacing the WebAuthn signer requires 2-of-3 guardian signatures + a 48-hour timelock. Recovery functions bypass `execute()` and pay no fee.

### BVCCAgentWalletV4 — AI agent wallet (walletType 1)

Extends `BVCCSmartWalletV4`; adds delegated execution for authorized agent EOAs. Fee is 0.15%. On top of the whitelists below, V3 introduced per-selector call policies for DeFi calls (see Call policies).

### AuthorizeParams (input to authorizeAgent)

| Field | Type | Meaning (`0` = unlimited/disabled) |
|---|---|---|
| `agent` | `address` | agent EOA (must have no code) |
| `maxPerTxWei` | `uint128` | max ETH per single `Execution` item |
| `dailyLimitWei` | `uint128` | max ETH per UTC day |
| `totalBudgetWei` | `uint128` | lifetime ETH budget |
| `periodBudgetWei` | `uint128` | max ETH per rolling period |
| `periodDuration` | `uint64` | period length in seconds |
| `expiry` | `uint64` | unix timestamp; agent disabled after |
| `allowedTokens` | `address[]` | ERC-20 whitelist; empty = deny all token ops |
| `tokenMaxAmounts` | `uint128[]` | parallel: token cap per batch |
| `tokenDailyLimits` | `uint128[]` | parallel: token cap per UTC day |
| `tokenTotalBudgets` | `uint128[]` | parallel: lifetime token budget |
| `allowedProtocols` | `address[]` | DeFi target whitelist; empty reverts (`NoProtocolsWhitelisted`) |
| `allowedRecipients` | `address[]` | unified destination whitelist (ETH recipients, token recipients, approve spenders); empty = allow any |

Whitelists max 20 entries each. The four token arrays must have equal length.

### Owner functions (callable only via the wallet’s own execute(), i.e. biometrics / WebAuthn)

```solidity
function authorizeAgent(AuthorizeParams calldata p) external; // re-auth PRESERVES spending history
function revokeAgent(address agent) external;                 // active = false, history kept
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgents() external;                              // emergency stop, blocks executeAsAgent
function unpauseAgents() external;
function setCallPolicy(address target, bytes4 selector, uint256 policy) external; // per-selector Case-3 policy
```

### Agent functions

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // nonReentrant, whenNotPaused
```

See the Agent Integration Guide for call encoding, validation order and error reference.

### Call policies

For DeFi calls (case 3), whitelisting a protocol in `allowedProtocols` is necessary but no longer sufficient: the call’s selector must also have a policy registered by the owner, or it reverts with `SelectorNotAllowed`. A policy is a packed `uint256`:

- PIN_WALLET — a fixed calldata word must equal the wallet (recipient at a known offset: SwapRouter02, Aave Pool supply/withdraw/borrow/repay). A mismatch reverts with `PinnedArgMismatch`.
- PIN_PROTOCOL — a calldata word must be an already-whitelisted protocol (e.g. the spender in `Permit2.approve`).
- DEEP — defers to the on-chain validator registry, which decodes variable-length calldata and checks every recipient (Universal Router `execute`, v4 PositionManager `modifyLiquidities`). Fail-closed: no validator, false, or a revert denies the call (`PolicyValidationFailed`).

Allowing a validator is timelocked 48h; denying one is immediate. The biometric owner is never subject to call policies — they apply only to agents. Policies are set with `setCallPolicy`, usually bundled into the same biometric signature that authorizes the agent.

### Getters

```solidity
function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 dailySpent, uint128 totalSpent);
function getCallPolicy(address target, bytes4 selector) external view returns (uint256); // V3
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent
```

### Factories

Both factories share the same shape:

```solidity
constructor(address owner_); // owner = kill-switch admin, separate from deployer and fee wallet

function getWalletAddress(uint256 pubKeyX, uint256 pubKeyY) public view returns (address);
function createWallet(uint256 pubKeyX, uint256 pubKeyY, address[3] memory guardians, string calldata credentialId)
    external returns (address wallet);
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: permanently blocks NEW wallet creation
```

- Deterministic address: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derived only from the passkey’s P-256 public key. Same key → same wallet address on every network. Guardians don’t affect the address: the factory only deploys, and the owner registers them afterwards with `setGuardians`, callable only by the wallet itself (a passkey-signed self-call). Whoever deploys an address therefore cannot choose who can rotate its owner. The set is replaceable by the owner, except while a recovery is in flight.
- Counterfactual: `getWalletAddress` is a view — you can receive funds at the address before deploying.
- Idempotent: `createWallet` returns the existing wallet if already deployed.
- Kill switch: `kill()` stops new creations only; existing wallets are independent contracts and keep working with their funds.
- V4 addresses differ from V3: the wallet bytecode changed, so the same passkey resolves to a different address. V3 users recreate their wallet and move funds (same playbook as every generation before). The app shows a banner on wallets that are behind.

### Registries & validators

- `BVCCValidatorRegistry` — fixed dispatch point, compiled as a constant inside the wallet so a forged validator can’t be injected. Maps a protocol target to its validator.
- `BVCCUniversalRouterValidator` / `BVCCPositionManagerValidator` — per-chain, each bound to that chain’s router / position manager; addresses differ per network (see `contracts/deployments/`).
- `BVCCHookRegistry` — allowlist of approved Uniswap v4 hooks, gated by the same 48h governance.
- `IBVCCValidator` — the shared `validate(...)` view interface. It is an interface, not a deployed contract; the concrete validators implement it and are staticcalled fail-closed.

### Security notes

- Internal security review, bilingual report in the monorepo’s `audits/` folder and linked from these docs. For V4: four review rounds, thirteen findings with identifiers (`BVCC-01` … `BVCC-13`): 2 critical, 3 high, 5 medium, 1 low, 2 informational. Nine are remediated and live on all six networks — including a cross-function reentrancy that let a compromised agent bypass every limit, and guardian squatting through the factory. Four stay open or accepted by decision, each documented with its mitigation; the one that should change your behaviour is `BVCC-03`. The V4 suite is 312 Foundry tests (unit, fork & fuzz). No independent party has audited this code.
- V2 (June 2026) fixed a gas-griefing edge on Arbitrum: balance probes are capped at 100k gas (`PROBE_GAS_CAP`) so calldata that happens to contain a precompile address can’t burn the transaction’s gas. V3 keeps this fix.
- V3 (July 2026) closes an agent fund-exfiltration path: a stolen agent key could previously name its own address as the recipient/`to` of a swap or `Pool.withdraw` and move funds without touching the ETH/token budget. V3 makes case-3 calls default-deny per selector and pins the recipient to the wallet (or validates it on-chain). The owner’s biometric path is unaffected.

> ⚠️ No external audit yet — this is experimental beta software.
