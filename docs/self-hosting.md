<!-- Mirrored in the web app at /docs/self-hosting — keep in sync -->

# Setup & Self-Hosting

Run the BVCC Wallet frontend yourself. The app is fully non-custodial and has **no database** — Ethereum is the database — so self-hosting is just a Next.js app plus a few optional API keys.

## Prerequisites

- Node.js >= 18
- git

## Install

```bash
git clone https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent
cd bvcc-wallet-agent
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required because of WalletConnect peer-dependency conflicts.

## Configuration

Copy `.env.example` to `.env.local` and fill in what you need:

| Variable | Required | What breaks without it |
|---|---|---|
| `BUNDLER_PRIVATE_KEY` | No | Nothing breaks — the app falls back to the connected wallet (MetaMask/WalletConnect) paying gas via `EntryPoint.handleOps`. With it set, the server submits UserOps and users get a Face-ID-only UX. |
| `ARBISCAN_API_KEY` | Recommended | Transaction history (Etherscan API v2 proxy) stops working. |
| `COINGECKO_API_KEY` | No | USD price lookups may be rate-limited or unavailable. |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Recommended | WalletConnect (both directions: connecting external wallets and connecting dApps to BVCC) won't work. Free at cloud.reown.com. |

### The optional bundler

Every operation is a UserOp signed with WebAuthn — the only thing that changes is **who pays the gas**:

- **With `BUNDLER_PRIVATE_KEY`**: the `/api/send-userop` route signs `EntryPoint.handleOps` with that EOA and pays gas server-side. Fund it with a small amount of ETH on each network and rotate it like any hot key. It only accepts BVCC wallet senders (anti gas-drain check), so it can't be drained relaying arbitrary accounts.
- **Without it**: the route returns `501 BUNDLER_NOT_CONFIGURED` and the client falls back to the user's connected wallet submitting `handleOps` directly. Same security, slightly worse UX (the user signs a gas transaction).

See the [Bundler API reference](./bundler-api.md) for the route spec.

### Contracts

Nothing to deploy. The app points at the published factories (same address on every supported network) — see [Contract Reference](./contracts.md). If you fork the contracts, update `lib/networks.ts`.

## Development

```bash
npm run dev
```

> **WSL caveat:** if the repo lives under `/mnt/c/...`, Turbopack does not detect file changes. After editing, kill the dev server and clear the cache: `rm -rf .next && npm run dev`.

## Production (VPS)

```bash
npm run build
pm2 start npm --name bvcc-wallet -- start   # serves on :3000
pm2 save
```

nginx reverse proxy (TLS via certbot):

```nginx
server {
    server_name wallet.yourdomain.com;
    listen 443 ssl http2;
    # ssl_certificate / ssl_certificate_key via certbot

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

WebAuthn requires a **secure context** — serve over HTTPS (or localhost for development), otherwise passkey creation will fail.

## See also

- [Agent Integration](./agent-integration.md) — connect an AI agent to a deployed wallet
- [Contract Reference](./contracts.md) — factories and deployed addresses
- [Bundler API](./bundler-api.md) — `/api/send-userop` spec
