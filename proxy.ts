import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { CSP_ENFORCE, cspReportOnly, scriptSrc } from './lib/csp'

// ───────────────────────────────────────────────────────────────────────────
// `script-src` de las páginas, con los hashes del build
// ───────────────────────────────────────────────────────────────────────────
// Next deja scripts en línea en cada página y cambian en cada build, así que su
// `script-src` no puede ir en `next.config.ts` (esas cabeceras se congelan antes
// de que exista el HTML). `scripts/csp-hashes.mjs` los calcula al terminar
// `npm run build` y aquí se sirven. Las páginas siguen siendo estáticas: esto
// solo pone cabeceras, no las genera en cada petición.
//
// Modo, con la variable de entorno CSP_SCRIPT_SRC:
//   - `enforce` (por defecto): `script-src` se aplica.
//   - `report-only`: solo se denuncia por consola. Es la salida rápida si algo
//     se rompe en producción: cambiar la variable y reiniciar, sin recompilar.
//
// Si el fichero de hashes falta o es de OTRO build, en enforce se lanza un error
// (la página responde 500 y el motivo sale en el log) en vez de servir una lista
// que no corresponde: con hashes ajenos la app entera se vería sin responder, y
// sin `script-src` quedaría desprotegida sin que nadie lo note. En report-only
// se sirve sin hashes, que no rompe nada, y se avisa en el log.

type HashFile = { buildId: string; hashes: string[] }

const MODE = process.env.CSP_SCRIPT_SRC === 'report-only' ? 'report-only' : 'enforce'

let cached: string | null = null
let warned = false

function pageScriptSrc(): string {
  if (cached) return cached
  const dist = path.join(/* turbopackIgnore: true */ process.cwd(), '.next')
  let problem: string
  try {
    const buildId = fs.readFileSync(path.join(dist, 'BUILD_ID'), 'utf8').trim()
    const file = JSON.parse(fs.readFileSync(path.join(dist, 'csp-script-hashes.json'), 'utf8')) as HashFile
    if (file.buildId === buildId && Array.isArray(file.hashes) && file.hashes.length > 0) {
      cached = scriptSrc(file.hashes)
      return cached
    }
    problem = `.next/csp-script-hashes.json es del build ${file.buildId} y el servidor corre el ${buildId}`
  } catch (e) {
    problem = `no se pudo leer .next/csp-script-hashes.json (${(e as Error).message})`
  }
  const msg = `[csp] ${problem}. Ejecuta \`npm run build\` (no \`next build\` a secas).`
  if (MODE === 'enforce') throw new Error(msg)
  if (!warned) console.error(`${msg} Sirviendo script-src sin hashes en report-only.`)
  warned = true
  return scriptSrc([])
}

export function proxy() {
  // En `next dev` no hay HTML prerenderizado ni hashes: las cabeceras de
  // `next.config.ts` bastan, como antes.
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()

  const directive = pageScriptSrc()
  const response = NextResponse.next()
  if (MODE === 'enforce') {
    response.headers.set('Content-Security-Policy', `${CSP_ENFORCE}; ${directive}`)
  }
  response.headers.set('Content-Security-Policy-Report-Only', cspReportOnly(directive))
  return response
}

export const config = {
  matcher: [
    {
      // Solo documentos HTML: fuera la API, todo `_next/` y cualquier fichero con
      // extensión (lo de `public/`, robots.txt, sitemap.xml, favicon.ico). Las
      // páginas de esta app no llevan puntos en la ruta.
      source: '/((?!api/|_next/|.*\\.[^/]+$).*)',
      // Las precargas de `next/link` no son documentos: no llevan CSP.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
