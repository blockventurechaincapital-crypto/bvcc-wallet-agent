'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { NETWORKS, DEFAULT_NETWORK, getNetwork, type NetworkConfig } from './networks'

type NetworkContextType = {
  network: NetworkConfig
  setNetworkByChainId: (chainId: number) => void
  networks: NetworkConfig[]
}

const NetworkContext = createContext<NetworkContextType>({
  network: DEFAULT_NETWORK,
  setNetworkByChainId: () => {},
  networks: NETWORKS,
})

const STORAGE_KEY = 'bvcc_active_chain'

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const n = getNetwork(parseInt(stored, 10))
        // Only restore if the factory is deployed on that chain
        if (n.contracts.factory) setNetwork(n)
      } catch { /* unknown chain, keep default */ }
    }
  }, [])

  function setNetworkByChainId(chainId: number) {
    try {
      const n = getNetwork(chainId)
      if (!n.contracts.factory && !n.contracts.agentFactory) return // no factory deployed at all
      setNetwork(n)
      localStorage.setItem(STORAGE_KEY, String(chainId))
    } catch { /* unknown chain */ }
  }

  return (
    <NetworkContext.Provider value={{ network, setNetworkByChainId, networks: NETWORKS }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}
