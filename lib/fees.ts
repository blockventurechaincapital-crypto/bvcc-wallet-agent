// Fee BVCC — fuente única de verdad en el frontend.
// Debe seguir a BVCCWallet.sol: FEE_DENOMINATOR = 1_000_000,
// _feeNumerator() = 500 (standard) / 1500 (agent, BVCCAgentWallet.sol).

export const FEE_DENOMINATOR = 1_000_000n
export const FEE_NUMERATOR_STANDARD = 500n // 0.05%
export const FEE_NUMERATOR_AGENT = 1500n // 0.15%

export type WalletTypeValue = 0 | 1 | null

/** Numerador de fee del wallet activo. Ante duda (null) asume el mayor, para no prometer de menos. */
export function feeNumerator(walletType: WalletTypeValue): bigint {
  return walletType === 1 ? FEE_NUMERATOR_AGENT : FEE_NUMERATOR_STANDARD
}

/** '0.05' | '0.15' — para mostrar en la UI. */
export function feeRateLabel(numerator: bigint): string {
  return (Number(numerator) / Number(FEE_DENOMINATOR) * 100).toFixed(2).replace(/0$/, '')
}

/** Fee que cobra el contrato sobre `amount`. Mismo cálculo (floor) que Solidity. */
export function feeOf(amount: bigint, numerator: bigint): bigint {
  if (amount <= 0n) return 0n
  return (amount * numerator) / FEE_DENOMINATOR
}

/**
 * Caso 1 (nativo): el fee SALE de la cantidad — el destinatario recibe amount - fee.
 * Caso 2 (ERC-20): el fee es ADICIONAL — el destinatario recibe amount exacto y
 * el wallet necesita amount + fee (BVCCWallet.sol:160, InsufficientBalanceForFee).
 */
export function previewSend(amount: bigint, numerator: bigint, isNative: boolean) {
  const fee = feeOf(amount, numerator)
  return {
    fee,
    recipientGets: isNative ? amount - fee : amount,
    walletPays: isNative ? amount : amount + fee,
  }
}

/**
 * Cantidad máxima enviable de un ERC-20 dejando sitio al fee adicional:
 * el mayor `a` que cumple a + floor(a * n / D) <= balance.
 *
 * floor(balance * D / (D + n)) siempre cabe, pero se queda corto cuando el fee
 * redondea a 0 (importes pequeños). El óptimo nunca supera esa cota en más de 1
 * — porque (b+1)·D/(D+n) − b·D/(D+n) = D/(D+n) < 1 — así que basta probar +1.
 */
export function maxTokenAmount(balance: bigint, numerator: bigint): bigint {
  if (balance <= 0n) return 0n
  const base = (balance * FEE_DENOMINATOR) / (FEE_DENOMINATOR + numerator)
  const bumped = base + 1n
  return bumped + feeOf(bumped, numerator) <= balance ? bumped : base
}
