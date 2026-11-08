'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, type Address } from 'viem'
import { NETWORKS, type NetworkConfig } from './networks'
import { rpcTransport } from './rpc'

/**
 * The networks where this wallet exists: those with contract code at its address.
 * The address is the same on every network (CREATE2), so one address is checked on all.
 * A network whose RPC fails is left out rather than blocking the rest.
 */
export function useActiveNetworks(address: string | null | undefined) {
  const valid = !!address && /^0x[a-fA-F0-9]{40}$/.test(address)
  return useQuery({
    queryKey: ['activeNetworks', address?.toLowerCase()],
    enabled: valid,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<NetworkConfig[]> => {
      const found = await Promise.all(NETWORKS.map(async (n) => {
        try {
          const client = createPublicClient({ chain: n.viemChain, transport: rpcTransport(n) })
          const code = await client.getCode({ address: address as Address })
          return code && code !== '0x' ? n : null
        } catch {
          return null
        }
      }))
      return found.filter((n): n is NetworkConfig => n !== null)
    },
  })
}

/** Explorer page of `address` on `network`. */
export function explorerAddressUrl(network: NetworkConfig, address: string): string {
  return `${network.blockExplorer.url}/address/${address}`
}
