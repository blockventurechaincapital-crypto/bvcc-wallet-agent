import { formatEther, formatUnits, parseEther, parseUnits } from 'viem'

// ───────────────────────────────────────────────────────────────────────────
// Topes de un agente: enseñar y rellenar NO son lo mismo
// ───────────────────────────────────────────────────────────────────────────
// En el contrato, `0` significa SIN LÍMITE. Eso convierte cualquier pérdida de
// precisión al rellenar el formulario en un cambio de permisos: si un tope de
// 0,0000001 ETH se redondea a "0" y se vuelve a guardar, el agente pasa a no
// tener tope. Y no hace falta ningún atacante — le pasa a quien entra a cambiar
// el nombre de un protocolo y le da a guardar.
//
// Por eso hay dos familias de funciones, y la diferencia es el punto entero:
//   · `…Display` redondea. Vale para una tarjeta, nunca para un campo editable.
//   · `prefill…`  es exacto, y el inverso justo de `parse…`.

// Un TOPE y un GASTO no se enseñan igual, aunque los dos sean dinero.
//
// El gasto es una medición: redondearlo a seis decimales está bien, nadie
// necesita ver el wei que lleva gastado un agente. Un tope es una promesa sobre
// lo que puede pasar, y ahí redondear vuelve a mentir — un tope de 0,0000001 ETH
// se pintaba «0», que es exactamente lo que la misma tarjeta usa para decir SIN
// LÍMITE. El número más pequeño posible y el infinito, escritos igual.
export const formatEthLimit = formatEther
export const formatTokenLimit = formatUnits

/** Para GASTOS. Redondea: no vale para topes ni para rellenar un campo. */
export function formatEthDisplay(wei: bigint): string {
  if (wei === 0n) return '0'
  const eth = Number(wei) / 1e18
  if (eth >= 1) return eth.toFixed(4).replace(/\.?0+$/, '')
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

/** Para tarjetas y resúmenes. Redondea: NO usar para rellenar un campo. */
export function formatTokenDisplay(wei: bigint, decimals: number): string {
  if (wei === 0n) return '0'
  try {
    const val = Number(formatUnits(wei, decimals))
    if (val >= 1) return val.toFixed(2).replace(/\.?0+$/, '')
    return val.toFixed(6).replace(/\.?0+$/, '')
  } catch { return '0' }
}

// Un campo vacío y un 0 significan lo mismo para el contrato (sin límite), así
// que el formulario enseña el hueco vacío en vez de un 0 que se lee mal.
export function parseEthInput(val: string): bigint {
  if (!val || val === '0') return 0n
  try { return parseEther(val) } catch { return 0n }
}

export function parseTokenAmount(val: string, decimals: number): bigint {
  if (!val || val === '0') return 0n
  try { return parseUnits(val, decimals) } catch { return 0n }
}

/** Texto para el campo del formulario. Exacto: `parseEthInput(prefillEth(x)) === x`. */
export function prefillEth(wei: bigint): string {
  return wei > 0n ? formatEther(wei) : ''
}

/** Texto para el campo del formulario. Exacto: `parseTokenAmount(prefillToken(x, d), d) === x`. */
export function prefillToken(wei: bigint, decimals: number): string {
  return wei > 0n ? formatUnits(wei, decimals) : ''
}

export function getTokenDecimals(address: string, usdcAddress?: string | null): number {
  if (usdcAddress && address.toLowerCase() === usdcAddress.toLowerCase()) return 6
  return 18
}
