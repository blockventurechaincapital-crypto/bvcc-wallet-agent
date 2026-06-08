import { NextRequest, NextResponse } from 'next/server'

// Histórico de precio (USD) vía CoinGecko market_chart.
// Identifica el token por:
//   - id=<coingecko-id>            (token nativo: ethereum / binancecoin)
//   - chainId=<n>&contract=<addr>  (ERC-20 en red mainnet indexada)
// days = 1 | 7 | 30
// Testnets / tokens no indexados → points = [] (esperado).

const CG = 'https://api.coingecko.com/api/v3'

const PLATFORM: Record<string, string> = {
  '1': 'ethereum',
  '42161': 'arbitrum-one',
  '8453': 'base',
  '56': 'binance-smart-chain',
}

const API_KEY = process.env.COINGECKO_API_KEY
const headers: Record<string, string> = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const chainId = searchParams.get('chainId')
  const contract = searchParams.get('contract')?.toLowerCase()
  const days = searchParams.get('days') ?? '1'

  let url: string | null = null
  if (id) {
    url = `${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  } else if (chainId && contract) {
    const platform = PLATFORM[chainId]
    if (platform) {
      url = `${CG}/coins/${platform}/contract/${contract}/market_chart?vs_currency=usd&days=${days}`
    }
  }

  if (!url) return NextResponse.json({ points: [] })

  try {
    // Charts cambian lento → caché 5 min
    const res = await fetch(url, { headers, next: { revalidate: 300 } })
    if (!res.ok) return NextResponse.json({ points: [] })
    const data = await res.json()
    const prices = (data?.prices as [number, number][]) ?? []
    // points: [timestamp(ms), price][]
    return NextResponse.json({ points: prices })
  } catch {
    return NextResponse.json({ points: [] })
  }
}
