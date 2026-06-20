'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, getAddress, formatUnits, type Address } from 'viem'
import { BVCC_AGENT_WALLET_ABI } from './abis'
import type { NetworkConfig } from './networks'

type Perm = {
  dailyLimitWei: bigint
  totalBudgetWei: bigint
  totalSpentWei: bigint
  periodBudgetWei: bigint
  periodSpentWei: bigint
  periodDuration: bigint
  active: boolean
  allowedTokens: readonly Address[]
  tokenTotalBudgets: readonly bigint[]
}

export type AgentBudgetKind = 'period' | 'daily' | 'total' | 'unlimited'

export type AgentTokenSpend = {
  token: Address
  symbol: string
  decimals: number
  spent: bigint
  limit: bigint    // 0 = ilimitado
}

export type AgentSummary = {
  address: Address
  alias?: string
  active: boolean
  kind: AgentBudgetKind
  remainingWei: bigint   // presupuesto ETH disponible
  limitWei: bigint       // 0 si unlimited
  remainingUsd?: number  // valor en USD del restante
  lastActivity?: number  // unix segundos del último tx del agente
  tokens: AgentTokenSpend[]
}

export type AgentsSummary = {
  total: number
  paused: boolean
  agents: AgentSummary[]
}

const ERC20_META = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

function clamp(a: bigint, b: bigint): bigint {
  return a > b ? a - b : 0n
}

async function fetchAgents(address: string, network: NetworkConfig): Promise<AgentsSummary> {
  const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
  const addr = address as Address

  const agentAddrs = await client.readContract({
    address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getAgents', args: [],
  }) as Address[]

  let paused = false
  try {
    paused = await client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'paused', args: [] }) as boolean
  } catch { /* wallets antiguos sin Pausable */ }

  // Precio nativo (USD) — una sola petición para todo el resumen.
  let nativeUsd = 0
  try {
    const res = await fetch(`/api/token-prices?chainId=${network.chainId}`)
    const d = await res.json()
    nativeUsd = d?.native?.usd ?? 0
  } catch { /* sin precio → sin USD */ }

  // Alias locales (mismo storage que la página de agentes)
  let aliases: Record<string, string> = {}
  try {
    const raw = localStorage.getItem(`bvcc_agent_aliases_${address.toLowerCase()}`)
    aliases = raw ? JSON.parse(raw) : {}
  } catch { /* ignore */ }

  // Cache de símbolos/decimales (compartida entre agentes)
  const meta = new Map<string, { symbol: string; decimals: number }>()
  const resolve = async (token: Address): Promise<{ symbol: string; decimals: number }> => {
    const k = token.toLowerCase()
    if (meta.has(k)) return meta.get(k)!
    let symbol = `${token.slice(0, 6)}…`, decimals = 18
    try { symbol = await client.readContract({ address: getAddress(token), abi: ERC20_META, functionName: 'symbol' }) as string } catch { /* sin symbol */ }
    try { decimals = Number(await client.readContract({ address: getAddress(token), abi: ERC20_META, functionName: 'decimals' })) } catch { /* default 18 */ }
    const v = { symbol, decimals }
    meta.set(k, v)
    return v
  }

  const agents: AgentSummary[] = await Promise.all(agentAddrs.map(async (a) => {
    const [perm, dailySpent] = await Promise.all([
      client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getAgentPermission', args: [a] }) as Promise<Perm>,
      client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getDailySpent', args: [a] }).catch(() => 0n) as Promise<bigint>,
    ])

    // Presupuesto ETH (prioridad: período > diario > total)
    let kind: AgentBudgetKind = 'unlimited'
    let remainingWei = 0n
    let limitWei = 0n
    if (perm.periodBudgetWei > 0n && perm.periodDuration > 0n) {
      kind = 'period'; limitWei = perm.periodBudgetWei; remainingWei = clamp(perm.periodBudgetWei, perm.periodSpentWei)
    } else if (perm.dailyLimitWei > 0n) {
      kind = 'daily'; limitWei = perm.dailyLimitWei; remainingWei = clamp(perm.dailyLimitWei, dailySpent)
    } else if (perm.totalBudgetWei > 0n) {
      kind = 'total'; limitWei = perm.totalBudgetWei; remainingWei = clamp(perm.totalBudgetWei, perm.totalSpentWei)
    }
    const remainingUsd = nativeUsd > 0 ? Number(formatUnits(remainingWei, 18)) * nativeUsd : undefined

    // Gasto por token (allowedTokens con su gasto total + presupuesto)
    const allowed = perm.allowedTokens ?? []
    const budgets = perm.tokenTotalBudgets ?? []
    const tokens: AgentTokenSpend[] = await Promise.all(allowed.map(async (token, i) => {
      const [spentPair, m] = await Promise.all([
        client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getTokenSpent', args: [a, token] }).catch(() => [0n, 0n] as const) as Promise<readonly [bigint, bigint]>,
        resolve(token),
      ])
      return { token, symbol: m.symbol, decimals: m.decimals, spent: spentPair[1], limit: budgets[i] ?? 0n }
    }))

    // Última actividad: último tx del agente (EOA) vía el indexer del explorer
    let lastActivity: number | undefined
    try {
      const res = await fetch(`/api/transactions?address=${a}&chainId=${network.chainId}&page=1&offset=1`)
      const d = await res.json()
      const ts = d?.items?.[0]?.timestamp
      if (typeof ts === 'number' && ts > 0) lastActivity = ts
    } catch { /* sin actividad */ }

    return { address: a, alias: aliases[a.toLowerCase()], active: perm.active, kind, remainingWei, limitWei, remainingUsd, lastActivity, tokens }
  }))

  return { total: agentAddrs.length, paused, agents }
}

export function useAgentsSummary(address: string | null, network: NetworkConfig, enabled = true) {
  return useQuery({
    queryKey: ['agentsSummary', address, network.chainId],
    queryFn: () => fetchAgents(address!, network),
    enabled: enabled && !!address,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })
}
