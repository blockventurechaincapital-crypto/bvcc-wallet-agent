import { NextRequest, NextResponse } from 'next/server'
import { CG_PLATFORM, CG_NATIVE_ID } from '@/lib/coingecko'
import { safeChainId, safeAddress } from '@/lib/apiGuard'

// Histórico de precio (USD) vía CoinGecko market_chart.
// Identifica el token por:
//   - id=<coingecko-id>            (token nativo: uno de los de CG_NATIVE_ID)
//   - chainId=<n>&contract=<addr>  (ERC-20 en red mainnet indexada)
// days = 1 | 7 | 30
// Testnets / tokens no indexados → points = [] (esperado).
//
// Nada de lo que manda el navegador entra en la URL sin pasar por una lista
// cerrada o por una forma estricta. `id` y `contract` van en la RUTA: sin
// validar, `id=x/../../simple/price?ids=…%23` llega a cualquier endpoint de la
// API con nuestra clave en la cabecera, y `days=1&x=y` añade parámetros. El host
// es fijo, así que no es SSRF: lo que se gasta es la cuota de la clave.

const CG = 'https://api.coingecko.com/api/v3'

const API_KEY = process.env.COINGECKO_API_KEY
const headers: Record<string, string> = API_KEY ? { 'x-cg-demo-api-key': API_KEY } : {}

const NATIVE_IDS = new Set(Object.values(CG_NATIVE_ID))
const DAYS = new Set(['1', '7', '30'])

// Mismo cuerpo que una respuesta sin datos, para que el cliente no se rompa.
const bad = (error: string) => NextResponse.json({ points: [], error }, { status: 400 })

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const id = searchParams.get('id')
  const days = searchParams.get('days') ?? '1'

  if (!DAYS.has(days)) return bad('BAD_DAYS')

  let url: string | null = null
  if (id !== null) {
    if (!NATIVE_IDS.has(id)) return bad('BAD_ID')
    url = `${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  } else {
    // safeChainId antes de buscar en la tabla: `CG_PLATFORM['constructor']` es
    // una función, no un hueco.
    const chainId = safeChainId(searchParams.get('chainId'))
    const contract = safeAddress(searchParams.get('contract'))
    if (!chainId) return bad('BAD_CHAIN')
    if (!contract) return bad('BAD_CONTRACT')
    const platform = CG_PLATFORM[chainId]
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
