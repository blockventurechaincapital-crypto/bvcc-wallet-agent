# BVCC Agent Wallet — Hackathon Submission

A non-custodial smart wallet with biometric authentication (Face ID / WebAuthn)
and granular AI-agent permissions, built on ERC-4337.

## What it is

BVCC Agent Wallet lets a user deploy a self-custodial smart-contract wallet that
authenticates with passkeys (WebAuthn / P256) instead of seed phrases, and
optionally delegate on-chain operations to AI agents under hard, on-chain spending
limits.

- **Biometric auth** — WebAuthn passkeys (P256/TPM), no seed phrase.
- **ERC-4337** — account abstraction with an optional self-hosted bundler; if no
  bundler is configured, the connected wallet (MetaMask/WalletConnect) submits the
  UserOp and pays gas — so it runs locally with zero backend setup.
- **AI Agent permissions** — per-tx / daily / total / period budgets, token and
  recipient whitelists, expiry, pause/unpause — all enforced on-chain.
- **Deterministic deploy** — CREATE2 factory; the address derives from the
  public key, so there is no user database.
- **Non-custodial** — no emails, no KYC, no key custody. Ethereum is the database.

## What's in this repo

A single repo with both halves so judges can review frontend and contracts together:

- **Frontend** — Next.js app (`app/`, `components/`, `lib/`, `public/`) + viem + wagmi, bilingual EN/ES.
- **Bundler** — optional Next.js API route (`/api/send-userop`) calling
  EntryPoint.handleOps. Without `BUNDLER_PRIVATE_KEY` the app automatically falls
  back to the connected wallet submitting handleOps client-side (see README →
  "Bundler vs fallback"). The UserOp is WebAuthn-signed in both modes.
- **Contracts** — Foundry Solidity smart wallet + AI agent wallet contracts in `contracts/`.
  Two wallet types:
  - `BVCCSmartWalletV1` (type 0 — personal, Face ID per tx)
  - `BVCCAgentWalletV1` (type 1 — AI agent, delegated ops with on-chain limits)
- **Tests** — 98/98 Foundry tests passing. Run with `cd contracts && forge test`.

## Networks

Testnet: Arbitrum Sepolia (active factories). Target mainnet: Base.

## Status

Experimental public beta. Smart contracts are internally tested but **not yet
externally audited**. Use small amounts only. See the in-app legal pages and the
README for full disclaimers.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).

## Run locally

```bash
cp .env.example .env.local   # fill in your own values
npm install
npm run dev                  # http://localhost:3000
```
