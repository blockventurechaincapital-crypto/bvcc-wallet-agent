<!-- Mirrored in the web app at /docs/connect-ai — keep in sync -->

# Connect an AI

Any MCP client can drive a BVCC Agent Wallet: Claude, Cursor, LM Studio, Hermes. One
command, no plugin, no adapter.

```bash
npx -y @bvcc/agent-mcp
```

The MCP server grants no authority of its own. It is a convenience layer over the same
`executeAsAgent` path described in [Agent Integration](./agent-integration.md). Every
budget, allowed token, allowed protocol and recipient is checked by the contract on every
call. If the model attempts something outside the envelope you authorized, the transaction
reverts — regardless of what the server or the model decided to try.

## Before you start

1. **Node.js 18 or newer.** That is what provides `npx`. Check with `node -v`.
2. **An Agent Wallet**, created at
   [bvccwallet.blockventurechaincapital.com](https://bvccwallet.blockventurechaincapital.com).
   Its address is the same on every chain (deterministic CREATE2).
3. **An authorized agent EOA.** Generate a keypair, then authorize its address in the
   dashboard with the limits you want. The agent's private key never reaches BVCC.

The agent must be authorized **on the chain you target**, or the call reverts.

## Environment

| Variable | Required | Meaning |
|---|:---:|---|
| `AGENT_PRIVATE_KEY` | yes | The agent EOA private key (`0x` + 64 hex) |
| `WALLET_ADDRESS` | yes | Your Agent Wallet |
| `CHAIN_ID` | yes | `1` Ethereum · `56` BNB · `137` Polygon · `8453` Base · `42161` Arbitrum One · `421614` Arbitrum Sepolia |
| `BVCC_MCP_READONLY` | no | `true` exposes only the 27 read/simulate tools |
| `BVCC_MCP_MODULES` | no | Comma-separated groups: `core`, `aave`, `lp`. Unset = all |

## Client config

```json
{
  "mcpServers": {
    "bvcc-agent-wallet": {
      "command": "npx",
      "args": ["-y", "@bvcc/agent-mcp"],
      "env": {
        "AGENT_PRIVATE_KEY": "0xYOUR_AGENT_KEY",
        "WALLET_ADDRESS": "0xYOUR_WALLET",
        "CHAIN_ID": "42161"
      }
    }
  }
}
```

Some clients ask only for the inner server object, without the `mcpServers` wrapper. Paste
whichever shape the field already shows.

> **On Windows the command must be `npx.cmd`, not `npx`.** With plain `npx`, Windows cannot
> run the extensionless script and opens it in whatever editor is associated with it, so the
> file appears in VS Code or Notepad and the server never starts — usually with no useful
> error. `npx.cmd` is the real executable. (`"command": "cmd", "args": ["/c", "npx", …]`
> also works.) On macOS and Linux, plain `npx`.

## What gets registered

**53 tools** — 12 read, 15 simulate, 26 write — plus 4 operating guides the model can read
before acting. Most writes have a matching dry-run.

| Group | Tools | Covers |
|---|---:|---|
| `core` | 18 | Status, balances, headroom, transfers, approvals, Uniswap v3/v4 swaps |
| `aave` | 19 | Aave v3 supply, borrow, repay, withdraw, plus deleverage / close / collateral swap / debt swap planners |
| `lp` | 14 | Uniswap v3 and v4 liquidity — open, collect, reduce, close |
| guides | 2 | `getGuide` / `listGuides` — always exposed, even with modules filtered |

### Try it without risking anything

```bash
BVCC_MCP_READONLY=true npx -y @bvcc/agent-mcp
```

Drops every write tool and leaves 27. It can read balances, quote swaps and simulate
transactions, and it cannot move funds. Reasonable first connection, and a good fit for
dashboards or a model you do not fully trust yet.

`BVCC_MCP_MODULES` combines with it: `core` alone is 20 tools, `aave` 21, `lp` 16, and
`core` plus read-only leaves 13. If an agent will never touch lending, leaving those tools
out is one less thing it can get wrong.

## Recommended order of operations

1. `getAgentStatus` / `getCapabilities` — is the agent authorized, expired, paused? What may it touch?
2. `getNativeBalance` / `getTokenBalances` / `getRemaining` — funds and headroom.
3. `buildSwapPlan` with `quote: true` before any swap. Never swap with `amountOutMinimum` of `0`.
4. A `dryRun*` tool to preview gas and any revert reason.
5. The write tool itself.

A blocked action reverts on-chain. The SDK decodes 24 contract errors into plain language,
so read the returned message and adjust rather than retrying blindly.

## Writing your own bot instead

If you are building a bot in TypeScript rather than wiring up an assistant, use the SDK
directly:

```bash
npm i @bvcc/agent-sdk
```

Same catalog, same on-chain limits. The MCP server bundles it.

| Package | npm | Source |
|---|---|---|
| `@bvcc/agent-mcp` | [npmjs.com/package/@bvcc/agent-mcp](https://www.npmjs.com/package/@bvcc/agent-mcp) | [GitHub](https://github.com/blockventurechaincapital-crypto/bvcc-agent-mcp) |
| `@bvcc/agent-sdk` | [npmjs.com/package/@bvcc/agent-sdk](https://www.npmjs.com/package/@bvcc/agent-sdk) | [GitHub](https://github.com/blockventurechaincapital-crypto/bvcc-agent-sdk) |

Both MIT. Listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as
`com.blockventurechaincapital/bvcc-agent-wallet`.

## See also

- [Agent Integration](./agent-integration.md) · [Contract Reference](./contracts.md) · [Self-Hosting](./self-hosting.md)
- [Agent permissions explained](https://bvccwallet.blockventurechaincapital.com/docs/agent-permissions)
