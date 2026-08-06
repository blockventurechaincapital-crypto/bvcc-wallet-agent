import { NextRequest, NextResponse } from 'next/server'
import { safeChainId, safeAddress, safeInt } from '@/lib/apiGuard'

export type TxItem = {
  hash: string
  from: string
  to: string
  value: string
  tokenSymbol: string
  tokenDecimal: number
  timestamp: number
  isError: boolean
  type: 'eth' | 'token'
  logIndex: string   // unique within a tx — distinguishes multiple token transfers in one hash
}

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'
const DEFAULT_CHAIN_ID = '421614' // Arbitrum Sepolia fallback

export async function GET(req: NextRequest) {
  const apiKey = process.env.ARBISCAN_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'NO_API_KEY', items: [] })
  }

  const { searchParams } = req.nextUrl
  // Validated before they reach the Etherscan URL — see lib/apiGuard.
  const address = safeAddress(searchParams.get('address'))
  const page = safeInt(searchParams.get('page'), 1, 100)
  const offset = safeInt(searchParams.get('offset'), 20, 200)
  const chainId = safeChainId(searchParams.get('chainId'), DEFAULT_CHAIN_ID)

  if (!address) {
    return NextResponse.json({ error: 'NO_ADDRESS', items: [] })
  }
  if (!chainId) {
    return NextResponse.json({ error: 'BAD_CHAIN', items: [] })
  }

  const commonParams = `chainid=${chainId}&address=${address}&sort=desc&page=${page}&offset=${offset}&apikey=${apiKey}`

  const [ethRes, tokenRes] = await Promise.all([
    fetch(`${ETHERSCAN_V2}?module=account&action=txlist&${commonParams}`),
    fetch(`${ETHERSCAN_V2}?module=account&action=tokentx&${commonParams}`),
  ])

  const [ethData, tokenData] = await Promise.all([
    ethRes.json(),
    tokenRes.json(),
  ])

  const ethItems: TxItem[] = (ethData.result && Array.isArray(ethData.result))
    ? ethData.result.map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        tokenSymbol: 'ETH',
        tokenDecimal: 18,
        timestamp: parseInt(tx.timeStamp, 10),
        isError: tx.isError === '1',
        type: 'eth' as const,
        logIndex: 'tx',
      }))
    : []

  const tokenItems: TxItem[] = (tokenData.result && Array.isArray(tokenData.result))
    ? tokenData.result.map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        tokenSymbol: tx.tokenSymbol,
        tokenDecimal: parseInt(tx.tokenDecimal, 10),
        timestamp: parseInt(tx.timeStamp, 10),
        isError: false,
        type: 'token' as const,
        logIndex: tx.logIndex ?? '',
      }))
    : []

  // A single tx (e.g. a UserOp send) can emit MULTIPLE token transfers — the
  // actual transfer + the BVCC fee — all sharing one hash. Keep every token
  // transfer; only drop the redundant normal-tx (txlist) entry when that same
  // hash already produced token transfers (it's the contract-call wrapper, not
  // a distinct value movement).
  const tokenHashes = new Set(tokenItems.map(t => t.hash))
  const merged: TxItem[] = [...tokenItems]
  for (const e of ethItems) {
    if (!tokenHashes.has(e.hash)) merged.push(e)
  }

  merged.sort((a, b) => b.timestamp - a.timestamp)

  return NextResponse.json({ items: merged })
}
