<!-- Mirrored in the web app at /docs/agent-integration — keep in sync -->

# Agent Integration Guide

How an external AI agent (or any automated system) executes transactions through a **BVCC Agent Wallet** (`BVCCAgentWalletV2`). All permissions and spending limits are enforced **on-chain** — the agent cannot exceed them no matter what its code does.

## How it works

1. The wallet owner authorizes an agent address from the app (`/wallet/agents`), signing with Face ID / WebAuthn. This calls `authorizeAgent()` on the wallet with the agent's limits.
2. The agent calls `executeAsAgent()` on the wallet **directly, as a normal EVM transaction** — no ERC-4337 UserOp, no bundler, no WebAuthn signature needed.
3. The agent pays gas from its own EOA. The transferred funds come from the wallet.
4. Every execution is validated against the agent's on-chain permission set and charged a 0.15% protocol fee.

Two hard requirements for the agent account:

- **Must be an EOA.** `authorizeAgent` rejects addresses with deployed code (`AgentMustBeEOA`). Smart-contract agents are not supported.
- **Must be authorized and not expired** at execution time, and agents must not be paused (`pauseAgents()` is the owner's emergency stop).

## The entrypoint: `executeAsAgent`

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
```

- `mode` — ERC-7821/7579 execution mode. Use the batch mode constant:

  ```
  BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000
  ```

- `executionData` — ABI-encoded array of `Execution` structs:

  ```solidity
  struct Execution {
      address target;   // contract or recipient to call
      uint256 value;    // ETH (wei) to send with the call
      bytes   callData; // calldata; empty for pure ETH sends
  }

  // executionData = abi.encode(Execution[])
  ```

A single call can batch multiple executions; limits are checked over the **whole batch** (cumulative ETH and cumulative per-token amounts).

## The four call types

Each `Execution` item is classified on-chain and checked against the matching whitelist:

| Case | Shape | Checks applied |
|---|---|---|
| 1. ETH send | `value > 0`, empty `callData` | recipient whitelist |
| 2. ERC-20 transfer | `callData` starts with `0xa9059cbb` (`transfer(address,uint256)`) | token whitelist + per-token amount cap + recipient whitelist |
| 2b. ERC-20 approve | `callData` starts with `0x095ea7b3` (`approve(address,uint256)`) | token whitelist + per-token amount cap + **spender** checked against recipient whitelist |
| 3. DeFi / anything else | any other `callData` | `target` must be in the protocol whitelist |

Notes:

- The agent can never call the wallet itself (`AgentCannotCallWallet`) — owner functions stay owner-only.
- `approve` amounts count toward per-token daily/total budgets, same as transfers. This is intentionally conservative: it prevents draining via an external `transferFrom` after a large approve.

## Spending limits

All set per-agent in `authorizeAgent`. **`0` always means unlimited / disabled.** Checked in this order:

| Limit | Scope | Error on violation |
|---|---|---|
| `maxPerTxWei` | ETH per single `Execution` item | `ExceedsPerTxLimit` |
| `tokenMaxAmounts[i]` | token amount per batch (per token) | `TokenBatchLimitExceeded` / `ExceedsTokenMaxAmount` |
| `tokenDailyLimits[i]` | token amount per UTC day | `TokenDailyLimitExceeded` |
| `tokenTotalBudgets[i]` | token amount lifetime | `TokenTotalBudgetExceeded` |
| `periodBudgetWei` + `periodDuration` | ETH per rolling period (auto-rollover when the period elapses) | `PeriodBudgetExceeded` |
| `dailyLimitWei` | ETH per UTC day (resets at 00:00 UTC) | `DailyLimitExceeded` |
| `totalBudgetWei` | ETH lifetime | `AgentBudgetExceeded` |
| `expiry` | unix timestamp after which the agent is disabled | `AgentPermissionsExpired` |

Spending history (`totalSpentWei`, `periodSpentWei`, per-token spent) is **preserved across re-authorizations** — the owner can change limits without resetting what the agent already spent.

## Whitelists

Max 20 entries each. Semantics differ:

| Whitelist | Empty means |
|---|---|
| `allowedTokens` | **deny all** ERC-20 transfers/approves |
| `allowedProtocols` | **deny all** DeFi calls (case 3) |
| `allowedRecipients` | **any destination allowed** (applies to ETH recipients, token recipients, and approve spenders when set) |

## Fees

Every agent execution pays a **0.15%** protocol fee to the BVCC fee wallet (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), versus 0.05% for the personal smart wallet. Fee logic per call type: deducted from ETH sends, charged on top of token transfers (the wallet must hold `amount + fee`), and computed from balance deltas on DeFi calls.

## Reading agent state

```solidity
// Full permission struct, including arrays
function getAgentPermission(address agent) external view returns (AgentPermission memory);

// Every agent ever authorized (including revoked)
function getAgents() external view returns (address[] memory);

// ETH spent by the agent in the current UTC day
function getDailySpent(address agent) external view returns (uint128);

// Token spent: current UTC day + lifetime
function getTokenSpent(address agent, address token)
    external view returns (uint128 dailySpent, uint128 totalSpent);
```

A well-behaved agent should read these before submitting and size its transaction to fit the remaining budget.

## Error reference

All reverts use custom errors (4-byte selectors). The most relevant for an agent:

| Error | Cause |
|---|---|
| `NotAuthorizedAgent()` | caller is not an active agent (never authorized, or revoked) |
| `AgentPermissionsExpired()` | `block.timestamp >= expiry` |
| `EnforcedPause()` | owner called `pauseAgents()` (OpenZeppelin Pausable) |
| `AgentCannotCallWallet()` | an `Execution.target` is the wallet itself |
| `ExceedsPerTxLimit()` | one item's `value` > `maxPerTxWei` |
| `DailyLimitExceeded()` / `PeriodBudgetExceeded()` / `AgentBudgetExceeded()` | ETH limits (day / period / lifetime) |
| `NoTokensWhitelisted()` / `TokenNotAllowed()` | token transfer with empty whitelist / token not listed |
| `ExceedsTokenMaxAmount()` / `TokenBatchLimitExceeded()` | per-tx/batch token cap |
| `TokenDailyLimitExceeded()` / `TokenTotalBudgetExceeded()` | per-token day / lifetime budgets |
| `NoProtocolsWhitelisted()` / `ProtocolNotAllowed()` | DeFi call with empty whitelist / target not listed |
| `RecipientNotAllowed()` | destination/spender not in `allowedRecipients` |

Owner-side errors (`OnlyWallet`, `InvalidAgent`, `AgentMustBeEOA`, `ArrayLengthMismatch`, `TooManyTokens/Protocols/Recipients`, `UnknownAgent`, `AgentNotActive`, `ZeroAmount`) only appear when authorizing/managing agents.

## Events

```solidity
event AgentExecution(address indexed agent, uint128 ethSpent, uint32 dayIndex, uint128 totalSpentWei);
event AgentAuthorized(address indexed agent, uint128 maxPerTxWei, uint128 dailyLimitWei,
                      uint128 totalBudgetWei, uint128 periodBudgetWei, uint64 periodDuration, uint64 expiry);
event AgentRevoked(address indexed agent);
event AgentsPaused(address indexed by);
event AgentsUnpaused(address indexed by);
event AgentBudgetIncreased(address indexed agent, uint128 additionalWei, uint128 newTotalBudget);
```

`AgentExecution` is the one to index for monitoring agent activity off-chain.

## Example A — Foundry script (Solidity)

Send ETH from the agent wallet, signed by the agent EOA:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Execution} from "openzeppelin-contracts/contracts/account/utils/draft-ERC7579Utils.sol";

interface IAgentWallet {
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
}

contract AgentSendEth is Script {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    function run() external {
        address agentWallet = 0xYourAgentWalletAddress;
        address recipient   = 0xRecipientAddress;

        Execution[] memory execs = new Execution[](1);
        execs[0] = Execution({ target: recipient, value: 0.001 ether, callData: "" });

        vm.startBroadcast(); // broadcasts with the agent's private key
        IAgentWallet(agentWallet).executeAsAgent(BATCH_MODE, abi.encode(execs));
        vm.stopBroadcast();
    }
}
```

```bash
forge script script/AgentSendEth.s.sol \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $AGENT_PRIVATE_KEY \
  --broadcast
```

## Example B — TypeScript / viem

The same call from Node.js — an ETH send plus a USDC transfer in one batch:

```ts
import { createWalletClient, createPublicClient, http, parseEther,
         parseUnits, encodeAbiParameters, encodeFunctionData, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const AGENT_WALLET = '0xYourAgentWalletAddress'
const USDC         = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' // USDC on Arbitrum One
const BATCH_MODE   = '0x0100000000000000000000000000000000000000000000000000000000000000'

const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)
const wallet = createWalletClient({ account: agent, chain: arbitrum, transport: http() })
const client = createPublicClient({ chain: arbitrum, transport: http() })

const walletAbi = parseAbi([
  'function executeAsAgent(bytes32 mode, bytes executionData)',
  'function getDailySpent(address agent) view returns (uint128)',
])

// Optional: check remaining budget before sending
const spentToday = await client.readContract({
  address: AGENT_WALLET, abi: walletAbi,
  functionName: 'getDailySpent', args: [agent.address],
})

// Build the batch: Execution { target, value, callData }
const executions = [
  { // 1. send 0.001 ETH
    target: '0xRecipientAddress' as `0x${string}`,
    value: parseEther('0.001'),
    callData: '0x' as `0x${string}`,
  },
  { // 2. transfer 5 USDC (token must be in allowedTokens)
    target: USDC as `0x${string}`,
    value: 0n,
    callData: encodeFunctionData({
      abi: parseAbi(['function transfer(address to, uint256 amount)']),
      args: ['0xRecipientAddress', parseUnits('5', 6)],
    }),
  },
]

// executionData = abi.encode(Execution[]) — same encoding as the Foundry script
const executionData = encodeAbiParameters(
  [{ type: 'tuple[]', components: [
    { name: 'target',   type: 'address' },
    { name: 'value',    type: 'uint256' },
    { name: 'callData', type: 'bytes'   },
  ]}],
  [executions],
)

const hash = await wallet.writeContract({
  address: AGENT_WALLET,
  abi: walletAbi,
  functionName: 'executeAsAgent',
  args: [BATCH_MODE, executionData],
})
console.log('tx:', hash)
```

If the call reverts, simulate it first (`client.simulateContract` with the same args) — viem decodes the custom error name, which maps directly to the [error reference](#error-reference) above.

## See also

- [Contract Reference](./contracts.md) — full `AuthorizeParams` struct, factories, deployed addresses
- [Self-Hosting](./self-hosting.md) — run the frontend yourself
- [Bundler API](./bundler-api.md) — the optional ERC-4337 relay used by the app UI (not needed for agents)
