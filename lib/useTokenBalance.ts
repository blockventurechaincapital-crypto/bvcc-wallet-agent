'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
import type { NetworkConfig } from './networks'

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

// Balance de un solo token (nativo o ERC-20) para send/swap. Refresca cada 30s.
export function useTokenBalance(
  walletAddress: string | null,
  network: NetworkConfig,
  token: { isNative: boolean; address?: Address | null },
) {
  const key = token.isNative ? 'native' : (token.address ?? 'none')
  return useQuery<bigint>({
    queryKey: ['tokenBalance', walletAddress, network.chainId, key],
    queryFn: async () => {
      const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
      if (token.isNative) return client.getBalance({ address: walletAddress as Address })
      return client.readContract({
        address: token.address as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as Address],
      }) as Promise<bigint>
    },
    enabled: !!walletAddress && (token.isNative || !!token.address),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
