// Mirrored from docs/self-hosting.md (monorepo, English canonical) — keep in sync
import type { LocalizedDoc } from '@/components/DocsPage'

const CODE_INSTALL = `git clone https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent
cd bvcc-wallet-agent
npm install --legacy-peer-deps`

const CODE_DEV = 'npm run dev'

const CODE_PM2 = `npm run build
pm2 start npm --name bvcc-wallet -- start   # serves on :3000
pm2 save`

const CODE_NGINX = `server {
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
}`

export const selfHosting: LocalizedDoc = {
  en: {
    title: 'Setup & Self-Hosting',
    intro:
      'Run the BVCC Wallet frontend yourself. The app is fully non-custodial and has no database — Ethereum is the database — so self-hosting is just a Next.js app plus a few optional API keys.',
    blocks: [
      { type: 'h2', text: 'Prerequisites' },
      { type: 'list', items: ['Node.js >= 18', 'git'] },

      { type: 'h2', text: 'Install' },
      { type: 'code', lang: 'bash', code: CODE_INSTALL },
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
      { type: 'code', lang: 'bash', code: CODE_DEV },
      {
        type: 'callout',
        tone: 'warn',
        text: 'WSL caveat: if the repo lives under `/mnt/c/...`, Turbopack does not detect file changes. After editing, kill the dev server and clear the cache: `rm -rf .next && npm run dev`.',
      },

      { type: 'h2', text: 'Production (VPS)' },
      { type: 'code', lang: 'bash', code: CODE_PM2 },
      { type: 'p', text: 'nginx reverse proxy (TLS via certbot):' },
      { type: 'code', lang: 'nginx', code: CODE_NGINX },
      {
        type: 'callout',
        tone: 'warn',
        text: 'WebAuthn requires a secure context — serve over HTTPS (or localhost for development), otherwise passkey creation will fail.',
      },
    ],
  },

  es: {
    title: 'Instalación y self-hosting',
    intro:
      'Ejecuta el frontend de BVCC Wallet tú mismo. La app es totalmente non-custodial y no tiene base de datos — Ethereum es la base de datos — así que self-hostearla es solo una app Next.js más unas pocas API keys opcionales.',
    blocks: [
      { type: 'h2', text: 'Requisitos previos' },
      { type: 'list', items: ['Node.js >= 18', 'git'] },

      { type: 'h2', text: 'Instalación' },
      { type: 'code', lang: 'bash', code: CODE_INSTALL },
      {
        type: 'p',
        text: '`--legacy-peer-deps` es necesario por conflictos de peer-dependencies de WalletConnect.',
      },

      { type: 'h2', text: 'Configuración' },
      { type: 'p', text: 'Copia `.env.example` a `.env.local` y rellena lo que necesites:' },
      {
        type: 'table',
        headers: ['Variable', 'Obligatoria', 'Qué deja de funcionar sin ella'],
        rows: [
          [
            '`BUNDLER_PRIVATE_KEY`',
            'No',
            'Nada se rompe — la app cae al fallback: la wallet conectada (MetaMask/WalletConnect) paga el gas vía `EntryPoint.handleOps`. Con ella configurada, el servidor envía los UserOps y el usuario solo usa su biometría.',
          ],
          ['`ARBISCAN_API_KEY`', 'Recomendada', 'Deja de funcionar el historial de transacciones (proxy de Etherscan API v2).'],
          ['`COINGECKO_API_KEY`', 'No', 'Los precios en USD pueden quedar limitados o no disponibles.'],
          [
            '`NEXT_PUBLIC_WC_PROJECT_ID`',
            'Recomendada',
            'WalletConnect no funciona (en ambas direcciones: conectar wallets externas y conectar dApps a BVCC). Gratis en cloud.reown.com.',
          ],
        ],
      },

      { type: 'h3', text: 'El bundler opcional' },
      {
        type: 'p',
        text: 'Toda operación es un UserOp firmado con WebAuthn — lo único que cambia es quién paga el gas:',
      },
      {
        type: 'list',
        items: [
          'Con `BUNDLER_PRIVATE_KEY`: el route `/api/send-userop` firma `EntryPoint.handleOps` con esa EOA y paga el gas en servidor. Fóndala con un poco de ETH en cada red y rótala como cualquier hot key. Solo acepta senders que sean wallets BVCC (check anti gas-drain), así que no se puede drenar relayando cuentas ajenas.',
          'Sin ella: el route devuelve `501 BUNDLER_NOT_CONFIGURED` y el cliente cae al fallback — la wallet conectada del usuario envía `handleOps` directamente. Misma seguridad, UX algo peor (el usuario firma una transacción de gas).',
        ],
      },
      { type: 'p', text: 'Mira la referencia de la API del bundler para la spec del route.' },

      { type: 'h3', text: 'Contratos' },
      {
        type: 'p',
        text: 'No hay nada que desplegar. La app apunta a las factories publicadas (misma dirección en todas las redes soportadas) — mira la referencia de contratos. Si forkeas los contratos, actualiza `lib/networks.ts`.',
      },

      { type: 'h2', text: 'Desarrollo' },
      { type: 'code', lang: 'bash', code: CODE_DEV },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Aviso WSL: si el repo vive bajo `/mnt/c/...`, Turbopack no detecta cambios en los archivos. Tras editar, mata el dev server y limpia la caché: `rm -rf .next && npm run dev`.',
      },

      { type: 'h2', text: 'Producción (VPS)' },
      { type: 'code', lang: 'bash', code: CODE_PM2 },
      { type: 'p', text: 'Reverse proxy de nginx (TLS vía certbot):' },
      { type: 'code', lang: 'nginx', code: CODE_NGINX },
      {
        type: 'callout',
        tone: 'warn',
        text: 'WebAuthn exige un contexto seguro — sirve por HTTPS (o localhost en desarrollo); si no, la creación de passkeys fallará.',
      },
    ],
  },
}
