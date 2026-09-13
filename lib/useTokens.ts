'use client'
import { useQuery, useQueries } from '@tanstack/react-query'
import { createPublicClient, http, formatUnits, getAddress, type Address } from 'viem'
import type { NetworkConfig } from './networks'
import type { DiscoveredToken } from '@/app/api/tokens/route'
import { CG_NATIVE_ID } from './coingecko'

export type WalletToken = {
  key: string                 // '<chainId>:native' | '<chainId>:<contract>'
  isNative: boolean
  address: string | null      // contract (null si nativo)
  symbol: string
  name: string
  decimals: number
  balance: bigint
  balanceFormatted: string
  usdPrice: number
  change24h: number
  usdValue: number
  logo: string
  cgId?: string               // coingecko id (nativo) — para la gráfica
  network: NetworkConfig      // red a la que pertenece este token
  /** El símbolo lo escribió un tercero y no es de fiar tal cual (lib/tokenMeta).
   *  Los nativos y el USDC configurado nunca lo llevan: esos los ponemos aquí. */
  suspicious?: boolean
}

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

// ⚠️ Las tres tablas de aquí abajo NO llevan valor por defecto, y es a propósito.
// Antes caían todas a Ethereum, y Polygon no estaba en ninguna: el POL salía
// llamándose «Ethereum», con el logo de ETH y con el precio de ETH. Un hueco que
// se tapa con el nativo de otra red no se nota nunca; un hueco que se ve, sí.
// ⚠️ Tienen que ser URLs de `assets.coingecko.com`, que es el host que está en
// `img-src` (next.config.ts). La API de CoinGecko devuelve hoy las suyas en
// `coin-images.coingecko.com`: copiar de ahí "para usar la buena" deja el logo
// sin cargar, y sin más síntoma que un círculo con la inicial.
const NATIVE_LOGO: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  POL: 'https://assets.coingecko.com/coins/images/32440/small/polygon.png',
}

const NATIVE_NAME: Record<string, string> = {
  ETH: 'Ethereum',
  BNB: 'BNB',
  POL: 'Polygon',
}

// chainId → carpeta de trustwallet/assets (logos por contrato)
const TW_FOLDER: Record<number, string> = {
  1: 'ethereum', 42161: 'arbitrum', 8453: 'base', 56: 'smartchain',
}

export function tokenLogo(network: NetworkConfig, contract: string): string {
  const folder = TW_FOLDER[network.chainId]
  if (!folder) return ''
  try {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${folder}/assets/${getAddress(contract as Address)}/logo.png`
  } catch {
    return ''
  }
}

export async function fetchTokens(address: string, network: NetworkConfig): Promise<{ tokens: WalletToken[]; totalUsd: number }> {
  const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
  const cid = String(network.chainId)

  // 1. Descubrir tokens (Etherscan V2) + mergear USDC configurado
  let discovered: DiscoveredToken[] = []
  try {
    const res = await fetch(`/api/tokens?address=${address}&chainId=${cid}`)
    const data = await res.json()
    discovered = (data.tokens as DiscoveredToken[]) ?? []
  } catch { /* sin descubrimiento */ }

  if (network.tokens.usdc) {
    const usdcLower = network.tokens.usdc.toLowerCase()
    if (!discovered.some(t => t.address === usdcLower)) {
      discovered.push({ address: usdcLower, symbol: 'USDC', name: 'USD Coin', decimals: 6 })
    }
  }

  // 2. Leer balances on-chain en paralelo
  const [nativeBalance, ...erc20Balances] = await Promise.all([
    client.getBalance({ address: address as Address }),
    ...discovered.map(t =>
      client.readContract({
        address: t.address as Address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [address as Address],
      }).catch(() => 0n)
    ),
  ])

  // 3. Filtrar ERC-20 con balance > 0
  const heldErc20 = discovered
    .map((t, i) => ({ ...t, balance: erc20Balances[i] as bigint }))
    .filter(t => t.balance > 0n)

  // 4. Precios
  let nativePrice = { usd: 0, change24h: 0 }
  const tokenPrices: Record<string, { usd: number; change24h: number }> = {}
  try {
    const contracts = heldErc20.map(t => t.address).join(',')
    const pres = await fetch(`/api/token-prices?chainId=${cid}&contracts=${contracts}`)
    const pdata = await pres.json()
    nativePrice = pdata.native ?? nativePrice
    Object.assign(tokenPrices, pdata.tokens ?? {})
  } catch { /* sin precios */ }

  // 5. Construir lista enriquecida
  const nativeSym = network.nativeToken.symbol
  const nativeFmt = formatUnits(nativeBalance, network.nativeToken.decimals)
  const tokens: WalletToken[] = [{
    key: `${network.chainId}:native`,
    isNative: true,
    address: null,
    symbol: nativeSym,
    // Sin nombre conocido se usa el símbolo, que es dato de la red y no una
    // suposición.
    name: NATIVE_NAME[nativeSym] ?? nativeSym,
    decimals: network.nativeToken.decimals,
    balance: nativeBalance,
    balanceFormatted: nativeFmt,
    usdPrice: nativePrice.usd,
    change24h: nativePrice.change24h,
    usdValue: parseFloat(nativeFmt) * nativePrice.usd,
    // Sin logo, `TokenIcon` pinta el círculo con la inicial: mejor eso que el
    // logo de otra moneda.
    logo: NATIVE_LOGO[nativeSym] ?? '',
    cgId: CG_NATIVE_ID[String(network.chainId)],
    network,
  }]

  for (const t of heldErc20) {
    const fmt = formatUnits(t.balance, t.decimals)
    const price = tokenPrices[t.address] ?? { usd: t.symbol === 'USDC' ? 1 : 0, change24h: 0 }
    tokens.push({
      key: `${network.chainId}:${t.address}`,
      isNative: false,
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: t.balance,
      balanceFormatted: fmt,
      usdPrice: price.usd,
      change24h: price.change24h,
      usdValue: parseFloat(fmt) * price.usd,
      logo: tokenLogo(network, t.address),
      network,
      ...(t.suspicious ? { suspicious: true } : {}),
    })
  }

  // 6. Ordenar: nativo primero, resto por valor USD desc
  const [nat, ...rest] = tokens
  rest.sort((a, b) => b.usdValue - a.usdValue)
  const ordered = [nat, ...rest]
  const totalUsd = ordered.reduce((s, t) => s + t.usdValue, 0)

  return { tokens: ordered, totalUsd }
}

export function useTokens(address: string | null, network: NetworkConfig) {
  return useQuery({
    queryKey: ['tokens', address, network.chainId],
    queryFn: () => fetchTokens(address!, network),
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })
}

// Multi-chain: lee tokens de varias redes en paralelo y agrega en una sola lista.
// - Los nativos con balance 0 se ocultan (evita ruido de N cadenas vacías).
// - Total $ = suma cross-chain.
// - Cada token conserva su `network` para badge + acción (send/swap en su cadena).
export function useMultiChainTokens(address: string | null, networks: NetworkConfig[]) {
  const results = useQueries({
    queries: networks.map(n => ({
      queryKey: ['tokens', address, n.chainId],
      queryFn: () => fetchTokens(address!, n),
      enabled: !!address,
      staleTime: 10_000,
      refetchInterval: 20_000,
    })),
  })

  const anyLoading = results.some(r => r.isLoading)
  const allError = results.length > 0 && results.every(r => r.isError)

  const merged: WalletToken[] = []
  let totalUsd = 0
  for (const r of results) {
    if (!r.data) continue
    for (const tk of r.data.tokens) {
      if (tk.isNative && tk.balance === 0n) continue
      merged.push(tk)
    }
    totalUsd += r.data.totalUsd
  }

  // Orden: tokens con valor primero, por valor USD desc; resto (sin precio) detrás
  merged.sort((a, b) => {
    if ((b.usdValue > 0 ? 1 : 0) !== (a.usdValue > 0 ? 1 : 0)) {
      return (b.usdValue > 0 ? 1 : 0) - (a.usdValue > 0 ? 1 : 0)
    }
    return b.usdValue - a.usdValue
  })

  return {
    tokens: merged,
    totalUsd,
    isLoading: anyLoading && merged.length === 0,
    isFetching: results.some(r => r.isFetching),
    isError: allError,
  }
}
