# BVCC Wallet — Developer Docs

Documentation for integrating with and self-hosting the BVCC Agent Wallet. Also browsable on the web at [bvccwallet.blockventurechaincapital.com/docs](https://bvccwallet.blockventurechaincapital.com/docs).

| Guide | What it covers |
|---|---|
| [Connect an AI](./connect-ai.md) | Wire any MCP client (Claude, Cursor, LM Studio, Hermes) to the wallet — install, env vars, read-only mode, module filtering |
| [Agent Integration](./agent-integration.md) | How an AI agent calls `executeAsAgent` — encoding, limits, whitelists, errors, Foundry + viem examples |
| [Signing with dApps](./signing.md) | What the wallet shows before you approve — calldata decoding, risk levels, editable approvals, EIP-5792 batching |
| [Setup & Self-Hosting](./self-hosting.md) | Clone, configure `.env.local`, optional bundler, PM2 + nginx deployment |
| [Contract Reference](./contracts.md) | Wallets, factories, `AuthorizeParams`, deployed addresses, security notes |
| [Bundler API](./bundler-api.md) | `POST /api/send-userop` spec, sender validation, fallback behavior |

Two more guides live only on the web, because they are heavy on diagrams:
[Agent permissions](https://bvccwallet.blockventurechaincapital.com/docs/agent-permissions)
and the illustrated version of
[Connect an AI](https://bvccwallet.blockventurechaincapital.com/docs/connect-ai).

> ⚠️ Experimental beta software, not externally audited. Non-custodial: BVCC never holds, controls or can recover funds. See the [legal pages](https://bvccwallet.blockventurechaincapital.com/legal/terms) before use.
