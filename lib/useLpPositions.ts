'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, getAddress, keccak256, encodeAbiParameters, formatUnits, type Address, type Hex } from 'viem'
import { useNetwork } from './NetworkContext'
import { V3_NFPM, V4_PM, V3_FACTORY, V4_STATEVIEW, TOPIC } from './defiContracts'
import { amountsForLiquidity, feesFromGrowth, v3FeeGrowthInside } from './tickMath'

export type LpPosition = {
  version: 3 | 4
  tokenId: bigint
  token0: Address
  token1: Address
  symbol0: string
  symbol1: string
  amount0: bigint
  amount1: bigint
  decimals0: number
  decimals1: number
  fee: number
  inRange: boolean
  fees0: bigint   // comisiones sin cobrar (reclamables)
  fees1: bigint
  usd?: number      // valor total de la liquidez en USD
  usdFees?: number  // valor de las comisiones reclamables en USD
}

const ZERO = '0x0000000000000000000000000000000000000000'

const ERC20_META = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

const V3_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenOfOwnerByIndex', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'positions', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [
    { name: 'nonce', type: 'uint96' }, { name: 'operator', type: 'address' },
    { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' }, { name: 'fee', type: 'uint24' },
    { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }, { name: 'liquidity', type: 'uint128' },
    { name: 'feeGrowthInside0LastX128', type: 'uint256' }, { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    { name: 'tokensOwed0', type: 'uint128' }, { name: 'tokensOwed1', type: 'uint128' },
  ] },
] as const

const FACTORY_ABI = [
  { type: 'function', name: 'getPool', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }] },
] as const
const POOL_ABI = [
  { type: 'function', name: 'slot0', stateMutability: 'view', inputs: [], outputs: [
    { type: 'uint160' }, { type: 'int24' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint8' }, { type: 'bool' },
  ] },
  { type: 'function', name: 'feeGrowthGlobal0X128', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'feeGrowthGlobal1X128', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ticks', stateMutability: 'view', inputs: [{ type: 'int24' }], outputs: [
    { type: 'uint128' }, { type: 'int128' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'int56' }, { type: 'uint160' }, { type: 'uint32' }, { type: 'bool' },
  ] },
] as const

// Componentes del PoolKey v4 — se reusa en el ABI y para calcular el poolId.
const POOLKEY_COMPONENTS = [
  { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
] as const

const V4_ABI = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getPositionLiquidity', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
  { type: 'function', name: 'getPoolAndPositionInfo', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [
    { name: 'poolKey', type: 'tuple', components: POOLKEY_COMPONENTS },
    { name: 'info', type: 'uint256' },
  ] },
] as const
const STATEVIEW_ABI = [
  { type: 'function', name: 'getSlot0', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [
    { type: 'uint160' }, { type: 'int24' }, { type: 'uint24' }, { type: 'uint24' },
  ] },
  { type: 'function', name: 'getFeeGrowthInside', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'int24' }, { type: 'int24' }], outputs: [
    { type: 'uint256' }, { type: 'uint256' },
  ] },
  { type: 'function', name: 'getPositionInfo', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'int24' }, { type: 'int24' }, { type: 'bytes32' }], outputs: [
    { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' },
  ] },
] as const

type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }
type Client = ReturnType<typeof createPublicClient>
const pad32 = (a: string): Hex => ('0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0')) as Hex

// int24 con signo desde los 24 bits bajos de un bigint.
function toInt24(raw: bigint): number {
  const m = Number(raw & 0xffffffn)
  return m >= 0x800000 ? m - 0x1000000 : m
}

function makeResolver(client: Client, nativeSymbol: string) {
  const cache = new Map<string, { symbol: string; decimals: number }>()
  return async (addr: string): Promise<{ symbol: string; decimals: number }> => {
    const key = addr.toLowerCase()
    if (key === ZERO) return { symbol: nativeSymbol, decimals: 18 }   // v4: 0x0 = nativo
    if (cache.has(key)) return cache.get(key)!
    let symbol = `${addr.slice(0, 6)}…`, decimals = 18
    try { symbol = await client.readContract({ address: getAddress(addr), abi: ERC20_META, functionName: 'symbol' }) as string } catch { /* sin symbol */ }
    try { decimals = Number(await client.readContract({ address: getAddress(addr), abi: ERC20_META, functionName: 'decimals' })) } catch { /* default 18 */ }
    const v = { symbol, decimals }
    cache.set(key, v)
    return v
  }
}

export function useLpPositions(owner: string | null) {
  const { network } = useNetwork()
  const [items, setItems] = useState<LpPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!owner) return
    setLoading(true)
    setError(null)
    try {
      const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
      const resolve = makeResolver(client, network.nativeToken.symbol)
      const out: LpPosition[] = []

      // ── V3: NFPM enumerable + precio del pool vía el v3 Factory ──
      const nfpm = V3_NFPM[network.chainId]
      const factory = V3_FACTORY[network.chainId]
      if (nfpm && factory) {
        try {
          const bal = await client.readContract({ address: nfpm, abi: V3_ABI, functionName: 'balanceOf', args: [owner as Address] }) as bigint
          const ids = await Promise.all(
            Array.from({ length: Number(bal) }, (_, i) =>
              client.readContract({ address: nfpm, abi: V3_ABI, functionName: 'tokenOfOwnerByIndex', args: [owner as Address, BigInt(i)] }) as Promise<bigint>),
          )
          await Promise.all(ids.map(async (tokenId) => {
            const p = await client.readContract({ address: nfpm, abi: V3_ABI, functionName: 'positions', args: [tokenId] }) as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint]
            const token0 = p[2], token1 = p[3], fee = Number(p[4]), tickLower = Number(p[5]), tickUpper = Number(p[6]), liquidity = p[7]
            const fgInside0Last = p[8], fgInside1Last = p[9], owed0 = p[10], owed1 = p[11]
            if (liquidity === 0n && owed0 === 0n && owed1 === 0n) return
            let sqrtP = 0n, curTick = 0
            let fees0 = owed0, fees1 = owed1
            try {
              const pool = await client.readContract({ address: factory, abi: FACTORY_ABI, functionName: 'getPool', args: [token0, token1, fee] }) as Address
              const [s0, fg0, fg1, tl, tu] = await Promise.all([
                client.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' }) as Promise<readonly [bigint, number, number, number, number, number, boolean]>,
                client.readContract({ address: pool, abi: POOL_ABI, functionName: 'feeGrowthGlobal0X128' }) as Promise<bigint>,
                client.readContract({ address: pool, abi: POOL_ABI, functionName: 'feeGrowthGlobal1X128' }) as Promise<bigint>,
                client.readContract({ address: pool, abi: POOL_ABI, functionName: 'ticks', args: [tickLower] }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]>,
                client.readContract({ address: pool, abi: POOL_ABI, functionName: 'ticks', args: [tickUpper] }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]>,
              ])
              sqrtP = s0[0]; curTick = Number(s0[1])
              // feeGrowthOutside0/1 están en los índices 2/3 de ticks()
              const inside0 = v3FeeGrowthInside(fg0, curTick, tickLower, tickUpper, tl[2], tu[2])
              const inside1 = v3FeeGrowthInside(fg1, curTick, tickLower, tickUpper, tl[3], tu[3])
              fees0 = owed0 + feesFromGrowth(inside0, fgInside0Last, liquidity)
              fees1 = owed1 + feesFromGrowth(inside1, fgInside1Last, liquidity)
            } catch { return }
            const { amount0, amount1 } = amountsForLiquidity(sqrtP, tickLower, tickUpper, liquidity)
            const [m0, m1] = await Promise.all([resolve(token0), resolve(token1)])
            out.push({ version: 3, tokenId, token0, token1, symbol0: m0.symbol, symbol1: m1.symbol, amount0, amount1, decimals0: m0.decimals, decimals1: m1.decimals, fee, inRange: curTick >= tickLower && curTick < tickUpper, fees0, fees1 })
          }))
        } catch { /* NFPM ilegible → ignorar */ }
      }

      // ── V4: tokenIds vía logs Transfer→owner + precio vía StateView ──
      const v4 = V4_PM[network.chainId]
      const stateView = V4_STATEVIEW[network.chainId]
      if (v4) {
        try {
          const res = await fetch(`/api/logs?chainId=${network.chainId}&topic0=${TOPIC.transfer}&address=${v4}&topic2=${pad32(owner)}`)
          const json = await res.json().catch(() => ({ result: [] }))
          const logs: { topics: string[] }[] = Array.isArray(json.result) ? json.result : []
          const ids = [...new Set(logs.map((l) => BigInt(l.topics[3])).map(String))].map(BigInt)
          await Promise.all(ids.map(async (tokenId) => {
            try {
              const cur = await client.readContract({ address: v4, abi: V4_ABI, functionName: 'ownerOf', args: [tokenId] }) as Address
              if (cur.toLowerCase() !== owner.toLowerCase()) return
              const liq = await client.readContract({ address: v4, abi: V4_ABI, functionName: 'getPositionLiquidity', args: [tokenId] }) as bigint
              if (liq === 0n) return
              const poolInfo = await client.readContract({ address: v4, abi: V4_ABI, functionName: 'getPoolAndPositionInfo', args: [tokenId] }) as readonly [PoolKey, bigint]
              const pk = poolInfo[0], info = poolInfo[1]
              const tickLower = toInt24(info >> 8n), tickUpper = toInt24(info >> 32n)
              let amount0 = 0n, amount1 = 0n, inRange = false, fees0 = 0n, fees1 = 0n
              if (stateView) {
                try {
                  const poolId = keccak256(encodeAbiParameters([{ type: 'tuple', components: POOLKEY_COMPONENTS }], [pk]))
                  const salt = ('0x' + tokenId.toString(16).padStart(64, '0')) as Hex
                  const [s0, inside, posInfo] = await Promise.all([
                    client.readContract({ address: stateView, abi: STATEVIEW_ABI, functionName: 'getSlot0', args: [poolId] }) as Promise<readonly [bigint, number, number, number]>,
                    client.readContract({ address: stateView, abi: STATEVIEW_ABI, functionName: 'getFeeGrowthInside', args: [poolId, tickLower, tickUpper] }) as Promise<readonly [bigint, bigint]>,
                    client.readContract({ address: stateView, abi: STATEVIEW_ABI, functionName: 'getPositionInfo', args: [poolId, v4, tickLower, tickUpper, salt] }) as Promise<readonly [bigint, bigint, bigint]>,
                  ])
                  const sqrtP = s0[0], curTick = Number(s0[1])
                  const a = amountsForLiquidity(sqrtP, tickLower, tickUpper, liq)
                  amount0 = a.amount0; amount1 = a.amount1
                  inRange = curTick >= tickLower && curTick < tickUpper
                  // posInfo = [liquidity, feeGrowthInside0Last, feeGrowthInside1Last]
                  fees0 = feesFromGrowth(inside[0], posInfo[1], liq)
                  fees1 = feesFromGrowth(inside[1], posInfo[2], liq)
                } catch { /* sin precio/fees → 0 */ }
              }
              const [m0, m1] = await Promise.all([resolve(pk.currency0), resolve(pk.currency1)])
              out.push({ version: 4, tokenId, token0: pk.currency0, token1: pk.currency1, symbol0: m0.symbol, symbol1: m1.symbol, amount0, amount1, decimals0: m0.decimals, decimals1: m1.decimals, fee: Number(pk.fee), inRange, fees0, fees1 })
            } catch { /* tokenId quemado → omitir */ }
          }))
        } catch { /* sin explorer → sin v4 */ }
      }

      // ── Valor en USD: precios native + por contrato vía CoinGecko (/api/token-prices) ──
      if (out.length > 0) {
        const weth = network.tokens.weth.toLowerCase()
        const contracts = [...new Set(out.flatMap((p) => [p.token0, p.token1]).map((a) => a.toLowerCase()).filter((a) => a !== ZERO && a !== weth))]
        let native = 0
        const prices: Record<string, number> = {}
        try {
          const res = await fetch(`/api/token-prices?chainId=${network.chainId}&contracts=${contracts.join(',')}`)
          const d = await res.json()
          native = d?.native?.usd ?? 0
          for (const [a, p] of Object.entries((d?.tokens ?? {}) as Record<string, { usd?: number }>)) prices[a.toLowerCase()] = p.usd ?? 0
        } catch { /* sin precios → usd queda undefined */ }
        const priceFor = (addr: string): number => {
          const k = addr.toLowerCase()
          if (k === ZERO || k === weth) return native   // nativo y WETH ≈ precio del token nativo
          return prices[k] ?? 0
        }
        if (native > 0 || Object.keys(prices).length > 0) {
          for (const p of out) {
            const pr0 = priceFor(p.token0), pr1 = priceFor(p.token1)
            p.usd = Number(formatUnits(p.amount0, p.decimals0)) * pr0 + Number(formatUnits(p.amount1, p.decimals1)) * pr1
            p.usdFees = Number(formatUnits(p.fees0, p.decimals0)) * pr0 + Number(formatUnits(p.fees1, p.decimals1)) * pr1
          }
        }
      }

      out.sort((a, b) => a.version - b.version || Number(a.tokenId - b.tokenId))
      setItems(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando posiciones')
    } finally {
      setLoading(false)
    }
  }, [owner, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  return { items, loading, error, reload: load }
}
