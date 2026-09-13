import { NextRequest, NextResponse } from 'next/server'
import { CG_PLATFORM, CG_NATIVE_ID, MAX_PRICE_CONTRACTS, type TokenPrices } from '@/lib/coingecko'
import { safeChainId, safeAddress } from '@/lib/apiGuard'

// Precios USD + cambio 24h vía CoinGecko.
// - native: precio del token nativo de la red (ETH / BNB / POL)
// - tokens: precio por contrato ERC-20 (solo redes mainnet indexadas por CoinGecko)
// Los testnets no están indexados → tokens = {} (esperado).
//
// Free tier público limita token_price a 1 contrato/petición → hacemos una
// petición por contrato. Si defines COINGECKO_API_KEY (demo key gratuita),
// se batchea en una sola llamada y sube el rate-limit.

const CG = 'https://api.coingecko.com/api/v3'
const DEFAULT_CHAIN_ID = '421614'

const API_KEY = process.env.COINGECKO_API_KEY
const headers: Record<string, string> = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}
const fetchOpts = { headers, next: { revalidate: 60 } } as const

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const result: TokenPrices = {
    native: { usd: 0, change24h: 0 },
    tokens: {},
  }

  // safeChainId antes de buscar en las tablas: `CG_NATIVE_ID['constructor']` es
  // una función, no un hueco, y acababa escrita en la URL.
  const chainId = safeChainId(searchParams.get('chainId'), DEFAULT_CHAIN_ID)
  if (!chainId) return NextResponse.json({ ...result, error: 'BAD_CHAIN' }, { status: 400 })

  // Solo direcciones bien formadas, sin repetir y como mucho MAX_PRICE_CONTRACTS.
  // Sin clave cada contrato es una petición saliente: sin tope, una petición
  // entrante con mil direcciones abría mil contra CoinGecko. Lo que sobra se
  // descarta; la app pide en tandas (fetchTokenPrices) y no llega a verlo.
  const contracts = [...new Set(
    (searchParams.get('contracts') ?? '')
      .split(',')
      .map(c => safeAddress(c.trim()))
      .filter((c): c is string => c !== null)
  )].slice(0, MAX_PRICE_CONTRACTS)

  const nativeId = CG_NATIVE_ID[chainId]
  const platform = CG_PLATFORM[chainId]

  try {
    // Precio nativo. Sin id conocido no se pide nada: se devuelve 0, que la
    // interfaz ya sabe pintar como «sin precio».
    const nativeRes = nativeId ? await fetch(
      `${CG}/simple/price?ids=${nativeId}&vs_currencies=usd&include_24hr_change=true`,
      fetchOpts
    ) : null
    if (nativeId && nativeRes?.ok) {
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
