import type { NextConfig } from "next";
import { CSP_ENFORCE, cspReportOnly, scriptSrc } from "./lib/csp";

// ───────────────────────────────────────────────────────────────────────────
// Cabeceras de seguridad
// ───────────────────────────────────────────────────────────────────────────
// La CSP se define en `lib/csp.ts`, que comparten este fichero y `proxy.ts`.
// Aquí se sirve a TODAS las rutas sin `script-src` en enforce: sus hashes salen
// del HTML que genera el build, y estas cabeceras se congelan antes de que ese
// HTML exista. `proxy.ts` sustituye las dos cabeceras de CSP en las páginas.

/** Report-Only para las rutas que no pasan por `proxy.ts` (API, estáticos). */
const CSP_REPORT_ONLY = cspReportOnly(scriptSrc([]))

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
