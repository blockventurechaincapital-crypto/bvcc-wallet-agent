import { createPublicClient, http, parseEther } from 'viem'
import { base } from 'viem/chains'

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
