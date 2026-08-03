<p align="center">
  <img src="assets/bvcc_w.png" alt="BVCC Wallet" width="200">
</p>

<h1 align="center">BVCC Agent Wallet</h1>

<p align="center">
  Experimental open-source non-custodial smart wallet.<br>
  Face ID / WebAuthn · ERC-4337 · Self-custodial · No KYC
</p>

<p align="center">
  <a href="https://bvccwallet.blockventurechaincapital.com"><b>bvccwallet.blockventurechaincapital.com</b></a>
</p>

<p align="center">
  <a href="#documentation"><b>📚 Documentation</b></a> ·
  <a href="docs/agent-integration.md">Agent Integration</a> ·
  <a href="docs/self-hosting.md">Self-Hosting</a> ·
  <a href="docs/contracts.md">Contracts</a> ·
  <a href="docs/bundler-api.md">Bundler API</a>
</p>

## Screenshots & demo

### Dashboard — balances, assets & recent activity
![Dashboard](assets/1.png)

### AI Agents — on-chain spending limits

[![Demo: an AI agent using the wallet on Aave and Uniswap under on-chain limits](https://img.youtube.com/vi/dWUTaWBk68A/maxresdefault.jpg)](https://www.youtube.com/watch?v=dWUTaWBk68A)

▶️ [Watch the demo](https://www.youtube.com/watch?v=dWUTaWBk68A) — an AI agent moving funds on Aave and Uniswap, with the limits enforced by the contract.

| Create wallet (Face ID) | Guardian recovery (2-of-3) |
|:---:|:---:|
| ![Create wallet](assets/0.png) | ![Guardian recovery](assets/3.png) |

## Repository contents

This monorepo contains both halves of the project so judges can review them together:

- **Frontend** — Next.js app (this repo root: `app/`, `components/`, `lib/`, `public/`).
- **Contracts** — Foundry Solidity smart wallet + AI agent wallet contracts (`contracts/`, V4):
  `BVCCWallet` / `BVCCWalletFactory` (personal) and `BVCCAgentWallet` / `BVCCAgentWalletFactory` (AI-agent, on-chain spending limits + per-selector call policies), plus the security layer — `BVCCValidatorRegistry`, `BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`, `BVCCHookRegistry`, `IBVCCValidator`.
- **Tests** — 303 Foundry tests (unit, fork & fuzz) in `contracts/test/`. Run with `cd contracts && forge install && forge test` (`forge install` restores the libraries, which are git-ignored like `node_modules`).
- **Status** — Experimental public beta; smart contracts internally tested, **not externally audited**.

## Documentation

Developer docs live in [`docs/`](docs/) and on the web at [bvccwallet.blockventurechaincapital.com/docs](https://bvccwallet.blockventurechaincapital.com/docs):

| Guide | What it covers |
|---|---|
| [Agent Integration](docs/agent-integration.md) | How an AI agent calls `executeAsAgent` — encoding, limits, whitelists, errors, Foundry + viem examples |
| [Setup & Self-Hosting](docs/self-hosting.md) | Clone, configure `.env.local`, optional bundler, PM2 + nginx deployment |
| [Contract Reference](docs/contracts.md) | Wallets, factories, `AuthorizeParams`, deployed addresses, security notes |
| [Bundler API](docs/bundler-api.md) | `POST /api/send-userop` spec, sender validation, fallback behavior |

## Security Report

Internal security & test report for the BVCC Agent Wallet, covering four rounds: the Arbitrum Sepolia engagement (V1, 2026-06), the V2 mainnet gas hardening and multichain deploy, the V3 call-policy layer verified on Arbitrum One, and V4 (2026-07) — seven high-severity findings fixed, including a cross-function reentrancy that let a compromised agent bypass every limit and guardian squatting through the factory. Two issues remain open by decision, documented with their mitigations. Full files in [`audits/`](audits).

| Report | PDF | View in browser |
|---|---|---|
| English | [Security Report (PDF)](audits/BVCC-Agent-Wallet-Security-Report.pdf) | [Open HTML](https://htmlpreview.github.io/?https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent/blob/main/audits/bvcc-security-report.html) |
| Español | [Informe de Seguridad (PDF)](audits/BVCC-Agent-Wallet-Informe-Seguridad.pdf) | [Abrir HTML](https://htmlpreview.github.io/?https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent/blob/main/audits/bvcc-security-report-es.html) |

> Clicking a PDF opens it in GitHub's built-in viewer. "View in browser" renders the HTML source via htmlpreview.github.io. The report is internal (not an external third-party audit).

## License

Licensed under **GPL-3.0-or-later**. See [LICENSE](LICENSE).

## Important Notice

BVCC Wallet is experimental software provided as-is. BlockVenture Chain Capital is currently a Web3 brand/project. It is not a bank, broker, exchange, custodian, investment firm, or regulated financial institution. BVCC Wallet does not custody, control, manage, or recover user funds. Smart contracts may contain bugs or vulnerabilities. Use the software at your own risk and do not use funds you cannot afford to lose.

## Current Status

Public Beta / Experimental Mainnet Release — Internally tested smart contracts; Not externally audited yet; Use small amounts only; Agent Wallet permissions must be reviewed carefully by the user.

## Non-Custodial

BVCC Wallet does not store private keys, custody assets, or recover wallets. The user remains in control through WebAuthn/passkeys and configured guardians.

---

## Stack

- **Next.js 16.2.7** (App Router, Turbopack)
- **viem + wagmi v3** — on-chain reads, deploy via MetaMask/WC
- **WebAuthn API** — native biometric authentication (P256)
- **ERC-4337** — optional self-hosted bundler (`/api/send-userop`) with connected-wallet fallback, EntryPoint OZ v0.9
- **@walletconnect/web3wallet** — wallet mode (dApps connect to BVCC)

---

## Requirements

```bash
node >= 18
npm install --legacy-peer-deps
```

Copy `.env.example` to `.env.local` and fill in your own values:
```bash
cp .env.example .env.local
```
```
BUNDLER_PRIVATE_KEY=0x...          # OPTIONAL — EOA that calls handleOps (see "Bundler vs fallback")
ARBISCAN_API_KEY=...               # Etherscan API v2 (tx history)
COINGECKO_API_KEY=...              # USD prices (optional)
NEXT_PUBLIC_WC_PROJECT_ID=...      # Reown / WalletConnect project ID
```

> **Quick self-host:** you can leave `BUNDLER_PRIVATE_KEY` empty. The app
> automatically falls back to the connected wallet paying the gas. See below.

---

## Development

```bash
npm run dev        # http://localhost:3000
```

If you hit Turbopack cache errors:
```bash
rm -rf .next && npm run dev
```

---

## Architecture

### Contracts (`contracts/`)

| Contract | Networks | Address |
|---|---|---|
| BVCCSmartWalletFactoryV4 | Arbitrum One · Base · BNB Chain · Ethereum · Polygon · Arb Sepolia | `0xfd105197109244483b5f870501326E6faec9F93c` |
| BVCCAgentWalletFactoryV4 | Arbitrum One · Base · BNB Chain · Ethereum · Polygon · Arb Sepolia | `0xf3A61F9d64d45362E149A111289546523BCd26a6` |
| BVCCValidatorRegistry | all 6 (same address) | `0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2` |
| BVCCHookRegistry | all 6 (same address) | `0x551C6e7ABdA04a110790888e711198f25621b066` |
| EntryPoint OZ v0.9 (canonical) | all | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |

Deterministic CREATE2 deployment — the factories and both registries share the same
address on every network, so each user gets the same wallet address across all supported
chains. The per-router `BVCCUniversalRouterValidator` and per-PositionManager
`BVCCPositionManagerValidator` are chain-specific (each is bound to its chain's router /
position manager); their addresses per network are recorded in
[`contracts/deployments/`](contracts/deployments).

> **V3 (call-policy security model).** V3 hardens the AI-agent path so a stolen agent key
> can no longer redirect funds through a protocol call. Case-3 (DeFi) calls are now
> default-deny per selector: whitelisting a protocol is not enough — the owner must also
> register a call policy that either pins the recipient argument to the wallet, or defers
> to an on-chain validator for calldata where the recipient is buried in dynamic encoding
> (Universal Router, v4 PositionManager). Enabling a complex protocol needs two independent
> steps — BVCC registers its validator in the registry (48h timelock to *allow*, immediate
> to *deny*), and the owner adds the policy — so neither side alone can widen an agent's
> reach. The biometric owner is never restricted by policies; they apply only to agents.
> **V4 (2026-07).** Seven high-severity fixes on top of V3: a cross-function reentrancy through
> the `_currentAgent` flag that let a compromised agent bypass every limit; guardian squatting —
> the factory no longer chooses guardians, so deploying someone else's deterministic address
> gains you nothing; the passkey credential is now announced by the wallet itself in a signed
> call instead of travelling unauthenticated through the factory, and can be rotated after a
> recovery; recovery pauses agents; guardians became replaceable by the owner; and token calls
> may no longer carry native value. Wallets on an older generation see a banner in the app and
> can migrate with the same passkey.
>
> V4 keeps the V2 swap-gas fix (`PROBE_GAS_CAP = 100_000`). Previous V3 factories
> (`0xD42F61AA…` / `0xd866a756…`), V2 factories
> (`0x230b…BdEf1` / `0x8D9e…054c`) and V1 factories (`0xa5290A51…` / `0xc87aa107…`) are
> deprecated. See [`audits/`](audits) for the report, which covers all four rounds.

### Wallet types

**BVCCWallet (type 0 — Personal)**
- Every transaction requires Face ID
- Fee: 0.05% sent automatically to the BVCC fee wallet

**BVCCAgentWallet (type 1 — AI Agent)**
- Extends BVCCWallet
- Lets you delegate operations to AI agents with granular permissions:
  - maxPerTxWei, dailyLimitWei, totalBudgetWei
  - Renewable period budget (e.g. 500 ETH / 7 days)
  - ERC-20 token and DeFi protocol whitelist
  - Per-selector call policies: the recipient of a DeFi call is pinned to the wallet or checked by an on-chain validator
  - Expiry timestamp
- Fee: 0.15% per transaction
- The agent pays its own gas (direct EOA, not AA)

### Creation flow

1. **Step 1/4 — Network**: pick the deployment network
2. **Step 2/4 — Type**: Personal or AI Agent
3. **Step 3/4 — Guardians**: 3 recovery wallets (2-of-3 required)
4. **Step 4/4 — Deploy**: connect MetaMask, pay gas, receive a deterministic address

### Bundler vs fallback (who pays the gas)

Every operation is a **UserOp signed with WebAuthn (Face ID)**. The only thing
that changes between modes is **who submits it to `EntryPoint.handleOps` and pays
the gas**. The `lib/useSubmitUserOp.ts` hook resolves this automatically:

| Mode | When | Who pays the gas |
|---|---|---|
| **Server-side bundler** | `BUNDLER_PRIVATE_KEY` set (production / VPS) | the server's bundler EOA — Face-ID-only UX, no external wallet |
| **Connected-wallet fallback** | no `BUNDLER_PRIVATE_KEY` (local / self-host) | your connected wallet (MetaMask/WalletConnect), same as when creating the wallet |

Hook flow: it tries `POST /api/send-userop`; if the route responds
`501 { code: 'BUNDLER_NOT_CONFIGURED' }`, it calls `EntryPoint.handleOps([op], yourEOA)`
from the browser with the connected wallet (running `switchChain` if needed and
simulating before signing).

**It does not break non-custodial:** in both modes the UserOp is signed with
WebAuthn P256; whoever pays the gas only **relays** it — they cannot move funds
or change the signer. If there is neither a bundler nor a connected wallet, the
submission fails with a message asking you to connect a gas-funded wallet or set
`BUNDLER_PRIVATE_KEY`.

Bundler security: when running with a key, `/api/send-userop` only accepts
UserOps whose `sender` is a BVCC Wallet/Agent Wallet (`walletType()` ∈ {0,1} if
already deployed, or an `initCode` pointing to one of our factories) — anti
gas-drain. In fallback mode this does not apply because the user pays themselves.

### On-chain type detection

`useWalletType()` — calls `walletType()` on the contract via viem `readContract`.
It never uses localStorage as the source of truth for the type.
The sidebar shows "Agents" only when `walletType === 1`.

---

## Structure

```
app/
  page.tsx                  # Landing + creation flow (4 steps)
  wallet/
    layout.tsx              # Dynamic sidebar (Agents nav if walletType=1)
    page.tsx                # Dashboard (balance, assets, WalletConnect)
    send/                   # Send ETH/USDC
    swap/                   # Swap ETH↔USDC (Uniswap v3)
    transactions/           # History with filters
    address-book/           # Contacts
    agents/                 # AI agent management (agent wallets only)
    dapps/                  # dApps grid + iframe viewer
    settings/               # Network, guardians, session
    cancel-recovery/        # Cancel a recovery in progress
  recover/                  # Start recovery flow
  api/
    send-userop/            # Optional bundler (handleOps); falls back to connected wallet
    transactions/           # Etherscan API v2 proxy
    prices/                 # CoinGecko USD prices
    check-iframe/           # Detects whether a dApp allows embedding
lib/
  networks.ts               # 6-network config (live: Arbitrum One, Base, BNB Chain, Ethereum, Polygon, Arb Sepolia)
  NetworkContext.tsx        # Active-network React context
  abis.ts                   # ABIs: BVCCWallet, Factory, AgentWallet, AgentFactory
  useWalletType.ts          # Reads walletType() on-chain
  useWalletAddress.ts       # Reads address + credentialId from localStorage
  useSubmitUserOp.ts        # Submits UserOps: server bundler or connected-wallet fallback
  webauthn.ts               # registerWebAuthn / authenticateWebAuthn
  wallet.ts                 # getWalletAddress, getCredentialIdFromChain
  wcWallet.ts               # WalletConnect Web3Wallet singleton
```

---

## localStorage

| Key | Value |
|---|---|
| `bvcc_wallet_credential` | `{credentialId, walletAddress}` |
| `bvcc_active_wallet` | manually entered address |
| `bvcc_guardians` | `[addr1, addr2, addr3]` |
| `bvcc_address_book` | array of contacts |
| `bvcc_active_chain` | chainId of the selected network |

---


