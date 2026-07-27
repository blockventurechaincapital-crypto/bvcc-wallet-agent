/**
 * Agent capabilities — intent → config bundle (local test, Arbitrum only).
 *
 * The agent authorize form used to ask for raw addresses across three lists, with
 * no hint that the lists depend on each other (Universal Router needs Permit2,
 * native swaps need WETH in two lists, Aave needs the Pool as a recipient…). This
 * module inverts that: the user picks *what the agent should be able to do*, and
 * we derive the protocols, required tokens and recipients that entails. The call
 * policies themselves still come from `callPolicies.ts` keyed by these protocols —
 * this only groups the addresses.
 *
 * The "Case 2b" recipient rule is the easy-to-miss one: every swap approves its
 * router on the ERC-20 first, and `approve` is a Case-2b call gated by
 * `allowedRecipients`. So a swap's router must also be a recipient (when the
 * whitelist is active), not only a protocol.
 */
import { getAddress, type Address } from 'viem'

export type CapabilityId =
  | 'swap'
  | 'swapNative'
  | 'swapV4'
  | 'provideLiquidityV3'
  | 'provideLiquidityV4'
  | 'aaveLend'
  | 'aaveUnwind'

/** Stable order for the picker. */
export const CAPABILITY_ORDER: CapabilityId[] = [
  'swap',
  'swapNative',
  'swapV4',
  'provideLiquidityV3',
  'provideLiquidityV4',
  'aaveLend',
  'aaveUnwind',
]

interface ChainAddrs {
  swapRouter02: Address
  weth: Address
  universalRouter: Address
  permit2: Address
  aavePool: Address
  /** Uniswap v3 NonfungiblePositionManager (LP). */
  nfpm: Address
  /** Uniswap v4 PositionManager (LP) — only on chains with v4 deployed. */
  positionManagerV4?: Address
}

// Canonical, checksummed. Same addresses the callPolicies presets are keyed on
// (lowercased there) — both reference the same contracts, so they stay aligned.
const ADDRS: Record<number, ChainAddrs> = {
  42161: {
    swapRouter02: getAddress('0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'),
    weth: getAddress('0x82af49447d8a07e3bd95bd0d56f35241523fbab1'),
    universalRouter: getAddress('0xa51afafe0263b40edaef0df8781ea9aa03e381a3'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0x794a61358d6845594f94dc1db02a252b5b4814ad'),
    nfpm: getAddress('0xc36442b4a4522e871399cd717abdd847ab11fe88'),
    positionManagerV4: getAddress('0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869'),
  },
  1: {
    swapRouter02: getAddress('0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'),
    weth: getAddress('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    universalRouter: getAddress('0x66a9893cc07d91d95644aedd05d03f95e1dba8af'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'),
    nfpm: getAddress('0xc36442b4a4522e871399cd717abdd847ab11fe88'),
    positionManagerV4: getAddress('0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e'),
  },
  56: {
    swapRouter02: getAddress('0xb971ef87ede563556b2ed4b1c0b0019111dd85d2'),
    weth: getAddress('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'),
    universalRouter: getAddress('0x1906c1d672b88cd1b9ac7593301ca990f94eae07'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0x6807dc923806fe8fd134338eabca509979a7e0cb'),
    nfpm: getAddress('0x7b8a01b39d58278b5de7e48c8449c9f4f5170613'),
    positionManagerV4: getAddress('0x7A4a5c919aE2541AeD11041A1AEeE68f1287f95b'),
  },
  137: {
    swapRouter02: getAddress('0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'),
    weth: getAddress('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'),
    universalRouter: getAddress('0x1095692a6237d83c6a72f3f5efedb9a670c49223'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0x794a61358d6845594f94dc1db02a252b5b4814ad'),
    nfpm: getAddress('0xc36442b4a4522e871399cd717abdd847ab11fe88'),
    positionManagerV4: getAddress('0x1Ec2eBf4F37E7363FDfe3551602425af0B3ceef9'),
  },
  8453: {
    swapRouter02: getAddress('0x2626664c2603336e57b271c5c0b26f421741e481'),
    weth: getAddress('0x4200000000000000000000000000000000000006'),
    universalRouter: getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0xa238dd80c259a72e81d7e4664a9801593f98d1c5'),
    nfpm: getAddress('0x03a520b32c04bf3beef7beb72e919cf822ed34f1'),
    positionManagerV4: getAddress('0x7C5f5A4bBd8fD63184577525326123B519429bDc'),
  },
  421614: {
    swapRouter02: getAddress('0x101f443b4d1b059569d643917553c771e1b9663e'),
    weth: getAddress('0x980b62da83eff3d4576c647993b0c1d7faf17c73'),
    universalRouter: getAddress('0xefd1d4bd4cf1e86da286bb4cb1b8bced9c10ba47'),
    permit2: getAddress('0x000000000022d473030f116ddee9f6b43ac78ba3'),
    aavePool: getAddress('0xbfc91d59fdaa134a4ed45f7b584caf96d7792eff'),
    nfpm: getAddress('0x6b2937bde17889edcf8fbd8de31c3c2a70bc4d65'),
    positionManagerV4: getAddress('0xAc631556d3d4019C95769033B5E719dD77124BAc'),
  },
}

export interface CapabilityBundle {
  id: CapabilityId
  /** Added to allowedProtocols (and drive the call policies via callPolicies presets). */
  protocols: Address[]
  /** Added to allowedTokens — e.g. WETH for native swaps. */
  requiredTokens: Address[]
  /** Added to allowedRecipients *only if the destination whitelist is active*. */
  recipients: Address[]
}

// Partial: some capabilities exist only where the chain has the contract (v4 LP
// needs a v4 PositionManager, absent on Polygon/Arb-Sepolia).
function bundlesFor(chainId: number): Partial<Record<CapabilityId, CapabilityBundle>> | null {
  const a = ADDRS[chainId]
  if (!a) return null
  const bundles: Partial<Record<CapabilityId, CapabilityBundle>> = {
    swap: {
      id: 'swap',
      protocols: [a.swapRouter02],
      requiredTokens: [],
      recipients: [a.swapRouter02], // approve(SwapRouter02) is Case 2b
    },
    swapNative: {
      id: 'swapNative',
      protocols: [a.swapRouter02, a.weth], // WETH has its own deposit/withdraw policies
      requiredTokens: [a.weth], // and must be an allowed token for the swap's approve
      recipients: [a.swapRouter02],
    },
    swapV4: {
      id: 'swapV4',
      protocols: [a.universalRouter, a.permit2],
      requiredTokens: [],
      recipients: [a.permit2], // approve(Permit2) is Case 2b; the UR is reached via Permit2
    },
    provideLiquidityV3: {
      id: 'provideLiquidityV3',
      protocols: [a.nfpm], // NFPM policies (mint/collect pinned, decrease/burn) come from the preset
      // The pair tokens are the user's choice — they add them to allowedTokens
      // themselves, so nothing is forced here (leaving it empty avoids implying a pair).
      requiredTokens: [],
      recipients: [a.nfpm], // mint approves BOTH tokens to the NFPM — Case 2b
    },
    aaveLend: {
      id: 'aaveLend',
      protocols: [a.aavePool],
      requiredTokens: [],
      recipients: [a.aavePool], // approve(Pool) on supply/repay is Case 2b
    },
    aaveUnwind: {
      id: 'aaveUnwind',
      protocols: [a.aavePool, a.swapRouter02], // planners swap collateral via SwapRouter02
      requiredTokens: [],
      recipients: [a.aavePool, a.swapRouter02],
    },
  }
  if (a.positionManagerV4) {
    bundles.provideLiquidityV4 = {
      id: 'provideLiquidityV4',
      // DEEP policy on modifyLiquidities comes from the preset; Permit2 funds ERC-20
      // sides (native pools use msg.value). Inert until the PM validator is active.
      protocols: [a.positionManagerV4, a.permit2],
      requiredTokens: [],
      recipients: [a.permit2], // approve(Permit2) on each ERC-20 side is Case 2b
    }
  }
  return bundles
}

/** Capability ids offered on a chain — only those whose contracts exist there. */
export function agentCapabilitiesFor(chainId: number): CapabilityId[] {
  const b = bundlesFor(chainId)
  if (!b) return []
  return CAPABILITY_ORDER.filter((id) => b[id] != null)
}

export function capabilityBundle(chainId: number, id: CapabilityId): CapabilityBundle | null {
  return bundlesFor(chainId)?.[id] ?? null
}

export interface ComposedConfig {
  protocols: Address[]
  requiredTokens: Address[]
  recipients: Address[]
}

function dedupe(xs: Address[]): Address[] {
  const seen = new Set<string>()
  const out: Address[] = []
  for (const x of xs) {
    const k = x.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(x)
    }
  }
  return out
}

/** Merge the bundles of the selected capabilities into one deduped config. */
export function composeFromCapabilities(chainId: number, selected: CapabilityId[]): ComposedConfig {
  const b = bundlesFor(chainId)
  if (!b) return { protocols: [], requiredTokens: [], recipients: [] }
  const protocols: Address[] = []
  const requiredTokens: Address[] = []
  const recipients: Address[] = []
  for (const id of selected) {
    const bundle = b[id]
    if (!bundle) continue
    protocols.push(...bundle.protocols)
    requiredTokens.push(...bundle.requiredTokens)
    recipients.push(...bundle.recipients)
  }
  return { protocols: dedupe(protocols), requiredTokens: dedupe(requiredTokens), recipients: dedupe(recipients) }
}

/**
 * Which capabilities a set of whitelisted protocols already covers.
 * Used to pre-select the picker when editing, and to describe an agent's card.
 */
export function capabilitiesFromProtocols(chainId: number, protocols: Address[]): CapabilityId[] {
  const b = bundlesFor(chainId)
  if (!b) return []
  const have = new Set(protocols.map((p) => p.toLowerCase()))
  return CAPABILITY_ORDER.filter((id) => {
    const bundle = b[id]
    return bundle != null && bundle.protocols.every((p) => have.has(p.toLowerCase()))
  })
}

/** Reverse lookup: which selected capabilities pulled in a given address (for "added by" labels). */
export function capabilitiesForAddress(chainId: number, selected: CapabilityId[], address: string): CapabilityId[] {
  const b = bundlesFor(chainId)
  if (!b) return []
  const k = address.toLowerCase()
  return selected.filter((id) => {
    const bundle = b[id]
    return (
      bundle != null &&
      (bundle.protocols.some((p) => p.toLowerCase() === k) ||
        bundle.requiredTokens.some((t) => t.toLowerCase() === k) ||
        bundle.recipients.some((r) => r.toLowerCase() === k))
    )
  })
}
