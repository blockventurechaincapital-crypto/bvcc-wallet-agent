import { createPublicClient, decodeEventLog, pad, parseAbiItem, toEventSelector, type Address, type AbiEvent, type Hex } from 'viem'
import { BVCC_WALLET_FACTORY_ABI, BVCC_AGENT_WALLET_FACTORY_ABI } from './abis'
import type { NetworkConfig } from './networks'
import { rpcTransport } from './rpc'

function mkClient(network: NetworkConfig) {
  return createPublicClient({
    chain: network.viemChain,
    transport: rpcTransport(network),
  })
}

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf',
  type: 'function',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
}] as const

// Calcula la address de la wallet SIN desplegarla (gratis, sin gas)
export async function getWalletAddress(
  pubKeyX: bigint,
  pubKeyY: bigint,
  network: NetworkConfig,
): Promise<`0x${string}`> {
  if (!network.contracts.factory) throw new Error('Factory not deployed on this network')
  return mkClient(network).readContract({
    address: network.contracts.factory,
    abi: BVCC_WALLET_FACTORY_ABI,
    functionName: 'getWalletAddress',
    args: [pubKeyX, pubKeyY],
  })
}

// Calcula la address de la agent wallet SIN desplegarla
export async function getAgentWalletAddress(
  pubKeyX: bigint,
  pubKeyY: bigint,
  network: NetworkConfig,
): Promise<`0x${string}`> {
  if (!network.contracts.agentFactory) throw new Error('AgentFactory not deployed on this network')
  return mkClient(network).readContract({
    address: network.contracts.agentFactory,
    abi: BVCC_AGENT_WALLET_FACTORY_ABI,
    functionName: 'getWalletAddress',
    args: [pubKeyX, pubKeyY],
  })
}

// Comprueba si la wallet ya esta desplegada
export async function isWalletDeployed(
  address: `0x${string}`,
  network: NetworkConfig,
): Promise<boolean> {
  if (!network.contracts.factory) return false
  return mkClient(network).readContract({
    address: network.contracts.factory,
    abi: BVCC_WALLET_FACTORY_ABI,
    functionName: 'isDeployed',
    args: [address],
  })
}

// Obtiene el saldo ETH de la wallet
export async function getEthBalance(
  address: `0x${string}`,
  network: NetworkConfig,
): Promise<bigint> {
  return mkClient(network).getBalance({ address })
}

// Obtiene el saldo USDC
export async function getUsdcBalance(
  address: `0x${string}`,
  network: NetworkConfig,
): Promise<bigint> {
  if (!network.tokens.usdc) return 0n
  return mkClient(network).readContract({
    address: network.tokens.usdc,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address],
  })
}

// Recupera el credentialId de la chain consultando el evento WalletCreated de la factory
/**
 * Superseded factories, kept only so pre-V4 wallets can still be looked up. Same CREATE2
 * address on every network, except the V1 pair which only ever existed on Arb Sepolia —
 * querying them elsewhere simply returns no logs.
 */
const LEGACY_FACTORIES: Array<{ address: Address; eventName: 'WalletCreated' | 'AgentWalletCreated' }> = [
  { address: '0xD42F61AA856A4f47885Ecd2D0ce119411d53C192', eventName: 'WalletCreated' },      // V3
  { address: '0xd866a7563cDaC9F71423be3332b62c329C676064', eventName: 'AgentWalletCreated' }, // V3
  { address: '0x230b7010529AB6977Dd8581B3eF018ef865BdEf1', eventName: 'WalletCreated' },      // V2
  { address: '0x8D9e24022777173AD6336e00884b6C87c7EF054c', eventName: 'AgentWalletCreated' }, // V2
  { address: '0xa5290A51a73903176e09C864E1542a07da67BD12', eventName: 'WalletCreated' },      // V1
  { address: '0xc87aa10747A92B472EF6B36e190B84c897a2953e', eventName: 'AgentWalletCreated' }, // V1
]

/** Contract bytes (the raw credential id) back to the base64url text the app uses. */
function bytesToBase64url(hex: `0x${string}`): string {
  const bytes = hex.slice(2).match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []
  const bin = String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type ChainCredential =
  | {
      credentialId: string
      /**
       * True only when it comes from the wallet's own CredentialSet event, which nothing but a
       * passkey-signed call can emit. The legacy factory event carries whatever the account that
       * deployed the wallet wrote, so a credential from there is a claim to verify against the
       * signer, never an id to filter the passkey prompt by.
       */
      authenticated: boolean
      unreadable?: undefined
    }
  | {
      /**
       * The logs could not be read, which is NOT the same as "there is none". Most public RPCs
       * refuse eth_getLogs from block 0 and the explorer's free plan leaves some networks out, so
       * a failed read used to come back as null and the wallet was entered as if it had no
       * credential. The caller confirms the passkey against the signer instead, which needs no logs.
       */
      credentialId: null
      authenticated: false
      unreadable: true
    }

export async function getCredentialIdFromChain(
  walletAddress: Address,
  network: NetworkConfig,
): Promise<string | null> {
  return (await getCredentialFromChain(walletAddress, network))?.credentialId ?? null
}

const CREDENTIAL_SET = parseAbiItem('event CredentialSet(bytes32 indexed credentialHash, bytes credentialId)')
const WALLET_CREATED = parseAbiItem('event WalletCreated(address indexed wallet, uint256 pubKeyX, uint256 pubKeyY, string credentialId)')
const AGENT_WALLET_CREATED = parseAbiItem('event AgentWalletCreated(address indexed wallet, uint256 pubKeyX, uint256 pubKeyY, string credentialId)')

type RawLog = { address: string; topics: Hex[]; data: Hex }

/**
 * Every log from block 0 matching one of `topic0s` (and `topic1`, if given) emitted by one of
 * `addresses`, oldest first — or null when neither source could answer.
 *
 * The RPC goes first: on Arbitrum it serves the whole range. Elsewhere it refuses (measured
 * 2026-09-13: Base caps the range at 2,000 blocks, Polygon at 10,000, BSC and the publicnode
 * endpoints refuse outright), and splitting the range is not an option — hundreds of requests per
 * wallet on Base or BSC. So the fallback is the explorer through `/api/logs`, which has no range
 * limit but also does not cover every network on its free plan. Results from it are filtered by
 * emitter here, because a query without `address` returns the event from ANY contract.
 */
async function logsFromGenesis(
  network: NetworkConfig,
  filter: { addresses: Address[]; topic0s: Hex[]; topic1?: Hex },
): Promise<RawLog[] | null> {
  const { addresses, topic0s, topic1 } = filter
  try {
    return await mkClient(network).request({
      method: 'eth_getLogs',
      params: [{
        address: addresses,
        topics: topic1 ? [topic0s, topic1] : [topic0s],
        fromBlock: '0x0',
        toBlock: 'latest',
      }],
    }) as RawLog[]
  } catch { /* fall back to the explorer */ }

  const emitters = new Set(addresses.map((a) => a.toLowerCase()))
  const out: RawLog[] = []
  // One topic0 per request, one after another: the explorer key allows 3 calls a second.
  for (const topic0 of topic0s) {
    try {
      const q = new URLSearchParams({ chainId: String(network.chainId), topic0 })
      if (addresses.length === 1) q.set('address', addresses[0])
      if (topic1) q.set('topic1', topic1)
      const res = await fetch(`/api/logs?${q}`)
      const d = await res.json() as { error?: string; result?: RawLog[] }
      if (d.error || !Array.isArray(d.result)) return null
      out.push(...d.result.filter((l) => emitters.has(l.address.toLowerCase())))
    } catch {
      return null
    }
  }
  return out
}

function decodeCredential(log: RawLog, event: AbiEvent): string | null {
  try {
    const { args } = decodeEventLog({ abi: [event], data: log.data, topics: log.topics as [Hex, ...Hex[]] })
    const id = (args as { credentialId?: string }).credentialId
    return id || null
  } catch {
    return null
  }
}

export async function getCredentialFromChain(
  walletAddress: Address,
  network: NetworkConfig,
): Promise<ChainCredential | null> {
  // V4 first: the wallet announces its own credential in CredentialSet, emitted inside
  // the passkey-signed call that sets the guardians. That event is authentic — only the
  // owner can cause it — whereas the factory event below could be published by whoever
  // won the deployment race. The most recent one wins, since setCredentialId can rotate
  // it (e.g. after a guardian recovery swapped the signer).
  const own = await logsFromGenesis(network, {
    addresses: [walletAddress],
    topic0s: [toEventSelector(CREDENTIAL_SET)],
  })
  for (const log of [...(own ?? [])].reverse()) {
    const raw = decodeCredential(log, CREDENTIAL_SET) as Hex | null
    if (raw) return { credentialId: bytesToBase64url(raw), authenticated: true }
  }

  // Pre-V4 wallets only have the factory event, where the credential travelled as a
  // string and was never authenticated. A wallet is made by the standard factory
  // (WalletCreated) or the agent factory (AgentWalletCreated), current or superseded:
  // without the superseded ones a user coming back on a fresh device would lose the
  // direct passkey selection on their old wallet. Only one factory can have made a
  // given address, and the list order is kept as the tie-break it always was.
  const factories: Address[] = [
    ...(network.contracts.factory ? [network.contracts.factory] : []),
    ...(network.contracts.agentFactory ? [network.contracts.agentFactory] : []),
    ...LEGACY_FACTORIES.map((f) => f.address),
  ]
  const legacy = await logsFromGenesis(network, {
    addresses: factories,
    topic0s: [toEventSelector(WALLET_CREATED), toEventSelector(AGENT_WALLET_CREATED)],
    topic1: pad(walletAddress.toLowerCase() as Hex, { size: 32 }),
  })
  for (const factory of factories) {
    const log = (legacy ?? []).find((l) => l.address.toLowerCase() === factory.toLowerCase())
    if (!log) continue
    const id = decodeCredential(log, WALLET_CREATED) ?? decodeCredential(log, AGENT_WALLET_CREATED)
    if (id) return { credentialId: id, authenticated: false }
  }

  if (own === null || legacy === null) return { credentialId: null, authenticated: false, unreadable: true }
  return null
}

// Despliega la wallet via BVCCWalletFactory (requiere un signer externo)
export async function deployWallet(
  pubKeyX: bigint,
  pubKeyY: bigint,
  network: NetworkConfig,
): Promise<`0x${string}`> {
  return getWalletAddress(pubKeyX, pubKeyY, network)
}

// Formatea bigint de ETH (18 decimales) a string legible
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

// Formatea bigint de USDC (6 decimales) a string legible
export function formatUsdc(amount: bigint): string {
  const usdc = Number(amount) / 1e6
  return usdc.toFixed(2)
}
