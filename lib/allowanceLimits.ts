// ───────────────────────────────────────────────────────────────────────────
// Umbrales de aprobación (allowance)
// ───────────────────────────────────────────────────────────────────────────
// Este número vivía copiado en tres sitios: el decodificador de WalletConnect,
// la pantalla de permisos y el editor de límite del modal de firma. Tres copias
// del mismo umbral pueden divergir con el tiempo, y la que decide si el usuario
// ve el aviso antes de firmar es la del decodificador — es decir, la copia que
// más caro sale equivocar. Vive aquí y solo aquí.

/** A partir de aquí una aprobación se considera, en la práctica, ilimitada. */
export const UNLIMITED_THRESHOLD = 1n << 128n

export function isUnlimited(amount: bigint): boolean {
  return amount >= UNLIMITED_THRESHOLD
}

/** Múltiplo del saldo a partir del cual una aprobación es desproporcionada. */
export const EXCESSIVE_BALANCE_MULTIPLE = 10n

// Un umbral fijo es un acantilado: aprobar 2^128 − 1 salta el aviso de
// "ilimitado" y sigue siendo una cantidad que nadie va a gastar nunca. Restar
// uno no debería esquivar la advertencia, así que además del umbral fijo se
// compara con lo que el usuario tiene de verdad en ese token.
//
// Devuelve false si no se conoce el saldo (no se pudo leer, o es 0). Aprobar
// antes de recibir el token es normal y no debe llenar la pantalla de avisos.
export function isExcessive(amount: bigint, balance?: bigint): boolean {
  if (balance === undefined || balance <= 0n) return false
  return amount > balance * EXCESSIVE_BALANCE_MULTIPLE
}
