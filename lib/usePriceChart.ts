'use client'
import { useQuery } from '@tanstack/react-query'
import type { NetworkConfig } from './networks'
import type { WalletToken } from './useTokens'

export type ChartDays = 1 | 7 | 30
export type ChartPoint = [number, number] // [timestamp ms, price usd]

async function fetchChart(token: WalletToken, network: NetworkConfig, days: ChartDays): Promise<ChartPoint[]> {
  // Sin id conocido no hay gráfica. Antes caía a 'ethereum' y pintaba la curva
  // de ETH bajo el saldo de otra moneda.
  if (token.isNative && !token.cgId) return []
  const params = token.isNative
    ? `id=${token.cgId}`
    : `chainId=${network.chainId}&contract=${token.address}`
  const res = await fetch(`/api/price-chart?${params}&days=${days}`)
  const data = await res.json()
  return (data.points as ChartPoint[]) ?? []
}

export function usePriceChart(token: WalletToken | null, network: NetworkConfig, days: ChartDays, enabled = true) {
  return useQuery({
    queryKey: ['priceChart', token?.key, network.chainId, days],
    queryFn: () => fetchChart(token!, network, days),
    enabled: enabled && !!token && token.usdPrice > 0,
    staleTime: 300_000,
  })
}
