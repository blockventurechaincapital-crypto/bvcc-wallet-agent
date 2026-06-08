'use client'
import { useQuery } from '@tanstack/react-query'

export interface PriceData {
  eth: { usd: number; change24h: number }
  usdc: { usd: number; change24h: number }
}

async function fetchPrices(): Promise<PriceData> {
  const res = await fetch('/api/prices')
  const data = await res.json()
  return {
    eth: { usd: data.eth?.usd ?? 0, change24h: data.eth?.change24h ?? 0 },
    usdc: { usd: 1, change24h: 0 },
  }
}

export function usePrices() {
  return useQuery<PriceData>({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
