import { createPublicClient, http, parseEther } from 'viem'
import { base } from 'viem/chains'

// Calcula el fee BVCC de una cantidad
// 0.01% = 100 / 1_000_000
export function calculateFee(amount: bigint): { fee: bigint; amountAfterFee: bigint } {
  const fee = (amount * 100n) / 1_000_000n
  return { fee, amountAfterFee: amount - fee }
}

// Convierte ETH string a wei bigint con validacion
export function parseEthAmount(amount: string): bigint {
  try {
    return parseEther(amount as `${number}`)
  } catch {
    return 0n
  }
}

// Estima el gas de una transaccion simple
export async function estimateGas(
  from: `0x${string}`,
  to: `0x${string}`,
  value: bigint
): Promise<bigint> {
  const client = createPublicClient({ chain: base, transport: http() })
  try {
    return await client.estimateGas({ account: from, to, value })
  } catch {
    return 21000n // fallback
  }
}
