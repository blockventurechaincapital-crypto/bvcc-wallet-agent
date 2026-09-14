// Hashes de los scripts en línea del HTML prerenderizado, para `script-src`.
//
// Next deja en cada página scripts EN LÍNEA propios (el arranque y el payload de
// la página). Con `script-src` sin 'unsafe-inline', el navegador solo los ejecuta
// si su sha256 está en la cabecera. Esos hashes cambian en cada build — llevan el
// BUILD_ID y los nombres de los chunks —, así que este script corre al terminar
// `next build` (ver `build` en package.json) y deja el resultado dentro de
// `.next/`, junto al build del que sale. `proxy.ts` lo lee y lo sirve.
//
// Falla, y con él `npm run build`, en vez de dejar una lista incompleta:
//   - si una página no está prerenderizada, o se regenera (ISR): se generaría
//     con otros scripts en cada petición y esa página se rompería;
//   - si falta el HTML de una página, o no tiene ningún script en línea: Next
//     habría cambiado dónde o cómo los deja, y este script ya no sabe leerlos.
//
// Uso: node scripts/csp-hashes.mjs   (desde la raíz del proyecto, tras next build)

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DIST = path.join(process.cwd(), '.next')
const APP_HTML = path.join(DIST, 'server', 'app')
const OUT = path.join(DIST, 'csp-script-hashes.json')

const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(DIST, f), 'utf8'))

function fallar(msg) {
  console.error(`\n✗ csp-hashes: ${msg}\n`)
  process.exit(1)
}

if (!fs.existsSync(path.join(DIST, 'BUILD_ID'))) fallar('no hay .next/BUILD_ID — ¿se ha ejecutado next build?')
const buildId = fs.readFileSync(path.join(DIST, 'BUILD_ID'), 'utf8').trim()

// Páginas de app/ según el propio build: las claves que acaban en `/page`. Las
// `/route` (API, robots.txt, sitemap.xml, favicon.ico) no son HTML.
const rutas = leerJson('app-path-routes-manifest.json')
const prerender = leerJson('prerender-manifest.json').routes
const paginas = Object.entries(rutas)
  .filter(([clave]) => clave.endsWith('/page'))
  .map(([, ruta]) => ruta)
  .sort()

// Tipos de <script> que el navegador ejecuta. El JSON-LD (application/ld+json)
// es un bloque de datos: la CSP no lo mira y no necesita hash.
const EJECUTABLE = /^(?:(?:text|application)\/(?:java|ecma)script|module)$/i

const hashes = new Set()
const porPagina = {}
for (const ruta of paginas) {
  const p = prerender[ruta]
  if (!p || p.routeType !== 'page') fallar(`${ruta} no está prerenderizada: se generaría en cada petición con otros scripts`)
  if (p.initialRevalidateSeconds !== false) fallar(`${ruta} se regenera (revalidate ${p.initialRevalidateSeconds}): el HTML nuevo traería otros hashes`)

  const fichero = path.join(APP_HTML, `${ruta === '/' ? '/index' : ruta}.html`)
  if (!fs.existsSync(fichero)) fallar(`${ruta}: no existe ${path.relative(process.cwd(), fichero)}`)
  const html = fs.readFileSync(fichero, 'utf8')

  const deEsta = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, cuerpo] = m
    if (/\ssrc\s*=/i.test(attrs)) continue
    const tipo = attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i)?.[1]
    if (tipo && !EJECUTABLE.test(tipo)) continue
    const h = 'sha256-' + crypto.createHash('sha256').update(cuerpo, 'utf8').digest('base64')
    deEsta.push(h)
    hashes.add(h)
  }
  if (deEsta.length === 0) fallar(`${ruta}: ningún script en línea en su HTML — Next ha cambiado el formato`)
  porPagina[ruta] = deEsta.length
}

// Tamaño: la lista va entera en las dos cabeceras CSP de cada página (unos 54 bytes
// por hash). Un proxy inverso delante suele limitar cada línea de cabecera que le
// llega del servidor — Apache, 8190 bytes por defecto — y al pasarse responde 502:
// en local todo funciona y en producción no carga ninguna página. Las cabeceras
// llevan ya ~1,7 KB de política además de los hashes, así que se corta aquí, con
// margen, en vez de descubrirlo desplegando.
const MAX_HASH_BYTES = 4500
const lista = [...hashes].sort()
const bytes = lista.map((h) => `'${h}'`).join(' ').length
if (bytes > MAX_HASH_BYTES) {
  fallar(`${lista.length} hashes ocupan ${bytes} bytes (tope ${MAX_HASH_BYTES}). Con la política, la cabecera ` +
    'se acercaría al límite de línea del proxy inverso (Apache: 8190) y producción daría 502. ' +
    'Toca revisar el diseño de script-src antes de desplegar.')
}
fs.writeFileSync(OUT, JSON.stringify({ buildId, hashes: lista, pages: porPagina }, null, 1) + '\n')
console.log(`✓ csp-hashes: ${lista.length} hashes de ${paginas.length} páginas, ${bytes}/${MAX_HASH_BYTES} bytes → ${path.relative(process.cwd(), OUT)} (build ${buildId})`)
