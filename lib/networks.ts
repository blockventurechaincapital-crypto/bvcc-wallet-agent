import type { Chain } from 'viem'
import { arbitrumSepolia, base, arbitrum, mainnet, bsc } from 'viem/chains'

export type NetworkConfig = {
  chainId: number
  name: string        // 'Arbitrum Sepolia'
  shortName: string   // 'Arb Sepolia'
  color: string       // hex color for dot
  logo: string        // chain logo URL
  isTestnet: boolean
  rpcUrl: string
  blockExplorer: {
    url: string
    apiUrl: string     // Etherscan v2 API base
    apiChainId: string // chainid param
  }
  nativeToken: {
    symbol: string
    decimals: number
  }
  contracts: {
    factory: `0x${string}` | null      // null = not deployed yet
    agentFactory: `0x${string}` | null // null = not deployed yet
    entryPoint: `0x${string}`
  }
  tokens: {
    usdc: `0x${string}` | null
    usdcDecimals: number   // USDC suele ser 6, pero en BNB Chain (Binance-Peg) es 18
    weth: `0x${string}`
  }
  uniswap: {
    swapRouter: `0x${string}`
    quoterV2: `0x${string}`
    poolFee: number        // fee por defecto/preferido; el swap igualmente prueba todos los tiers
    feeTiers?: number[]     // tiers candidatos para elegir el mejor pool (default: estándar v3)
  } | null
  viemChain: Chain
}

const ENTRYPOINT = '0x433709009B8330FDa32311DF1C2AFA402eD8D009' as `0x${string}`

export const NETWORKS: NetworkConfig[] = [
  // ── Testnets ────────────────────────────────────────────────────────────
  {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    color: '#7B61FF',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    isTestnet: true,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: {
      url: 'https://sepolia.arbiscan.io',
      apiUrl: 'https://api.etherscan.io/v2/api',
      apiChainId: '421614',
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
    contracts: {
      factory: '0x230b7010529AB6977Dd8581B3eF018ef865BdEf1',
      agentFactory: '0x8D9e24022777173AD6336e00884b6C87c7EF054c',
      entryPoint: ENTRYPOINT,
    },
    tokens: {
      usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      usdcDecimals: 6,
      weth: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    },
    uniswap: {
      swapRouter: '0x101F443B4d1b059569D643917553c771E1b9663E',
      quoterV2: '0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B',
      poolFee: 3000,
    },
    viemChain: arbitrumSepolia,
  },
  // ── Mainnets ────────────────────────────────────────────────────────────
  {
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    color: '#0052FF',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    isTestnet: false,
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: {
      url: 'https://basescan.org',
      apiUrl: 'https://api.etherscan.io/v2/api',
      apiChainId: '8453',
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
    contracts: {
      factory: null,
      agentFactory: null,
      entryPoint: ENTRYPOINT,
    },
    tokens: {
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      usdcDecimals: 6,
      weth: '0x4200000000000000000000000000000000000006',
    },
    uniswap: {
      swapRouter: '0x2626664c2603336E57B271c5C0b26F421741e481',
      quoterV2: '0x3d4e44Eb1374240CE5F1B136359E4E2Af754cCdB',
      poolFee: 500,
    },
    viemChain: base,
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    color: '#28A0F0',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    isTestnet: false,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: {
      url: 'https://arbiscan.io',
      apiUrl: 'https://api.etherscan.io/v2/api',
      apiChainId: '42161',
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
    contracts: {
      factory: '0x230b7010529AB6977Dd8581B3eF018ef865BdEf1',
      agentFactory: '0x8D9e24022777173AD6336e00884b6C87c7EF054c',
      entryPoint: ENTRYPOINT,
    },
    tokens: {
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      usdcDecimals: 6,
      weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
    uniswap: {
      swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      poolFee: 500,
    },
    viemChain: arbitrum,
  },
  {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    color: '#627EEA',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    isTestnet: false,
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: {
      url: 'https://etherscan.io',
      apiUrl: 'https://api.etherscan.io/v2/api',
      apiChainId: '1',
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
    contracts: {
      factory: '0x230b7010529AB6977Dd8581B3eF018ef865BdEf1',
      agentFactory: '0x8D9e24022777173AD6336e00884b6C87c7EF054c',
      entryPoint: ENTRYPOINT,
    },
    tokens: {
      usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      usdcDecimals: 6,
      weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    uniswap: {
      swapRouter: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      poolFee: 500,
    },
    viemChain: mainnet,
  },
  {
    chainId: 56,
    name: 'BNB Chain',
    shortName: 'BNB',
    color: '#F3BA2F',
    logo: 'https://icons.llamao.fi/icons/chains/rsz_bsc.jpg',
    isTestnet: false,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: {
      url: 'https://bscscan.com',
      apiUrl: 'https://api.etherscan.io/v2/api',
      apiChainId: '56',
    },
    nativeToken: { symbol: 'BNB', decimals: 18 },
    contracts: {
      factory: '0x230b7010529AB6977Dd8581B3eF018ef865BdEf1',
      agentFactory: '0x8D9e24022777173AD6336e00884b6C87c7EF054c',
      entryPoint: ENTRYPOINT,
    },
    tokens: {
      usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // Binance-Peg USDC (18 decimales)
      usdcDecimals: 18,
      weth: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (wrapped del nativo BNB)
    },
    // Uniswap v3 en BNB Chain — direcciones oficiales (docs.uniswap.org)
    uniswap: {
      swapRouter: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2', // SwapRouter02
      quoterV2: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
      poolFee: 500, // tier preferido; el swap prueba todos los tiers y elige el mejor
    },
    viemChain: bsc,
  },
]

export const NETWORKS_BY_CHAIN_ID: Record<number, NetworkConfig> = Object.fromEntries(
  NETWORKS.map(n => [n.chainId, n])
)

export function getNetwork(chainId: number): NetworkConfig {
  const n = NETWORKS_BY_CHAIN_ID[chainId]
  if (!n) throw new Error(`Unknown network chainId: ${chainId}`)
  return n
}

export const DEFAULT_NETWORK = NETWORKS[0] // Arbitrum Sepolia
