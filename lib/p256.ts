// ───────────────────────────────────────────────────────────────────────────
// Validación de un punto de la curva P-256, en el cliente
// ───────────────────────────────────────────────────────────────────────────
// El contrato SÍ valida la curva, pero tarde: `initiateRecovery` guarda las
// coordenadas sin mirarlas y quien las comprueba es `executeRecovery`, a través
// de `_setSigner` → `P256.isValidPublicKey`. Para entonces ya hay dos
// aprobaciones dadas, y ese estado no tiene salida:
//
//   · `executeRecovery` revierte para siempre — las coordenadas malas están
//     guardadas y no se pueden cambiar;
//   · `initiateRecovery` está bloqueado por `require(recoveryApprovals < 2)`;
//   · solo `cancelRecovery` desatasca, y exige la passkey del propietario, que
//     es justo la que no se tiene cuando se está recuperando.
//
// O sea: un dedo torcido al copiar una coordenada deja la wallet sin
// recuperación posible. Esta comprobación en el navegador es la ÚNICA barrera
// que existe antes de ese punto de no retorno.
//
// Los parámetros y la ecuación son los mismos que usa el contrato, copiados de
// OpenZeppelin `utils/cryptography/P256.sol` (`P`, `A`, `B` e `isValidPublicKey`).

/** Tamaño del cuerpo. */
export const P256_P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
/** Parámetro `a` de la ecuación de Weierstrass (es exactamente P − 3). */
export const P256_A = 0xffffffff00000001000000000000000000000000fffffffffffffffffffffffcn
/** Parámetro `b`. */
export const P256_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn

/**
 * ¿Está `(x, y)` sobre la curva? Mismo criterio que `P256.isValidPublicKey`:
 * ambas coordenadas dentro del cuerpo y `y² ≡ x³ + ax + b (mod p)`.
 */
export function isValidP256Point(x: bigint, y: bigint): boolean {
  if (x < 0n || y < 0n) return false
  if (x >= P256_P || y >= P256_P) return false
  const lhs = (y * y) % P256_P
  const rhs = ((((x * x) % P256_P + P256_A) % P256_P) * x % P256_P + P256_B) % P256_P
  return lhs === rhs
}

/**
 * Lee una coordenada escrita a mano y devuelve `null` si no es hexadecimal o no
 * cabe en 256 bits.
 *
 * Separar el formato de la curva es lo que permite decir CUÁL de las dos cosas
 * está mal: "esto no son dígitos hexadecimales" y "esto no es una clave" son
 * problemas distintos y se arreglan de forma distinta.
 */
export function parseCoord(raw: string): bigint | null {
  const clean = raw.trim().replace(/^0x/i, '')
  if (clean.length === 0 || clean.length > 64) return null
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null
  return BigInt('0x' + clean)
}

/** Formato canónico: `0x` + 64 dígitos, que es como las escribe la propia app. */
export function coordToHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0')
}
