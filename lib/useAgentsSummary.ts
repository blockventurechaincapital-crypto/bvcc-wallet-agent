'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
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
}

export type AgentBudgetKind = 'period' | 'daily' | 'total' | 'unlimited'

export type AgentSummary = {
  address: Address
  alias?: string
  active: boolean
  kind: AgentBudgetKind
  remainingWei: bigint   // presupuesto disponible
  limitWei: bigint       // 0 si unlimited
}

export type AgentsSummary = {
  total: number
  paused: boolean
  agents: AgentSummary[]
}

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

  // aliases locales (mismo storage que la página de agentes)
  let aliases: Record<string, string> = {}
  try {
    const raw = localStorage.getItem(`bvcc_agent_aliases_${address.toLowerCase()}`)
    aliases = raw ? JSON.parse(raw) : {}
  } catch { /* ignore */ }

  const agents: AgentSummary[] = await Promise.all(agentAddrs.map(async (a) => {
    const [perm, dailySpent] = await Promise.all([
      client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getAgentPermission', args: [a] }) as Promise<Perm>,
      client.readContract({ address: addr, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getDailySpent', args: [a] }).catch(() => 0n) as Promise<bigint>,
    ])

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

    return { address: a, alias: aliases[a.toLowerCase()], active: perm.active, kind, remainingWei, limitWei }
  }))

  return { total: agentAddrs.length, paused, agents }
}

export function useAgentsSummary(address: string | null, network: NetworkConfig, enabled = true) {
  return useQuery({
    queryKey: ['agentsSummary', address, network.chainId],
    queryFn: () => fetchAgents(address!, network),
    enabled: enabled && !!address,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}
