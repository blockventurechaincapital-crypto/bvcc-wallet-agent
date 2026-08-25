'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, getAddress, type Address, type Hex } from 'viem'
import { useNetwork } from './NetworkContext'
import { TOPIC } from './defiContracts'
import { isUnlimited } from './allowanceLimits'

export type Allowance = {
  kind: 'erc20' | 'nft'
  token: Address          // contrato del token/colección
  spender: Address        // a quién se le aprobó
  symbol: string
  decimals: number
  amount: bigint          // allowance actual on-chain (erc20). nft: 1 = aprobado
  unlimited: boolean
}

const ERC20 = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'isApprovedForAll', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const pad32 = (a: string): Hex => ('0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0')) as Hex
const fromTopic = (t: string): Address => getAddress('0x' + t.slice(-40))

async function fetchLogs(chainId: number, topic0: string, owner: string): Promise<{ address: string; topics: string[]; data: string }[]> {
  const res = await fetch(`/api/logs?chainId=${chainId}&topic0=${topic0}&topic1=${pad32(owner)}`)
  const json = await res.json().catch(() => ({ result: [] }))
  return Array.isArray(json.result) ? json.result : []
}

export function useAllowances(owner: string | null) {
  const { network } = useNetwork()
  const [items, setItems] = useState<Allowance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!owner) return
    setLoading(true)
    setError(null)
    try {
      const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
      const [erc20Logs, nftLogs] = await Promise.all([
        fetchLogs(network.chainId, TOPIC.approval, owner),
        fetchLogs(network.chainId, TOPIC.approvalForAll, owner),
      ])

      // Dedupe a pares únicos (token, spender) — nos quedamos con la última versión.
      const erc20Pairs = new Map<string, { token: Address; spender: Address }>()
      for (const l of erc20Logs) {
        const token = getAddress(l.address)
        const spender = fromTopic(l.topics[2])
        erc20Pairs.set(`${token}-${spender}`, { token, spender })
      }
      const nftPairs = new Map<string, { token: Address; spender: Address }>()
      for (const l of nftLogs) {
        const token = getAddress(l.address)
        const spender = fromTopic(l.topics[2])
        nftPairs.set(`${token}-${spender}`, { token, spender })
      }

      const out: Allowance[] = []

      // ERC-20: leer allowance actual + symbol/decimals. Filtrar las >0.
      await Promise.all([...erc20Pairs.values()].map(async ({ token, spender }) => {
        try {
          const amount = await client.readContract({ address: token, abi: ERC20, functionName: 'allowance', args: [owner as Address, spender] }) as bigint
          if (amount === 0n) return
          let symbol = `${token.slice(0, 6)}…`, decimals = 18
          try { symbol = await client.readContract({ address: token, abi: ERC20, functionName: 'symbol' }) as string } catch { /* token raro */ }
          try { decimals = Number(await client.readContract({ address: token, abi: ERC20, functionName: 'decimals' })) } catch { /* default 18 */ }
          out.push({ kind: 'erc20', token, spender, symbol, decimals, amount, unlimited: isUnlimited(amount) })
        } catch { /* token ilegible → omitir */ }
      }))

      // NFT (ApprovalForAll): leer isApprovedForAll actual. Solo los que siguen true.
      await Promise.all([...nftPairs.values()].map(async ({ token, spender }) => {
        try {
          const ok = await client.readContract({ address: token, abi: ERC20, functionName: 'isApprovedForAll', args: [owner as Address, spender] }) as boolean
          if (!ok) return
          let symbol = `${token.slice(0, 6)}…`
          try { symbol = await client.readContract({ address: token, abi: ERC20, functionName: 'symbol' }) as string } catch { /* colección sin symbol */ }
          out.push({ kind: 'nft', token, spender, symbol, decimals: 0, amount: 1n, unlimited: true })
        } catch { /* omitir */ }
      }))

      // Ilimitadas/NFT primero (más riesgo), luego por símbolo.
      out.sort((a, b) => Number(b.unlimited) - Number(a.unlimited) || a.symbol.localeCompare(b.symbol))
      setItems(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando allowances')
    } finally {
      setLoading(false)
    }
  }, [owner, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  return { items, loading, error, reload: load }
}
