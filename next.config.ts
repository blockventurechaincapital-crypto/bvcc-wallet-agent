import type { NextConfig } from "next";

// ───────────────────────────────────────────────────────────────────────────
// Cabeceras de seguridad
// ───────────────────────────────────────────────────────────────────────────
// Importan más de lo normal en esta app: el contrato NO valida `origin` ni
// `rpIdHash` (OpenZeppelin los omite a propósito, ver WebAuthn.sol), y el RP ID
// de WebAuthn es el dominio padre (`lib/webauthn.ts:112`). Es decir, la distancia
// entre "XSS en cualquier página del dominio" y "firma válida de UserOperation"
// es el código público de `lib/executeUserOp.ts`. Estas cabeceras son la capa
// que baja esa probabilidad.

/** Hosts que sirven imágenes. Los tres primeros están medidos registrando cada
 *  petición del navegador con las 6 redes activas; el cuarto sale del código:
 *  - icons.llama.fi             logos de las dApps (lib/dapps.ts)          [medido]
 *  - icons.llamao.fi            logos de red (lib/networks.ts)             [medido]
 *  - assets.coingecko.com       imágenes de token                          [medido]
 *  - raw.githubusercontent.com  logos de token (lib/useTokens.ts:49)       [del código]
 *
 *  raw.githubusercontent.com no se llegó a ver en la medición porque la wallet de
 *  prueba no tenía ERC-20; la plantilla de URL está en el código y es fija, así
 *  que entra igual. `data:` es para el QR de recibir. */
const IMG_HOSTS = [
  'https://icons.llama.fi',
  'https://icons.llamao.fi',
  'https://assets.coingecko.com',
  'https://raw.githubusercontent.com',
]

/** RPC públicos de las 6 redes (lib/networks.ts). Los seis, medidos.
 *  ⚠️ Si algún día se añade failover de RPC, esta lista tiene que crecer con él o
 *  la red de repuesto quedará bloqueada por CSP — y el síntoma será "no carga
 *  nada" justo cuando el RPC principal falle, que es el peor momento. */
const RPC_HOSTS = [
  'https://sepolia-rollup.arbitrum.io',
  'https://arb1.arbitrum.io',
  'https://mainnet.base.org',
  'https://ethereum-rpc.publicnode.com',
  'https://bsc-dataseed.binance.org',
  'https://polygon-bor-rpc.publicnode.com',
]

/** WalletConnect. Solo el primero está medido: forzando un emparejamiento con un
 *  URI `wc:`, el SDK abre exactamente `wss://relay.walletconnect.org` y nada más.
 *
 *  Los demás se dejan a propósito aunque no se hayan observado: son dominios del
 *  propio WalletConnect y hay caminos que esta prueba NO puede ejercitar sin una
 *  dApp real al otro lado — sobre todo `verify.walletconnect.*`, que es lo que
 *  alimenta el `verifyContext` de las propuestas de sesión
 *  (components/WcConnectModal.tsx:204). Bloquearlo por accidente rompería el aviso
 *  de dominio no verificado, que es una señal de seguridad, no un adorno. */
const WALLETCONNECT_HOSTS = [
  'wss://relay.walletconnect.org',        // medido
  'wss://relay.walletconnect.com',
  'https://relay.walletconnect.org',
  'https://relay.walletconnect.com',
  'https://verify.walletconnect.org',
  'https://verify.walletconnect.com',
  'https://explorer-api.walletconnect.com',
  'https://pulse.walletconnect.org',
  'https://api.web3modal.org',
]

/** Los 19 hosts de dApps embebibles (lib/dapps.ts).
 *  ⚠️ Si se añade una dApp a `lib/dapps.ts`, hay que añadirla también aquí. */
const DAPP_HOSTS = [
  'https://app.uniswap.org',
  'https://app.1inch.io',
  'https://curve.fi',
  'https://app.balancer.fi',
  'https://app.aave.com',
  'https://app.compound.finance',
  'https://app.morpho.org',
  'https://stargate.finance',
  'https://app.hop.exchange',
  'https://across.to',
  'https://stake.lido.fi',
  'https://yearn.fi',
  'https://app.eigenlayer.xyz',
  'https://opensea.io',
  'https://blur.io',
  'https://zapper.xyz',
  'https://debank.com',
  'https://analytics.blockventurechaincapital.com',
  'https://polymarket.com',
]

/** CSP en ENFORCE.
 *
 *  Se va endureciendo por tramos, de menos a más difícil, y a propósito NO lleva
 *  `default-src`: sin él, lo que no esté listado aquí sigue sin restringir, así
 *  que endurecer una directiva no puede romper otra por sorpresa. */
const CSP_ENFORCE = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${IMG_HOSTS.join(' ')}`,
  `connect-src 'self' ${[...RPC_HOSTS, ...WALLETCONNECT_HOSTS].join(' ')}`,
].join('; ')

/** CSP candidata, en REPORT-ONLY: no bloquea, solo denuncia por consola.
 *
 *  Se escribe con la política que QUEREMOS, no con la que ya funciona — si se
 *  pusiera 'unsafe-inline' en script-src no habría violaciones y no se
 *  aprendería nada. Se esperan violaciones de script-src: Next inyecta scripts
 *  inline propios, y hay que inventariarlas antes de poder endurecerla.
 *
 *  Excepción deliberada: style-src SÍ lleva 'unsafe-inline'. La app pinta con
 *  atributos `style` de React por todas partes y en CSP3 eso cae en
 *  style-src-attr → style-src; sin la excepción saldrían miles de violaciones
 *  de maquetado que taparían las de script, que son las que importan.
 *
 *  `frame-ancestors` NO se pone aquí: los navegadores la ignoran dentro de
 *  Report-Only. Va en CSP_ENFORCE, que es una cabecera distinta. */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // img-src y connect-src ya están en enforce. Se repiten aquí solo para que
  // `default-src 'self'` no genere ruido duplicado sobre ellas.
  `img-src 'self' data: blob: ${IMG_HOSTS.join(' ')}`,
  `connect-src 'self' ${[...RPC_HOSTS, ...WALLETCONNECT_HOSTS].join(' ')}`,
  `frame-src ${DAPP_HOSTS.join(' ')}`,
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Permissions-Policy. Solo se apaga lo que la app NO usa.
 *
 *  ⚠️ Tres cosas que NO se tocan y hay que dejar en su valor por defecto (`self`):
 *    - publickey-credentials-get / -create → son las passkeys. Apagarlas deja la
 *      wallet inutilizable.
 *    - clipboard-read / clipboard-write → las dApps embebidas las necesitan; el
 *      iframe las delega con allow="clipboard-write; clipboard-read"
 *      (app/wallet/dapps/page.tsx:598), y esa delegación solo funciona si el
 *      documento padre las tiene habilitadas. */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ')

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@walletconnect/web3wallet',
    '@walletconnect/core',
    '@walletconnect/utils',
    '@walletconnect/sign-client',
    '@walletconnect/relay-client',
  ],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // La app EMBEBE dApps, nunca es embebida (app/wallet/dapps/page.tsx).
          // Las dos cabeceras dicen lo mismo; X-Frame-Options es para navegadores
          // que no entienden frame-ancestors.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: CSP_ENFORCE },
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },

          // Las URLs llevan direcciones (/wallet/send?to=0x…) y hoy viajan
          // enteras en el Referer hacia otros orígenes.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },

          // HSTS: se copia EXACTAMENTE lo que producción ya sirve desde Apache
          // (comprobado el 2026-08-11 en bvccwallet.… y en el apex). Poner aquí
          // un valor más flojo —p. ej. sin `includeSubDomains`— sería un riesgo,
          // no una precaución: si la cabecera de Next ganase sobre la de Apache,
          // rebajaría una protección que ya está activa.
          //
          // Sin `preload`: es un compromiso aparte (lista pública, salir lleva
          // meses) y se decide por separado.
          //
          // Ojo: cuatro de las cabeceras de este bloque (X-Frame-Options, HSTS,
          // Referrer-Policy, X-Content-Type-Options) YA las pone Apache en
          // producción. Se dejan aquí igualmente para que quien despliegue sin
          // ese Apache delante —el modo self-host de la documentación— no se
          // quede sin ellas. La CSP y la Permissions-Policy sí son nuevas: en
          // producción no había ninguna.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
};

export default nextConfig;
