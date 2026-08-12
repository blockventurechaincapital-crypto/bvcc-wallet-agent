'use client'
import { createPublicClient, http, decodeEventLog, type Address, type Hex } from 'viem'
import { ENTRYPOINT_ABI } from './entrypoint'
import type { NetworkConfig } from './networks'

/**
 * Qué pasó de verdad con una operación, una vez enviada.
 *
 * Existe porque tener el hash NO significa que la operación saliera. Entre
 * "el bundler la mandó" y "el dinero se movió" caben tres finales distintos, y
 * hasta ahora la app enseñaba "éxito" nada más recibir el hash:
 *
 *   confirmada   la transacción se minó Y la UserOperation salió bien
 *   fallida      o revirtió la transacción entera (falló la validación), o se
 *                minó pero la UserOperation falló al ejecutarse
 *   reemplazada  otra transacción ocupó esa nonce. El bundler es una sola EOA
 *                compartida: si una operación se queda sin minar, la del
 *                siguiente usuario la reemplaza. La wallet NO gastó nonce y el
 *                dinero NO se movió → lo que toca es reintentar
 *   pendiente    se agotó la espera. No es un error: puede entrar después
 */
export type UserOpOutcome =
  | { estado: 'confirmada'; hash: Hex; gasCost?: bigint }
  | { estado: 'fallida'; hash: Hex; donde: 'validacion' | 'ejecucion' }
  | { estado: 'reemplazada'; hash: Hex; nuevoHash?: Hex }
  | { estado: 'pendiente'; hash: Hex }

/** Por defecto 3 minutos: sobra en L2 y es razonable en L1 sin dar un falso error. */
const ESPERA_MS = 180_000

export async function waitForUserOp(
  hash: Hex,
  network: NetworkConfig,
  opts: { wallet?: Address; timeoutMs?: number } = {},
): Promise<UserOpOutcome> {
  const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
  let reemplazo: Hex | undefined

  let receipt
  try {
    receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: opts.timeoutMs ?? ESPERA_MS,
      // viem vigila la nonce del emisor: si aparece otra transacción con la
      // misma, avisa aquí en vez de esperar para siempre a un hash muerto.
      onReplaced: (r) => { reemplazo = r.transaction?.hash },
    })
  } catch {
    // waitForTransactionReceipt lanza tanto por timeout como cuando la
    // transacción desaparece del nodo tras ser reemplazada.
    return reemplazo
      ? { estado: 'reemplazada', hash, nuevoHash: reemplazo }
      : { estado: 'pendiente', hash }
  }

  if (reemplazo) return { estado: 'reemplazada', hash, nuevoHash: reemplazo }

  // Transacción revertida = falló la validación (AA21/AA24/AA25). No se cobró
  // nada a la cuenta; el gas lo pagó el bundler.
  if (receipt.status !== 'success') return { estado: 'fallida', hash, donde: 'validacion' }

  // La transacción se minó, pero eso NO basta: hay que leer el UserOperationEvent.
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: ENTRYPOINT_ABI, data: log.data, topics: log.topics })
      if (ev.eventName !== 'UserOperationEvent') continue
      const args = ev.args as unknown as { sender: Address; success: boolean; actualGasCost: bigint }
      // Con varias operaciones en la misma transacción, quedarse con la nuestra.
      if (opts.wallet && args.sender.toLowerCase() !== opts.wallet.toLowerCase()) continue
      return args.success
        ? { estado: 'confirmada', hash, gasCost: args.actualGasCost }
        : { estado: 'fallida', hash, donde: 'ejecucion' }
    } catch {
      // Log de otro contrato (transferencias del token, etc.): se ignora.
    }
  }

  // Sin evento no se puede afirmar que saliera bien. Antes que mentir, pendiente.
  return { estado: 'pendiente', hash }
}

/** URL de la transacción en el explorador de esa red. */
export function txUrl(network: NetworkConfig, hash: string): string {
  return `${network.blockExplorer.url}/tx/${hash}`
}
