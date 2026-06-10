'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
import { BVCC_WALLET_ABI, WALLET_TYPE_ABI } from './abis'
import { NETWORKS, type NetworkConfig } from './networks'
import { getCredentialIdFromChain } from './wallet'

// Datos necesarios para recrear la wallet en otra red con la MISMA address:
// la address CREATE2 depende solo de (factory, pubKey), y las factories tienen
// la misma address en todas las redes, así que basta replicar la llamada
// createWallet con la pubkey original. Guardians y credentialId se copian de
// la red de origen.
export type DeploySeed = {
  pubKeyX: bigint
  pubKeyY: bigint
  credentialId: string
  guardians: [Address, Address, Address]
  walletType: 0 | 1
  sourceName: string
}

async function fetchSeed(address: Address, target: NetworkConfig): Promise<DeploySeed | null> {
  // Prioriza redes del mismo tipo que la de destino (mainnet→mainnet, testnet→testnet)
  const candidates = NETWORKS
    .filter(n => n.chainId !== target.chainId && n.contracts.factory)
    .sort((a, b) =>
      Number(a.isTestnet !== target.isTestnet) - Number(b.isTestnet !== target.isTestnet)
    )

  for (const n of candidates) {
    try {
      const client = createPublicClient({ chain: n.viemChain, transport: http(n.rpcUrl) })
      const code = await client.getCode({ address })
      if (!code || code === '0x') continue

      const [signer, wType, g0, g1, g2, credentialId] = await Promise.all([
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'signer' }),
        client.readContract({ address, abi: WALLET_TYPE_ABI, functionName: 'walletType' }).catch(() => 0),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [0n] }),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [1n] }),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [2n] }),
        getCredentialIdFromChain(address, n),
      ])
      if (!credentialId) continue

      const [qx, qy] = signer as readonly [`0x${string}`, `0x${string}`]
      return {
        pubKeyX: BigInt(qx),
        pubKeyY: BigInt(qy),
        credentialId,
        guardians: [g0, g1, g2] as [Address, Address, Address],
        walletType: wType === 1 ? 1 : 0,
        sourceName: n.name,
      }
    } catch {
      // red caída o sin datos — probar la siguiente
    }
  }
  return null
}

export function useDeploySeed(address: string | null, target: NetworkConfig, enabled: boolean) {
  return useQuery({
    queryKey: ['deploySeed', address, target.chainId],
    queryFn: () => fetchSeed(address as Address, target),
    enabled: enabled && !!address,
    staleTime: 60_000,
  })
}
