'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
import { BVCC_WALLET_ABI, WALLET_TYPE_ABI } from './abis'
import type { NetworkConfig } from './networks'

export type AccountStatus = {
  deployed: boolean
  walletType: 0 | 1
  nonce: number          // nº de operaciones ejecutadas
  guardianCount: number  // guardians no-cero (de 3)
}

async function fetchStatus(address: string, network: NetworkConfig): Promise<AccountStatus> {
  const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
  const addr = address as Address

  const code = await client.getCode({ address: addr })
  const deployed = !!code && code !== '0x'

  if (!deployed) {
    return { deployed: false, walletType: 0, nonce: 0, guardianCount: 0 }
  }

  const [wType, nonce, g0, g1, g2] = await Promise.all([
    client.readContract({ address: addr, abi: WALLET_TYPE_ABI, functionName: 'walletType' }).catch(() => 0),
    client.readContract({ address: addr, abi: BVCC_WALLET_ABI, functionName: 'getNonce', args: [] }).catch(() => 0n),
    client.readContract({ address: addr, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [0n] }).catch(() => '0x0000000000000000000000000000000000000000'),
    client.readContract({ address: addr, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [1n] }).catch(() => '0x0000000000000000000000000000000000000000'),
    client.readContract({ address: addr, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [2n] }).catch(() => '0x0000000000000000000000000000000000000000'),
  ])

  const ZERO = '0x0000000000000000000000000000000000000000'
  const guardianCount = [g0, g1, g2].filter(g => (g as string).toLowerCase() !== ZERO).length

  return {
    deployed: true,
    walletType: wType === 1 ? 1 : 0,
    nonce: Number(nonce as bigint),
    guardianCount,
  }
}

export function useAccountStatus(address: string | null, network: NetworkConfig) {
  return useQuery({
    queryKey: ['accountStatus', address, network.chainId],
    queryFn: () => fetchStatus(address!, network),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}
