import { NextRequest, NextResponse } from 'next/server'
import { safeChainId, safeAddress } from '@/lib/apiGuard'
import { decodeSourceTag, type SourceTag } from '@/lib/sourceTag'

/**
 * The source tag of an agent's last operation on a wallet.
 *
 * Reads the agent's most recent transactions (Etherscan v2 txlist), keeps the newest
 * one sent to this wallet and decodes the 8-byte tag at the end of its input. Returns
 * only the tool and version, never the input itself.
 *
 *   { status: 'tagged', tag, hash, timestamp }  — the last operation carries a tag
 *   { status: 'untagged', hash, timestamp }     — it carries none (pre-0.3.0 or own code)
 *   { status: 'none' }                          — no recent operation on this wallet
 */

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'
/** How many of the agent's latest transactions to look through for one sent to the wallet. */
const LOOKBACK = 10
const CACHE_MS = 60_000

type Result =
  | { status: 'tagged'; tag: SourceTag; hash: string; timestamp: number }
  | { status: 'untagged'; hash: string; timestamp: number }
  | { status: 'none' }

const cache = new Map<string, { at: number; result: Result }>()

export async function GET(req: NextRequest) {
  const apiKey = process.env.ARBISCAN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY' })

  const { searchParams } = req.nextUrl
  const chainId = safeChainId(searchParams.get('chainId'))
  const wallet = safeAddress(searchParams.get('wallet'))
  const agent = safeAddress(searchParams.get('agent'))
  if (!chainId || !wallet || !agent) return NextResponse.json({ error: 'BAD_PARAMS' })

  const key = `${chainId}:${wallet}:${agent}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.result)

  try {
    const url = `${ETHERSCAN_V2}?chainid=${chainId}&module=account&action=txlist&address=${agent}`
      + `&sort=desc&page=1&offset=${LOOKBACK}&apikey=${apiKey}`
    const data = await (await fetch(url)).json()
    // A rate-limit or key error also comes back as status 0: don't cache it as "none".
    if (!Array.isArray(data.result)) return NextResponse.json({ error: 'UPSTREAM' })
    const list: Record<string, string>[] = Array.isArray(data.result) ? data.result : []
    const last = list.find(tx => tx.from?.toLowerCase() === agent && tx.to?.toLowerCase() === wallet)

    let result: Result = { status: 'none' }
    if (last) {
      const tag = decodeSourceTag(last.input)
      const timestamp = parseInt(last.timeStamp, 10)
      result = tag
        ? { status: 'tagged', tag, hash: last.hash, timestamp }
        : { status: 'untagged', hash: last.hash, timestamp }
    }

    if (cache.size > 500) cache.clear()
    cache.set(key, { at: Date.now(), result })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'UPSTREAM' })
  }
}
