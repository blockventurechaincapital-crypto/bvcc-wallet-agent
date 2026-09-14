import { DAPPS } from './dapps'
import { NETWORKS } from './networks'

// ───────────────────────────────────────────────────────────────────────────
// Content Security Policy — una sola definición
// ───────────────────────────────────────────────────────────────────────────
// La usan dos sitios y por eso vive aquí: `next.config.ts` (cabeceras de todas
// las rutas) y `proxy.ts` (añade `script-src` a las páginas, con los hashes del
// build). Dos copias de la política acabarían diciendo cosas distintas, y en
// una CSP eso solo se nota cuando algo deja de cargar.
//
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

/** RPC de las 6 redes, los principales y los de reserva, sacados de
 *  `lib/networks.ts`. Antes era una lista copiada a mano; con reserva, una copia
 *  que se queda atrás bloquea el RPC de repuesto justo cuando el principal falla,
 *  que es el único momento en que hace falta. */
const RPC_HOSTS = Array.from(new Set(NETWORKS.flatMap((n) => n.rpcUrls.map((u) => new URL(u).origin))))

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

/** Scripts de otro origen que se ejecutan en las páginas. Medido recorriendo
 *  todas las páginas en producción: el único es el beacon de Cloudflare Web
 *  Analytics, que Cloudflare INYECTA en el borde — no está en el código ni en el
 *  HTML que genera el build, y en local no aparece. Solo lo inyecta cuando la
 *  petición parece de un navegador, así que un `curl` a secas tampoco lo ve.
 *
 *  Sus datos van a `/cdn-cgi/rum` del mismo origen (lo decide el propio beacon
 *  cuando `data-cf-beacon` lleva `version`), así que `connect-src` no necesita
 *  nada más. */
const SCRIPT_HOSTS = [
  'https://static.cloudflareinsights.com',
]

/** `script-src` de las páginas: el propio origen (los chunks de `_next/static`),
 *  los hosts medidos y los hashes sha256 de los scripts EN LÍNEA que Next deja en
 *  el HTML prerenderizado (el arranque y el payload de cada página). Esos hashes
 *  cambian en cada build: los calcula `scripts/csp-hashes.mjs` al terminar
 *  `npm run build` y los sirve `proxy.ts`. Sin ellos, `'self'` a secas bloquea
 *  los scripts en línea y la página se ve pero no responde. */
export function scriptSrc(hashes: readonly string[]): string {
  return ["script-src 'self'", ...SCRIPT_HOSTS, ...hashes.map((h) => `'${h}'`)].join(' ')
}

/** `style-src`, medido recorriendo todas las páginas: hojas del propio origen y
 *  `fonts.googleapis.com`, que sale de un `@import` dentro de un `<style>`.
 *
 *  'unsafe-inline' es deliberado y no se quita: la app pinta con atributos
 *  `style` de React por todas partes (más de 4.000 en el HTML servido) y con
 *  decenas de `<style>`, y en CSP3 eso cae en style-src-attr / style-src-elem →
 *  style-src. Quitarlo exigiría reescribir el maquetado entero, y un estilo
 *  inyectado pesa muy poco al lado de un script. Lo que sí aporta en enforce:
 *  ninguna hoja de estilo de un host que no sea estos dos. */
const STYLE_SRC = "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"

/** CSP en ENFORCE para todas las rutas.
 *
 *  Se va endureciendo por tramos, de menos a más difícil, y a propósito NO lleva
 *  `default-src`: sin él, lo que no esté listado aquí sigue sin restringir, así
 *  que endurecer una directiva no puede romper otra por sorpresa.
 *
 *  `script-src` no está aquí: depende de los hashes del build, que no existen
 *  cuando Next congela estas cabeceras. Lo añade `proxy.ts` a las páginas. */
export const CSP_ENFORCE = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `img-src 'self' data: blob: ${IMG_HOSTS.join(' ')}`,
  `connect-src 'self' ${[...RPC_HOSTS, ...WALLETCONNECT_HOSTS].join(' ')}`,
  FRAME_SRC,
  STYLE_SRC,
].join('; ')

/** CSP candidata, en REPORT-ONLY: no bloquea, solo denuncia por consola.
 *
 *  Se escribe con la política que QUEREMOS, no con la que ya funciona — si se
 *  pusiera 'unsafe-inline' en script-src no habría violaciones y no se
 *  aprendería nada.
 *
 *  `frame-ancestors` NO se pone aquí: los navegadores la ignoran dentro de
 *  Report-Only. Va en CSP_ENFORCE, que es una cabecera distinta.
 *
 *  @param scriptSrcDirective la directiva `script-src` completa. Las páginas
 *  reciben la de los hashes (`proxy.ts`); el resto de rutas, la misma sin
 *  hashes. */
export function cspReportOnly(scriptSrcDirective: string): string {
  return [
    "default-src 'self'",
    // img-src, connect-src, frame-src y style-src ya están en enforce. Se repiten
    // aquí solo para que `default-src 'self'` no genere ruido duplicado sobre ellas.
    `img-src 'self' data: blob: ${IMG_HOSTS.join(' ')}`,
    `connect-src 'self' ${[...RPC_HOSTS, ...WALLETCONNECT_HOSTS].join(' ')}`,
    FRAME_SRC,
    scriptSrcDirective,
    STYLE_SRC,
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
