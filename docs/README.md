# BVCC Wallet — Developer Docs

Documentation for integrating with and self-hosting the BVCC Agent Wallet. Also browsable on the web at [bvccwallet.blockventurechaincapital.com/docs](https://bvccwallet.blockventurechaincapital.com/docs).

| Guide | What it covers |
|---|---|
| [Recover your wallet](./recovery.md) | Move a wallet to a new passkey with two of its three guardians — V5 votes step by step, network by network; the V4 flow at the end |
| [Move to wallet V5](./migrate.md) | Create a V5 wallet with the same passkey, then move funds, positions and agents across |
| [Connect an AI](./connect-ai.md) | Wire any MCP client (Claude, Cursor, LM Studio, Hermes) to the wallet — install, env vars, read-only mode, module filtering |
| [Agent Integration](./agent-integration.md) | How an AI agent calls `executeAsAgent` on wallet V5 — encoding, validators, limits and fee, errors, Foundry + viem examples; V4 differences at the end |
| [Signing with dApps](./signing.md) | What the wallet shows before you approve — calldata decoding, risk levels, editable approvals, EIP-5792 batching |
| [Setup & Self-Hosting](./self-hosting.md) | Clone, configure `.env.local`, optional bundler, PM2 + nginx deployment |
| [Contract Reference](./contracts.md) | V5 wallets, factory, registries and validators per network, `AuthorizeParams`, errors, security notes; V4 as the previous generation |
| [Bundler API](./bundler-api.md) | `POST /api/send-userop` spec, sender validation, fallback behavior |

Two more guides live only on the web, because they are heavy on diagrams:
[Agent permissions](https://bvccwallet.blockventurechaincapital.com/docs/agent-permissions)
and the illustrated version of
[Connect an AI](https://bvccwallet.blockventurechaincapital.com/docs/connect-ai).

> ⚠️ Experimental beta software, not externally audited. Non-custodial: BVCC never holds, controls or can recover funds. See the [legal pages](https://bvccwallet.blockventurechaincapital.com/legal/terms) before use.
