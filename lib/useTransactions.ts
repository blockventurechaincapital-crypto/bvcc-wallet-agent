'use client'
import { useQuery, useQueries } from '@tanstack/react-query'
import type { TxItem } from '@/app/api/transactions/route'
import type { NetworkConfig } from './networks'

export type { TxItem }

// TxItem etiquetado con la red de la que proviene (para icono + enlace al explorer)
export type TxItemChain = TxItem & { chainId: number }

// Wallet de comisiones de BVCC (constante del contrato `BVCC_FEE_WALLET`). Las
// transferencias de fee hacia esta dirección se ocultan de la lista para que el
// usuario vea solo su movimiento real, no el cobro de comisión.
const BVCC_FEE_WALLET = '0x3e3eb089169a7315a994947465ce5f5fc3a307d4'

export type TransactionsResponse = {
  items: TxItem[]
  error?: string
}

export function useTransactions(address: string | null, chainId: number, page = 1) {
  return useQuery<TransactionsResponse>({
    queryKey: ['transactions', address, chainId, page],
    queryFn: () =>
      fetch(`/api/transactions?address=${address}&chainId=${chainId}&page=${page}&offset=20`).then(r => r.json()),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}

// Agrega transacciones de varias redes en paralelo, cada una etiquetada con su chainId.
// Trae `perChain` por red (página 1) y mergea ordenando por timestamp desc.
export function useMultiChainTransactions(
  address: string | null,
  networks: NetworkConfig[],
  perChain = 25,
) {
  const results = useQueries({
    queries: networks.map(n => ({
      queryKey: ['transactions', address, n.chainId, 1, perChain],
      queryFn: () =>
        fetch(`/api/transactions?address=${address}&chainId=${n.chainId}&page=1&offset=${perChain}`)
          .then(r => r.json() as Promise<TransactionsResponse>),
      enabled: !!address,
      staleTime: 10_000,
      refetchInterval: 20_000,
    })),
  })

  const items: TxItemChain[] = []
  let noApiKey = false
  results.forEach((r, i) => {
    if (r.data?.error === 'NO_API_KEY') noApiKey = true
    for (const it of r.data?.items ?? []) {
      // Ocultar la transferencia de comisión BVCC (destino = fee wallet)
      if (it.to?.toLowerCase() === BVCC_FEE_WALLET) continue
      items.push({ ...it, chainId: networks[i].chainId })
    }
  })
  items.sort((a, b) => b.timestamp - a.timestamp)

  return {
    items,
    isLoading: results.some(r => r.isLoading) && items.length === 0,
    isFetching: results.some(r => r.isFetching),
    noApiKey: noApiKey && items.length === 0,
  }
}
