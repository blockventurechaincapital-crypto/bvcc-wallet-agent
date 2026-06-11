// Mirrored from docs/self-hosting.md (monorepo) — keep in sync
import type { DocContent } from '@/components/DocsPage'

export const selfHosting: DocContent = {
  title: 'Setup & Self-Hosting',
  intro:
    'Run the BVCC Wallet frontend yourself. The app is fully non-custodial and has no database — Ethereum is the database — so self-hosting is just a Next.js app plus a few optional API keys.',
  blocks: [
    { type: 'h2', text: 'Prerequisites' },
    { type: 'list', items: ['Node.js >= 18', 'git'] },

    { type: 'h2', text: 'Install' },
    {
      type: 'code',
      lang: 'bash',
      code: `git clone https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent
cd bvcc-wallet-agent
npm install --legacy-peer-deps`,
    },
    {
      type: 'p',
      text: '`--legacy-peer-deps` is required because of WalletConnect peer-dependency conflicts.',
    },

    { type: 'h2', text: 'Configuration' },
    { type: 'p', text: 'Copy `.env.example` to `.env.local` and fill in what you need:' },
    {
      type: 'table',
      headers: ['Variable', 'Required', 'What breaks without it'],
      rows: [
        [
          '`BUNDLER_PRIVATE_KEY`',
          'No',
          'Nothing breaks — the app falls back to the connected wallet (MetaMask/WalletConnect) paying gas via `EntryPoint.handleOps`. With it set, the server submits UserOps and users get a Face-ID-only UX.',
        ],
        ['`ARBISCAN_API_KEY`', 'Recommended', 'Transaction history (Etherscan API v2 proxy) stops working.'],
        ['`COINGECKO_API_KEY`', 'No', 'USD price lookups may be rate-limited or unavailable.'],
        [
          '`NEXT_PUBLIC_WC_PROJECT_ID`',
          'Recommended',
          'WalletConnect (both directions: connecting external wallets and connecting dApps to BVCC) won’t work. Free at cloud.reown.com.',
        ],
      ],
    },

    { type: 'h3', text: 'The optional bundler' },
    {
      type: 'p',
      text: 'Every operation is a UserOp signed with WebAuthn — the only thing that changes is who pays the gas:',
    },
    {
      type: 'list',
      items: [
        'With `BUNDLER_PRIVATE_KEY`: the `/api/send-userop` route signs `EntryPoint.handleOps` with that EOA and pays gas server-side. Fund it with a small amount of ETH on each network and rotate it like any hot key. It only accepts BVCC wallet senders (anti gas-drain check), so it can’t be drained relaying arbitrary accounts.',
        'Without it: the route returns `501 BUNDLER_NOT_CONFIGURED` and the client falls back to the user’s connected wallet submitting `handleOps` directly. Same security, slightly worse UX (the user signs a gas transaction).',
      ],
    },
    { type: 'p', text: 'See the Bundler API reference for the route spec.' },

    { type: 'h3', text: 'Contracts' },
    {
      type: 'p',
      text: 'Nothing to deploy. The app points at the published factories (same address on every supported network) — see the Contract Reference. If you fork the contracts, update `lib/networks.ts`.',
    },

    { type: 'h2', text: 'Development' },
    { type: 'code', lang: 'bash', code: 'npm run dev' },
    {
      type: 'callout',
      tone: 'warn',
      text: 'WSL caveat: if the repo lives under `/mnt/c/...`, Turbopack does not detect file changes. After editing, kill the dev server and clear the cache: `rm -rf .next && npm run dev`.',
    },

    { type: 'h2', text: 'Production (VPS)' },
    {
      type: 'code',
      lang: 'bash',
      code: `npm run build
pm2 start npm --name bvcc-wallet -- start   # serves on :3000
pm2 save`,
    },
    { type: 'p', text: 'nginx reverse proxy (TLS via certbot):' },
    {
      type: 'code',
      lang: 'nginx',
      code: `server {
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
}`,
    },
    {
      type: 'callout',
      tone: 'warn',
      text: 'WebAuthn requires a secure context — serve over HTTPS (or localhost for development), otherwise passkey creation will fail.',
    },
  ],
}
