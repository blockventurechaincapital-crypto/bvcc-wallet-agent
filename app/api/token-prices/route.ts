import { NextRequest, NextResponse } from 'next/server'

// Precios USD + cambio 24h vía CoinGecko.
// - native: precio del token nativo de la red (ETH / BNB)
// - tokens: precio por contrato ERC-20 (solo redes mainnet indexadas por CoinGecko)
// Los testnets no están indexados → tokens = {} (esperado).
//
// Free tier público limita token_price a 1 contrato/petición → hacemos una
// petición por contrato. Si defines COINGECKO_API_KEY (demo key gratuita),
// se batchea en una sola llamada y sube el rate-limit.

const CG = 'https://api.coingecko.com/api/v3'

const PLATFORM: Record<string, string> = {
  '1': 'ethereum',
  '42161': 'arbitrum-one',
  '8453': 'base',
  '56': 'binance-smart-chain',
}

const NATIVE_ID: Record<string, string> = {
  '1': 'ethereum', '42161': 'ethereum', '8453': 'ethereum',
  '56': 'binancecoin', '421614': 'ethereum',
}

type Price = { usd: number; change24h: number }

const API_KEY = process.env.COINGECKO_API_KEY
const headers: Record<string, string> = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}
const fetchOpts = { headers, next: { revalidate: 60 } } as const

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const chainId = searchParams.get('chainId') ?? '421614'
  const contracts = (searchParams.get('contracts') ?? '')
    .split(',').map(c => c.trim().toLowerCase()).filter(Boolean)

  const nativeId = NATIVE_ID[chainId] ?? 'ethereum'
  const platform = PLATFORM[chainId]

  const result: { native: Price; tokens: Record<string, Price> } = {
    native: { usd: 0, change24h: 0 },
    tokens: {},
  }

  try {
    // Precio nativo
    const nativeRes = await fetch(
      `${CG}/simple/price?ids=${nativeId}&vs_currencies=usd&include_24hr_change=true`,
      fetchOpts
    )
    if (nativeRes.ok) {
      const d = await nativeRes.json()
      const n = d?.[nativeId]
      if (n) result.native = { usd: n.usd ?? 0, change24h: n.usd_24h_change ?? 0 }
    }

    if (platform && contracts.length > 0) {
      if (API_KEY) {
        // Demo/Pro: batch permitido
        const res = await fetch(
          `${CG}/simple/token_price/${platform}?contract_addresses=${contracts.join(',')}&vs_currencies=usd&include_24hr_change=true`,
          fetchOpts
        )
        if (res.ok) {
          const d = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>
          for (const [addr, p] of Object.entries(d)) {
            result.tokens[addr.toLowerCase()] = { usd: p.usd ?? 0, change24h: p.usd_24h_change ?? 0 }
          }
        }
      } else {
        // Free tier: 1 contrato por petición
        await Promise.all(contracts.map(async (addr) => {
          try {
            const res = await fetch(
              `${CG}/simple/token_price/${platform}?contract_addresses=${addr}&vs_currencies=usd&include_24hr_change=true`,
              fetchOpts
            )
            if (!res.ok) return
            const d = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>
            const p = d[addr]
            if (p) result.tokens[addr] = { usd: p.usd ?? 0, change24h: p.usd_24h_change ?? 0 }
          } catch { /* ignore single token */ }
        }))
      }
    }
  } catch {
    // devolver lo que haya
  }

  return NextResponse.json(result)
}
