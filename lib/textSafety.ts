// Caracteres que no se ven pero cambian lo que lees.
//
// Vive aparte porque hay dos sitios que necesitan la MISMA clasificación con
// dos reacciones distintas: el modal de firma los ESCAPA (ahí el usuario tiene
// que ver que están, porque es lo que va a firmar) y los metadatos de token los
// BORRAN (ahí son una etiqueta, no un contenido). Si cada uno llevase su propia
// tabla, acabarían divergiendo y una de las dos se quedaría corta.

/** Reordenan visualmente el texto: lo que lees deja de ser lo que hay.
 *  Se listan por punto de código a propósito: escritos como carácter literal
 *  dejarían el propio fuente ilegible, que es justo el ataque. */
export const BIDI = new Set([
  0x061c,                                          // ARABIC LETTER MARK
  0x200e, 0x200f,                                  // LEFT/RIGHT-TO-LEFT MARK
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,          // EMBEDDING / OVERRIDE / POP
  0x2066, 0x2067, 0x2068, 0x2069,                  // ISOLATE / POP ISOLATE
])

/** Invisibles y de control. Se dejan fuera \t (09), \n (0a) y \r (0d): un
 *  mensaje de varias líneas es normal. */
export function esControl(c: number): boolean {
  if (c === 0x09 || c === 0x0a || c === 0x0d) return false
  return c < 0x20 ||
    (c >= 0x7f && c <= 0x9f) ||     // DEL + C1
    (c >= 0x200b && c <= 0x200d) || // espacios de anchura cero
    c === 0x2028 || c === 0x2029 || // separadores de línea/párrafo
    c === 0xfeff                    // BOM
}
