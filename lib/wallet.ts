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

  const client = mkClient(network)
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
