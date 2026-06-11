# BVCC Wallet — Developer Docs

Documentation for integrating with and self-hosting the BVCC Agent Wallet. Also browsable on the web at [bvccwallet.blockventurechaincapital.com/docs](https://bvccwallet.blockventurechaincapital.com/docs).

| Guide | What it covers |
|---|---|
| [Agent Integration](./agent-integration.md) | How an AI agent calls `executeAsAgent` — encoding, limits, whitelists, errors, Foundry + viem examples |
| [Setup & Self-Hosting](./self-hosting.md) | Clone, configure `.env.local`, optional bundler, PM2 + nginx deployment |
| [Contract Reference](./contracts.md) | Wallets, factories, `AuthorizeParams`, deployed addresses, security notes |
| [Bundler API](./bundler-api.md) | `POST /api/send-userop` spec, sender validation, fallback behavior |

> ⚠️ Experimental beta software, not externally audited. Non-custodial: BVCC never holds, controls or can recover funds. See the [legal pages](https://bvccwallet.blockventurechaincapital.com/legal/terms) before use.
