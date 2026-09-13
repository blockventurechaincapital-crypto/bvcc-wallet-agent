import type { NextConfig } from "next";
import { DAPPS } from "./lib/dapps";

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

/** Los hosts de dApps embebibles. Se DERIVAN de `lib/dapps.ts`, que ya es la
 *  fuente de verdad de qué se puede embeber y de qué hostname puede tocar el
 *  backend (`resolveAllowedDAppUrl`). Escribirlos a mano aquí garantizaba que
 *  dentro de tres meses una dApp nueva funcionase en desarrollo y no en
 *  producción, y que el síntoma fuese un marco en blanco sin explicación. */
const DAPP_HOSTS = Array.from(new Set(DAPPS.map((d) => new URL(d.url).origin)))

/** WalletConnect monta un iframe OCULTO contra `verify.walletconnect.org` para
 *  registrar la atestación de origen cuando esta app hace de dApp — el camino
 *  «MetaMask paga el gas del alta». Está dentro de `@walletconnect/core`, no en
 *  código nuestro, así que no se ve leyendo la app.
 *
 *  ⚠️ Si `frame-src` no lo deja pasar, el `verifyContext` se degrada a UNKNOWN
 *  EN SILENCIO, y con él el aviso de «dominio no verificado» que enseñan el
 *  modal de firma y la tarjeta de conexión. Es decir: apretar esta directiva sin
 *  estos dos hosts aflojaría una señal de seguridad en vez de reforzarla. */
const VERIFY_FRAME_HOSTS = [
  'https://verify.walletconnect.org',
  'https://verify.walletconnect.com',
]

/** `frame-src`: lo único que esta app embebe son las dApps de la lista y el
 *  iframe de atestación de WalletConnect. `'self'` entra porque un marco del
 *  propio origen no añade superficie. */
const FRAME_SRC = `frame-src 'self' ${[...DAPP_HOSTS, ...VERIFY_FRAME_HOSTS].join(' ')}`

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
  FRAME_SRC,
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
  // frame-src ya está en enforce; se repite aquí por el mismo motivo que
  // img-src y connect-src.
  FRAME_SRC,
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
 *    - clipboard-write → las dApps embebidas la necesitan para copiar su URI de
 *      WalletConnect; el iframe la delega con allow="clipboard-write", y esa
 *      delegación solo funciona si el documento padre la tiene habilitada.
 *    - clipboard-read → el iframe de las dApps ya no la delega y la app no llama
 *      a `clipboard.readText()` en ninguna parte, así que hoy se podría apagar.
 *      No se hace aquí para no mezclar dos cambios: esto es la cabecera del
 *      documento, no la delegación del iframe. */
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
