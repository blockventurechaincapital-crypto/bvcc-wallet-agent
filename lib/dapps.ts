// ─── Shared dApp registry ────────────────────────────────────────────────────
// Single source of truth for the curated BVCC dApp list. Imported by the
// frontend grid (app/wallet/dapps/page.tsx) AND the iframe-check API route
// (app/api/check-iframe/route.ts), so the backend only ever inspects URLs that
// belong to a predefined dApp. Users cannot add arbitrary dApp URLs.

export type Category =
  | 'All'
  | 'DEX'
  | 'Lending'
  | 'Bridge'
  | 'Yield'
  | 'NFT'
  | 'Prediction'
  | 'Tools'

export interface DApp {
  id: string
  name: string
  desc: string
  url: string
  color: string
  logo: string
  category: Exclude<Category, 'All'>
  chains: number[]
}

export const DAPPS: DApp[] = [
  // DEX
  { id: 'uniswap', name: 'Uniswap', desc: 'El mayor DEX descentralizado. Intercambia tokens con liquidez profunda.', url: 'https://app.uniswap.org', color: '#FF007A', logo: 'https://icons.llama.fi/uniswap.png', category: 'DEX', chains: [1, 8453, 42161] },
  { id: '1inch', name: '1inch', desc: 'Agregador DEX. Encuentra el mejor precio entre múltiples exchanges.', url: 'https://app.1inch.io', color: '#1B4F8A', logo: 'https://icons.llama.fi/1inch.png', category: 'DEX', chains: [1, 8453, 42161, 56] },
  { id: 'curve', name: 'Curve Finance', desc: 'DEX especializado en stablecoins y activos correlacionados.', url: 'https://curve.fi', color: '#F7D66A', logo: 'https://icons.llama.fi/curve.png', category: 'DEX', chains: [1, 8453, 42161] },
  { id: 'balancer', name: 'Balancer', desc: 'AMM flexible con pools personalizados de múltiples tokens.', url: 'https://app.balancer.fi', color: '#1E3A5F', logo: 'https://icons.llama.fi/balancer.png', category: 'DEX', chains: [1, 8453, 42161] },
  // Lending
  { id: 'aave', name: 'Aave', desc: 'Protocolo de lending y borrowing descentralizado líder.', url: 'https://app.aave.com', color: '#B6509E', logo: 'https://icons.llama.fi/aave-v3.png', category: 'Lending', chains: [1, 8453, 42161] },
  { id: 'compound', name: 'Compound', desc: 'Protocolo de tipo de interés algorítmico para DeFi.', url: 'https://app.compound.finance', color: '#00D395', logo: 'https://icons.llama.fi/compound-v3.png', category: 'Lending', chains: [1, 8453] },
  { id: 'morpho', name: 'Morpho', desc: 'Optimizador de lending P2P sobre Aave y Compound.', url: 'https://app.morpho.org', color: '#3B5BDB', logo: 'https://icons.llama.fi/morpho.png', category: 'Lending', chains: [1, 8453] },
  // Bridge
  { id: 'stargate', name: 'Stargate Finance', desc: 'Bridge omnichain con liquidez unificada entre redes.', url: 'https://stargate.finance', color: '#9333EA', logo: 'https://icons.llama.fi/stargate.png', category: 'Bridge', chains: [1, 8453, 42161, 56] },
  { id: 'hop', name: 'Hop Protocol', desc: 'Bridge rápido entre L2s y Ethereum mainnet.', url: 'https://app.hop.exchange', color: '#E17C49', logo: 'https://icons.llama.fi/hop-protocol.png', category: 'Bridge', chains: [1, 8453, 42161] },
  { id: 'across', name: 'Across Protocol', desc: 'El bridge más rápido y barato para ETH y tokens ERC-20.', url: 'https://across.to', color: '#6E41E2', logo: 'https://icons.llama.fi/across.png', category: 'Bridge', chains: [1, 8453, 42161] },
  // Yield
  { id: 'lido', name: 'Lido', desc: 'Staking líquido de ETH. Gana recompensas sin lockup.', url: 'https://stake.lido.fi', color: '#00A3FF', logo: 'https://icons.llama.fi/lido.png', category: 'Yield', chains: [1] },
  { id: 'yearn', name: 'Yearn Finance', desc: 'Optimizador de yield automatizado para DeFi.', url: 'https://yearn.fi', color: '#006AE3', logo: 'https://icons.llama.fi/yearn-finance.png', category: 'Yield', chains: [1, 42161] },
  { id: 'eigenlayer', name: 'EigenLayer', desc: 'Restaking de ETH para asegurar otros protocolos.', url: 'https://app.eigenlayer.xyz', color: '#7C3AED', logo: 'https://icons.llama.fi/eigenlayer.png', category: 'Yield', chains: [1] },
  // NFT
  { id: 'opensea', name: 'OpenSea', desc: 'El mayor marketplace de NFTs del ecosistema Web3.', url: 'https://opensea.io', color: '#2081E2', logo: 'https://icons.llama.fi/opensea.png', category: 'NFT', chains: [1, 8453, 42161] },
  { id: 'blur', name: 'Blur', desc: 'Marketplace NFT profesional con herramientas avanzadas.', url: 'https://blur.io', color: '#FF6320', logo: 'https://icons.llama.fi/blur.png', category: 'NFT', chains: [1] },
  // Tools
  { id: 'zapper', name: 'Zapper', desc: 'Dashboard de portfolio DeFi. Visualiza todos tus activos.', url: 'https://zapper.xyz', color: '#784FFD', logo: 'https://icons.llama.fi/zapper.png', category: 'Tools', chains: [1, 8453, 42161] },
  { id: 'debank', name: 'DeBank', desc: 'Rastrea tu portfolio DeFi en múltiples chains.', url: 'https://debank.com', color: '#FF6B35', logo: 'https://icons.llama.fi/debank.png', category: 'Tools', chains: [1, 8453, 42161, 56] },
  { id: 'bvcc-analytics', name: 'BVCC Analytics', desc: 'Dashboard de analytics del hook BVCC en tiempo real.', url: 'https://analytics.blockventurechaincapital.com', color: '#D4AF37', logo: '/bvcc_wallet.png', category: 'Tools', chains: [1, 8453, 42161, 56] },
  // Prediction
  { id: 'polymarket', name: 'Polymarket', desc: 'El mayor mercado de predicciones descentralizado. Apuesta sobre eventos del mundo real.', url: 'https://polymarket.com', color: '#1652F0', logo: 'https://icons.llama.fi/polymarket.jpg', category: 'Prediction', chains: [137] },
]

// Hostnames derived from the curated list — the ONLY hosts the backend will
// touch. Stored lowercased for case-insensitive comparison.
export const DAPP_HOSTNAMES: ReadonlySet<string> = new Set(
  DAPPS.map((d) => new URL(d.url).hostname.toLowerCase()),
)

// Defense-in-depth: reject hosts that point at the local machine or internal
// networks even if one ever slipped into the allowlist. All curated dApps are
// public DNS names, so these should never match — they exist to make SSRF
// impossible by construction.
function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()

  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true

  // IPv6 loopback / unspecified / link-local / unique-local
  if (h === '::1' || h === '::' || h === '[::1]' || h === '[::]') return true
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true

  // IPv4 literals
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 0) return true                          // 0.0.0.0/8
    if (a === 10) return true                         // 10.0.0.0/8 private
    if (a === 127) return true                        // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true           // 169.254.0.0/16 link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true           // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  }

  return false
}

/**
 * Validate an incoming iframe-check URL against the curated dApp allowlist.
 * Returns the parsed URL only when it is safe to fetch server-side:
 *   - parses as a valid absolute URL
 *   - uses https (all curated dApps are https)
 *   - hostname is in DAPP_HOSTNAMES
 *   - hostname is not an internal/loopback/metadata target
 * Otherwise returns null and the caller should respond { allowed: false }.
 */
export function resolveAllowedDAppUrl(raw: string): URL | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  // External dApps must be https. (http: is intentionally rejected here.)
  if (parsed.protocol !== 'https:') return null

  const host = parsed.hostname.toLowerCase()
  if (isInternalHost(host)) return null
  if (!DAPP_HOSTNAMES.has(host)) return null

  return parsed
}
