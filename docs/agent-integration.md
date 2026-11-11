<!-- Mirrored in the web app at /docs/agent-integration — keep in sync -->

# Agent Integration Guide

How an external AI agent (or any automated system) executes transactions through a BVCC Agent Wallet V5 (`BVCCAgentWalletV5`), the current generation. All permissions, limits and checks are enforced on-chain: the agent cannot exceed them, whatever its code does. Differences on older V4 wallets are at the end.

> Browsable on the web at [bvccwallet.blockventurechaincapital.com/docs/agent-integration](https://bvccwallet.blockventurechaincapital.com/docs/agent-integration).

## How it works

- The wallet owner authorizes an agent address from the app (`/wallet/agents`), signing with their passkey. This calls `authorizeAgent()` on the wallet with the agent’s limits and policies.
- The agent calls `executeAsAgent()` on the wallet directly, as a normal EVM transaction: no ERC-4337 UserOp, no bundler, no passkey signature.
- The agent pays gas from its own EOA. The funds it moves come from the wallet.
- The wallet measures what leaves during the batch and charges it, plus a 0.15% agent fee, against the agent’s limits.

> The TypeScript SDK (`@bvcc/agent-sdk`) and the MCP server (`@bvcc/agent-mcp`) do all of this for you: they read the wallet version, build the batch, check the limits first and decode the errors. See Connect an AI. This page is for integrating by hand.

Requirements for the agent account:

- It must be a plain EOA, at authorization and at every call. An address with code, including an EIP-7702 delegation added later, is rejected (`AgentMustBeEOA`).
- It must be authorized, not expired, not paused on its own, and agents must not be paused globally.

## The entrypoint: executeAsAgent

```solidity
function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
```

`mode` must be the ERC-7579 batch mode; anything else reverts with `UnsupportedExecutionMode`:

```text
BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000
```

`executionData` is an ABI-encoded array of `Execution` structs:

```solidity
struct Execution {
    address target;   // contract or recipient to call
    uint256 value;    // native value (wei) to send with the call
    bytes   callData; // calldata; empty for pure native sends
}

// executionData = abi.encode(Execution[])  — a single call is a batch of one
```

Limits are checked over the whole batch: the native value of all items added up, and the net outflow of each token.

## What the wallet checks on each item

| Item | Shape | Checks |
|---|---|---|
| Native send | `value > 0`, empty `callData` | `target` in `allowedRecipients` |
| ERC-20 transfer | `transfer(address,uint256)`, no value | token in `allowedTokens`, recipient in `allowedRecipients` |
| ERC-20 approve | `approve(address,uint256)`, no value | token in `allowedTokens`, spender in `allowedProtocols`; reset after the batch |
| Protocol call | anything else | `target` in `allowedProtocols`, a policy with `ALLOWED` and `DEEP` for that agent and selector, the owner’s anchors, and a yes from the target’s validator |

- The agent can never call the wallet itself (`AgentCannotCallWallet`), nor a contract the owner has blocked (`TargetIsBlocked`).
- Policies are set by the owner, in the app. You only need to know what passes.

## Protocol calls and validators

Every protocol call is checked by the validator registered for that contract on that network. A validator answers yes or no and tells the wallet which tokens to measure. What passes:

- Universal Router `execute`: v3 exact-in / exact-out and v4 swaps between ERC-20 tokens. Every recipient must be the wallet (or the router’s "message sender" placeholder). v4 hooks must be none or approved. No native value: to swap native ETH, wrap it first.
- Uniswap v4 PositionManager `modifyLiquidities`: positions owned by the wallet only. Adding liquidity needs a position with no individual approval. One call cannot both remove and add liquidity; use two items. Hooks none or approved.
- Aave v3 Pool: `supply`, `withdraw`, `borrow` (variable rate), `repay`, `setUserUseReserveAsCollateral`, `setUserEMode`, always with the wallet as beneficiary. The asset must be an allowed token. A loan is charged against the budget, and after the batch the health factor must be at least 1.2 (`PostCheckFailed` otherwise).
- Uniswap v3 NonfungiblePositionManager: `mint` to the wallet; `increaseLiquidity`, `decreaseLiquidity`, `burn` and `collect` on the wallet’s own positions; `collect` to the wallet exactly.
- Wrapped native (WETH, WBNB, WPOL): `deposit()` with value, `withdraw(uint256)` without.

A validator that is not active on that network denies the call (`PolicyValidationFailed`). Withdrawals from Aave and from Uniswap positions are charged as they come into the wallet, so they count against the token’s budget too.

## Spending limits

Set per agent in `authorizeAgent`. `0` means nothing allowed; "unlimited" is `type(uint128).max`. Every charge includes the 0.15% fee.

| Limit | Scope | Error on violation |
|---|---|---|
| `maxPerTxWei` | native value of the whole batch, plus fee | `ExceedsPerTxLimit` |
| `dailyLimitWei` | native per UTC day | `DailyLimitExceeded` |
| `totalBudgetWei` | native lifetime | `TotalBudgetExceeded` |
| `periodBudgetWei` + `periodDuration` | native per rolling period (only if duration > 0) | `PeriodBudgetExceeded` |
| `tokenMaxAmounts[i]` | token outflow + costs + fee, per batch | `TokenBatchLimitExceeded` |
| `tokenDailyLimits[i]` | per token, per UTC day | `TokenDailyLimitExceeded` |
| `tokenTotalBudgets[i]` | per token, lifetime | `TokenTotalBudgetExceeded` |
| `expiry` | required, at most 365 days ahead; renewable with `renewAgent` | `AgentPermissionsExpired` |

> Spending history is kept when the owner re-authorizes an agent, so changing limits does not reset what was already spent.

## Fees and measurement

- The 0.15% agent fee is charged on what leaves the wallet, in the same asset, on top of the amount. A transfer of 100 USDC costs the wallet 100.15 USDC and counts 100.15 against the limits.
- To move a whole balance, leave room for the fee: send at most `balance / 1.0015`. Otherwise the batch reverts.
- What comes into the wallet from a swap pays nothing. Withdrawals from Aave or a liquidity position are charged as inflows.
- Every token on the agent’s list, every token found in the calldata and every token a validator declares is measured, up to 60. A balance that cannot be read reverts the batch (`MeasurementFailed`).
- Tokens that charge the sender a tax cannot be moved by agents: the fee payment would take more than the fee.
- Approvals the agent makes are set back to their previous value when the batch ends. Permit2 allowances for the Universal Router and the PositionManager come from the owner, not from the agent.

## Reading agent state

```solidity
// Permissions, including the agent's own pause flag and expiry
function getAgentPermission(address agent) external view returns (AgentPermission memory);
// Native spending counters (total, period)
function getAgentSpending(address agent) external view returns (AgentSpending memory);
// Native spent in the current UTC day
function getDailySpent(address agent) external view returns (uint128);
// Token spent: current UTC day + lifetime (charges include the fee)
function getTokenSpent(address agent, address token) external view returns (uint128 daily, uint128 total);
// Policy and value set for one function of one contract
function getAgentCallPolicy(address agent, address target, bytes4 selector) external view returns (uint256);
function getAgentValueSet(address agent, address target, bytes4 selector) external view returns (bytes32[] memory);
function isTargetBlocked(address target) external view returns (bool);
function paused() external view returns (bool); // all agents paused
function getAgents() external view returns (address[] memory);
```

A well-behaved agent reads these before submitting and sizes its batch to fit what is left, fee included.

## Error reference

| Error | Cause |
|---|---|
| `NotAuthorizedAgent()` | caller is not an active agent (never authorized, or revoked) |
| `AgentPermissionsExpired()` | the expiry has passed; the owner can renew |
| `AgentPaused()` / `EnforcedPause()` | this agent is paused / every agent is paused |
| `AgentMustBeEOA()` | the agent address has code (for example an EIP-7702 delegation) |
| `UnsupportedExecutionMode()` | `mode` is not the batch mode |
| `AgentCannotCallWallet()` / `TargetIsBlocked()` | an item targets the wallet itself / a contract the owner blocked |
| `RecipientNotAllowed()` | native or token destination not in `allowedRecipients` |
| `TokenNotAllowed()` | token not in `allowedTokens`, or an unlisted token left the wallet |
| `ProtocolNotAllowed()` | protocol call target, or approve spender, not in `allowedProtocols` |
| `TokenCallWithValue()` | a transfer or approve carried native value |
| `SelectorNotAllowed()` / `CallNeedsValidator()` | no policy for this function / a policy without `DEEP` |
| `PinnedArgMismatch()` / `CalldataTooShort()` | an anchored calldata word does not match / calldata under 4 bytes |
| `PolicyValidationFailed()` | the validator said no, reverted, or is not active on this network |
| `PostCheckFailed()` | a validator’s check after the batch failed (Aave health factor below 1.2) |
| `ExceedsPerTxLimit()` / `DailyLimitExceeded()` / `PeriodBudgetExceeded()` / `TotalBudgetExceeded()` | native limits |
| `TokenBatchLimitExceeded()` / `TokenDailyLimitExceeded()` / `TokenTotalBudgetExceeded()` | token limits |
| `MeasurementFailed()` / `TooManyMeasuredTokens()` | a balance could not be read / more than 60 tokens to measure |
| `FeeTransferFailed()` | the fee could not be paid exactly (for example a sender-taxed token) |

Owner-side errors (`OnlyWallet`, `InvalidAgent`, `InvalidExpiry`, `InvalidPolicy`, `ArrayLengthMismatch`, `TooManyTokens/Protocols/Recipients/Values`, `UnknownAgent`, `ZeroAmount`) only appear when authorizing or managing agents.

## Events

```solidity
// Charges include the fees
event AgentExecution(address indexed agent, uint256 ethCharged, uint256 ethFee,
                     address[] tokens, uint256[] tokenCharges, uint256[] tokenFees);
event AgentAuthorized(address indexed agent, uint128 maxPerTxWei, uint128 dailyLimitWei,
                      uint128 totalBudgetWei, uint128 periodBudgetWei, uint64 periodDuration, uint64 expiry);
event AgentRevoked(address indexed agent);
event AgentRenewed(address indexed agent, uint64 expiry);
event AgentPausedSet(address indexed agent, bool paused);
event AgentsPaused();
event AgentsUnpaused();
event AgentBudgetIncreased(address indexed agent, uint128 additionalWei, uint128 newTotalBudget);
event AgentCallPolicySet(address indexed agent, address indexed target, bytes4 indexed selector, uint256 policy);
event TargetBlocked(address indexed target, bool blocked);
```

`AgentExecution` is the one to index to follow agent activity off-chain. Its charges include the fees.

## Example A — Foundry script (Solidity)

Send ETH from the agent wallet, signed by the agent EOA. The recipient must be on the agent’s list, and the fee is added on top:

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

The same call from Node.js: an ETH send plus a USDC transfer in one batch:

```typescript
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

If the call reverts, simulate it first (`client.simulateContract` with the same arguments). viem decodes the custom error name, which maps to the error reference above.

## Older wallets (V4)

The entrypoint, the batch encoding and the examples are the same on V4 agent wallets. What differs:

- `0` means unlimited and an empty `allowedRecipients` means any destination. `maxPerTxWei` applies to each item, not to the batch.
- Protocol calls need a policy per selector, but only the Universal Router and the Uniswap v4 PositionManager go through a validator; other policies pin the recipient to the wallet (`PinnedArgMismatch`). SwapRouter02 is available. `approve` spenders are checked against `allowedRecipients`.
- The wallet does not measure outflows: token budgets count transfers and approvals only, so spending through an approval the owner gave earlier is not counted. Agent approvals are not reset.
- Expiry is optional, there is no per-agent pause and no target blocking. The lifetime native error is `AgentBudgetExceeded`; `getAgentPermission` includes the spending counters.
- The 0.15% fee follows the owner’s three cases: taken from native sends, added on top of token transfers, and computed on balance increases for other calls.

> New agent wallets are V5. To move an existing one, see Move to wallet V5.
