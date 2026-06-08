'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { NETWORKS, type NetworkConfig } from './networks'
import { useNetwork } from './NetworkContext'

const STORAGE_KEY = 'bvcc_view_networks'

// Redes que se muestran en el Overview (vista multi-cadena, independiente de la
// red de acción de NetworkContext). Persistido en localStorage como chainIds.
// Default: red activa + todas las mainnets (donde el portfolio luce).
function defaultChainIds(activeChainId: number): number[] {
  const ids = new Set<number>([activeChainId])
  for (const n of NETWORKS) if (!n.isTestnet) ids.add(n.chainId)
  return [...ids]
}

export function useViewNetworks() {
  const { network: active } = useNetwork()
  const [chainIds, setChainIds] = useState<number[] | null>(null)

  // Carga inicial desde localStorage (o default basado en la red activa)
  useEffect(() => {
    let initial: number[] | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: unknown) =>
            typeof id === 'number' && NETWORKS.some(n => n.chainId === id))
          if (valid.length > 0) initial = valid
        }
      }
    } catch { /* ignore */ }
    setChainIds(initial ?? defaultChainIds(active.chainId))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((ids: number[]) => {
    setChainIds(ids)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback((chainId: number) => {
    setChainIds(prev => {
      const cur = prev ?? []
      const next = cur.includes(chainId)
        ? cur.filter(id => id !== chainId)
        : [...cur, chainId]
      // nunca dejar la lista vacía
      const final = next.length > 0 ? next : cur
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(final)) } catch { /* ignore */ }
      return final
    })
  }, [])

  // NetworkConfig[] en el orden canónico de NETWORKS
  const networks: NetworkConfig[] = useMemo(() => {
    const ids = chainIds ?? defaultChainIds(active.chainId)
    return NETWORKS.filter(n => ids.includes(n.chainId))
  }, [chainIds, active.chainId])

  return {
    networks,                       // redes seleccionadas (resueltas)
    chainIds: chainIds ?? [],       // ids crudos
    isLoaded: chainIds !== null,
    toggle,
    setChainIds: persist,
  }
}
