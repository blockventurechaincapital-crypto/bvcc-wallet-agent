import { NextRequest, NextResponse } from 'next/server'
import { safeChainId, safeAddress } from '@/lib/apiGuard'

// Descubre los tokens ERC-20 que una wallet ha tocado alguna vez, vía
// Etherscan V2 (multichain con una sola key). Solo metadata — el balance
// real se lee on-chain en el cliente y se filtra > 0.

export type DiscoveredToken = {
  address: string      // contract address (lowercase)
  symbol: string
  name: string
  decimals: number
}

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'
const DEFAULT_CHAIN_ID = '421614'

export async function GET(req: NextRequest) {
  const apiKey = process.env.ARBISCAN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'NO_API_KEY', tokens: [] })
  }

  const { searchParams } = req.nextUrl
  // Validated before they reach the Etherscan URL — see lib/apiGuard.
  const address = safeAddress(searchParams.get('address'))
  const chainId = safeChainId(searchParams.get('chainId'), DEFAULT_CHAIN_ID)

  if (!address) {
    return NextResponse.json({ error: 'NO_ADDRESS', tokens: [] })
  }
  if (!chainId) {
    return NextResponse.json({ error: 'BAD_CHAIN', tokens: [] })
  }

  const url = `${ETHERSCAN_V2}?module=account&action=tokentx&chainid=${chainId}&address=${address}&sort=desc&page=1&offset=2000&apikey=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 30 } })
    const data = await res.json()

    if (!data.result || !Array.isArray(data.result)) {
      return NextResponse.json({ tokens: [] })
    }

    const seen = new Map<string, DiscoveredToken>()
    for (const tx of data.result as Record<string, string>[]) {
      const addr = (tx.contractAddress ?? '').toLowerCase()
      if (!addr || seen.has(addr)) continue
      const decimals = parseInt(tx.tokenDecimal, 10)
      if (Number.isNaN(decimals)) continue
      seen.set(addr, {
        address: addr,
        symbol: tx.tokenSymbol || '???',
        name: tx.tokenName || tx.tokenSymbol || 'Unknown',
        decimals,
      })
    }

    return NextResponse.json({ tokens: Array.from(seen.values()) })
  } catch (e) {
    return NextResponse.json({ error: String(e), tokens: [] })
  }
}
