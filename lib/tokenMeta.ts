// Saneado de los metadatos de token que llegan de un tercero (Etherscan).
//
// El símbolo y el nombre de un ERC-20 los escribe quien despliega el contrato, y
// para que aparezcan en la wallet basta con mandar una unidad del token: el
// descubrimiento se basa en las transferencias recibidas, así que el atacante
// elige el texto y no hace falta que la víctima haga nada.
//
// No es ejecución de código —React escapa— es SUPLANTACIÓN, y en la pantalla
// donde sale el dinero con eso basta: un símbolo de 2.000 caracteres empuja el
// desglose del fee y el aviso de saldo insuficiente fuera de la vista, y una `C`
// cirílica hace un USDC indistinguible del bueno.
//
// Se hace aquí, en el borde, y no en cada sitio que lo pinta: la pantalla de
// envío sola lo enseña en seis huecos distintos y basta con olvidar uno.
import { BIDI, esControl } from './textSafety'

/** Lo que cabe sin descuadrar la pantalla de envío ni la fila del selector. */
export const SYMBOL_MAX = 12
export const NAME_MAX = 40

/** Un ERC-20 declara `decimals` como uint8, y los de verdad no pasan de 18.
 *  Por encima de esto no es un token mal puesto: es un token que no se puede
 *  representar, y `formatUnits` con 1.000 decimales cuelga la pestaña. */
export const DECIMALS_MAX = 36

export type SafeTokenMeta = {
  symbol: string
  name: string
  /** El símbolo traía invisibles, no cabía, o no es ASCII imprimible.
   *  NO significa «es malo»: significa «no te fíes de que ponga USDC». */
  suspicious: boolean
}

const ASCII_IMPRIMIBLE = /^[\x20-\x7E]+$/

/** `esControl` deja pasar \t, \n y \r a propósito: un MENSAJE de varias líneas es
 *  normal. Una ETIQUETA de token de varias líneas no lo es — doce saltos caben de
 *  sobra en el límite de caracteres y estiran la fila igual. */
function esSaltoDeLinea(c: number): boolean {
  return c === 0x09 || c === 0x0a || c === 0x0d
}

function limpiar(raw: string, max: number): { texto: string; invisible: boolean; recortado: boolean } {
  let out = ''
  let invisible = false
  for (const ch of raw) {
    const c = ch.codePointAt(0) ?? 0
    if (BIDI.has(c) || esControl(c) || esSaltoDeLinea(c)) { invisible = true; continue }
    out += ch
  }
  out = out.trim()
  // Por punto de código, no por unidad UTF-16: si no, un corte a la mitad de un
  // par suplente deja medio carácter.
  const puntos = Array.from(out)
  const recortado = puntos.length > max
  if (recortado) out = puntos.slice(0, max).join('') + '…'
  return { texto: out, invisible, recortado }
}

export function sanitizeTokenMeta(rawSymbol: unknown, rawName: unknown): SafeTokenMeta {
  const s = limpiar(typeof rawSymbol === 'string' ? rawSymbol : '', SYMBOL_MAX)
  const n = limpiar(typeof rawName === 'string' ? rawName : '', NAME_MAX)
  const symbol = s.texto || '???'
  const name = n.texto || symbol
  // Un NOMBRE largo es normal y se recorta sin más; un SÍMBOLO largo no lo es.
  const suspicious = s.invisible || n.invisible || s.recortado || !ASCII_IMPRIMIBLE.test(symbol)
  return { symbol, name, suspicious }
}

/** `decimals` utilizable, o null si el token no se puede representar. */
export function safeDecimals(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  if (!Number.isInteger(n) || n < 0 || n > DECIMALS_MAX) return null
  return n
}
