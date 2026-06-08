'use client'
import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { useWalletAddress } from './useWalletAddress'
import { useNetwork } from './NetworkContext'
import { WALLET_TYPE_ABI } from './abis'

export interface WalletTypeState {
  walletType: 0 | 1 | null  // 0 = STANDARD, 1 = AGENT, null = unknown/loading
  isLoading: boolean
}

export function useWalletType(): WalletTypeState {
  const { address, isLoaded } = useWalletAddress()
  const { network } = useNetwork()
  const [walletType, setWalletType] = useState<0 | 1 | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded || !address) {
      setWalletType(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const client = createPublicClient({
      chain: network.viemChain,
      transport: http(network.rpcUrl),
    })

    client.readContract({
      address: address as `0x${string}`,
      abi: WALLET_TYPE_ABI,
      functionName: 'walletType',
    })
      .then((result) => {
        setWalletType(result === 1 ? 1 : 0)
      })
      .catch(() => {
        setWalletType(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [address, isLoaded, network.chainId])

  return { walletType, isLoading }
}
