import { createPublicClient, http, type Address, type AbiEvent } from 'viem'
import { BVCC_WALLET_FACTORY_ABI, BVCC_AGENT_WALLET_FACTORY_ABI } from './abis'
import type { NetworkConfig } from './networks'

function mkClient(network: NetworkConfig) {
  return createPublicClient({
    chain: network.viemChain,
    transport: http(network.rpcUrl),
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

export async function getCredentialIdFromChain(
  walletAddress: Address,
  network: NetworkConfig,
): Promise<string | null> {
  // A wallet may have been created by either the standard factory (emits
  // WalletCreated) or the agent factory (emits AgentWalletCreated). Both events
  // share the same signature, so query each factory and return whichever matches.
  const sources: Array<{ factory: Address; eventName: 'WalletCreated' | 'AgentWalletCreated' }> = []
  if (network.contracts.factory)      sources.push({ factory: network.contracts.factory,      eventName: 'WalletCreated' })
  if (network.contracts.agentFactory) sources.push({ factory: network.contracts.agentFactory, eventName: 'AgentWalletCreated' })
  // Wallets created before V4 have their credential in the event of the factory that made
  // them, and that factory is no longer the configured one. Without these, a user coming
  // back on a fresh device would lose the direct passkey selection on their old wallet.
  for (const f of LEGACY_FACTORIES) {
    sources.push({ factory: f.address, eventName: f.eventName })
  }

  const client = mkClient(network)

  // V4 first: the wallet announces its own credential in CredentialSet, emitted inside
  // the passkey-signed call that sets the guardians. That event is authentic — only the
  // owner can cause it — whereas the factory event below could be published by whoever
  // won the deployment race. The most recent one wins, since setCredentialId can rotate
  // it (e.g. after a guardian recovery swapped the signer).
  try {
    const logs = await client.getLogs({
      address: walletAddress,
      event: {
        type: 'event',
        name: 'CredentialSet',
        inputs: [
          { name: 'credentialHash', type: 'bytes32', indexed: true },
          { name: 'credentialId',   type: 'bytes',   indexed: false },
        ],
      } as AbiEvent,
      fromBlock: 0n,
      toBlock: 'latest',
    })
    if (logs.length > 0) {
      const raw = (logs[logs.length - 1].args as { credentialId?: `0x${string}` }).credentialId
      if (raw) return bytesToBase64url(raw)
    }
  } catch {
    // fall through to the legacy factory event
  }

  // Pre-V4 wallets only have the factory event, where the credential travelled as a
  // string and was never authenticated. Kept for wallets created before the migration.
  for (const { factory, eventName } of sources) {
    try {
      const logs = await client.getLogs({
        address: factory,
        event: {
          type: 'event',
          name: eventName,
          inputs: [
            { name: 'wallet',       type: 'address', indexed: true },
            { name: 'pubKeyX',      type: 'uint256', indexed: false },
            { name: 'pubKeyY',      type: 'uint256', indexed: false },
            { name: 'credentialId', type: 'string',  indexed: false },
          ],
        } as AbiEvent,
        args: { wallet: walletAddress },
        fromBlock: 0n,
        toBlock: 'latest',
      })
      if (logs.length > 0) {
        const args = logs[0].args as { credentialId?: string }
        return args.credentialId ?? null
      }
    } catch {
      // try next source
    }
  }
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
