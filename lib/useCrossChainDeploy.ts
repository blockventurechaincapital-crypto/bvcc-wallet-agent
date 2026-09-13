'use client'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type Address } from 'viem'
import { BVCC_WALLET_ABI, WALLET_TYPE_ABI } from './abis'
import { NETWORKS, type NetworkConfig } from './networks'
import { getCredentialFromChain, getWalletAddress, getAgentWalletAddress } from './wallet'
import { loadCredential } from './webauthn'

// Datos necesarios para recrear la wallet en otra red con la MISMA address:
// la address CREATE2 depende solo de (factory, pubKey), y las factories tienen
// la misma address en todas las redes, así que basta replicar la llamada
// createWallet con la pubkey original. Los guardianes de la red de origen se
// muestran; no viajan en createWallet.
export type DeploySeed = {
  pubKeyX: bigint
  pubKeyY: bigint
  /**
   * Only informative: createWallet takes the key alone. Null when this browser holds none for
   * the wallet and the chain does not vouch for one — which is common, since most public RPCs
   * refuse an eth_getLogs range from block 0 — and a missing credential must never hide a
   * network where the wallet does exist.
   */
  credentialId: string | null
  guardians: [Address, Address, Address]
  walletType: 0 | 1
  sourceName: string
  /**
   * Where createWallet on the target network would actually put a wallet for this key. The
   * factory derives the address from the key it is handed, and `signer()` is the CURRENT owner
   * key — so this matches the wallet only while that key is the one it was created with and the
   * factory is the same generation. After a guardian recovery, or for a pre-V4 wallet, it does
   * not, and deploying would create a different wallet. Null when it could not be read.
   */
  targetAddress: Address | null
}

/**
 * The address the target network's factory would give this key, or null if it cannot say.
 *
 * Retried with a pause, because a null blocks the deploy and the likeliest reason for one is not
 * a broken network: the dashboard fires dozens of reads at the same public RPC when a network is
 * opened, and mainnet.base.org answers the overflow with 429 for a few seconds.
 */
async function addressOnTarget(pubKeyX: bigint, pubKeyY: bigint, walletType: 0 | 1, target: NetworkConfig) {
  for (const pause of [0, 2000, 4000]) {
    if (pause) await new Promise(resolve => setTimeout(resolve, pause))
    try {
      return walletType === 1
        ? await getAgentWalletAddress(pubKeyX, pubKeyY, target)
        : await getWalletAddress(pubKeyX, pubKeyY, target)
    } catch { /* try again after the pause */ }
  }
  return null
}

/** The credential this browser stored for `address`, if any. A corrupt entry counts as none. */
function storedCredentialFor(address: Address): string | null {
  try {
    const stored = loadCredential()
    return stored?.walletAddress?.toLowerCase() === address.toLowerCase() ? stored.credentialId ?? null : null
  } catch {
    // loadCredential parses without a guard; letting it throw here would skip every network
    // in the loop below and report the wallet as deployed nowhere.
    return null
  }
}

async function fetchSeed(address: Address, target: NetworkConfig): Promise<DeploySeed | null> {
  // Prioriza redes del mismo tipo que la de destino (mainnet→mainnet, testnet→testnet)
  const candidates = NETWORKS
    .filter(n => n.chainId !== target.chainId && n.contracts.factory)
    .sort((a, b) =>
      Number(a.isTestnet !== target.isTestnet) - Number(b.isTestnet !== target.isTestnet)
    )

  for (const n of candidates) {
    try {
      const client = createPublicClient({ chain: n.viemChain, transport: http(n.rpcUrl) })
      const code = await client.getCode({ address })
      if (!code || code === '0x') continue

      const [signer, wType, g0, g1, g2] = await Promise.all([
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'signer' }),
        client.readContract({ address, abi: WALLET_TYPE_ABI, functionName: 'walletType' }).catch(() => 0),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [0n] }),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [1n] }),
        client.readContract({ address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [2n] }),
      ])

      // Found the wallet: from here on nothing may send the loop to the next network. The
      // stored credential needs no RPC; the chain lookup is a best effort, and only its
      // authenticated answer (the wallet's own CredentialSet) counts — a legacy factory event
      // carries whatever the deployer wrote.
      const stored = storedCredentialFor(address)
      const fromChain = stored ? null : await getCredentialFromChain(address, n).catch(() => null)
      const credentialId = stored ?? (fromChain?.authenticated ? fromChain.credentialId : null)

      const [qx, qy] = signer as readonly [`0x${string}`, `0x${string}`]
      const walletType = wType === 1 ? 1 : 0
      return {
        pubKeyX: BigInt(qx),
        pubKeyY: BigInt(qy),
        credentialId,
        guardians: [g0, g1, g2] as [Address, Address, Address],
        walletType,
        sourceName: n.name,
        targetAddress: await addressOnTarget(BigInt(qx), BigInt(qy), walletType, target),
      }
    } catch {
      // red caída o sin datos — probar la siguiente
    }
  }
  return null
}

export function useDeploySeed(address: string | null, target: NetworkConfig, enabled: boolean) {
  return useQuery({
    queryKey: ['deploySeed', address, target.chainId],
    queryFn: () => fetchSeed(address as Address, target),
    enabled: enabled && !!address,
    staleTime: 60_000,
  })
}
