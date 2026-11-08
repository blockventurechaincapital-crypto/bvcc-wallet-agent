'use client'
import { useState, useEffect } from 'react'
import { createPublicClient, type Address } from 'viem'
import { useWalletAddress } from './useWalletAddress'
import { useNetwork } from './NetworkContext'
import { BVCC_WALLET_ABI } from './abis'
import { getWalletAddress, getAgentWalletAddress } from './wallet'
import { rpcTransport } from './rpc'

/**
 * The generation the active network's factories create now (network.contracts.walletVersion).
 * Wallets on anything older should migrate. It can differ between networks while a new
 * generation is rolled out one network at a time.
 */

export interface WalletVersionState {
  /** 1..5, or null while loading / if the wallet does not report a domain. */
  version: number | null
  /** The generation this network's factories create now. */
  current: number
  isOutdated: boolean
  /** Where this passkey's current-generation wallet would live, so the user can be shown the target. */
  upgradeAddress: Address | null
  isLoading: boolean
}

/**
 * Reads the wallet's own EIP-712 domain to find out which generation it is: every
 * release names it BVCCSmartWalletV<n>, so one call is enough and it cannot go stale the
 * way a hardcoded address list would.
 *
 * A wallet's address derives from (factory, passkey), so an older generation lives at a
 * different address than V4 for the same passkey — migrating means creating the V4 wallet
 * and moving the funds across, not upgrading in place.
 */
export function useWalletVersion(): WalletVersionState {
  const { address, isLoaded } = useWalletAddress()
  const { network } = useNetwork()
  const current = network.contracts.walletVersion
  const [state, setState] = useState<WalletVersionState>({
    version: null, current, isOutdated: false, upgradeAddress: null, isLoading: true,
  })

  useEffect(() => {
    if (!isLoaded || !address) {
      setState({ version: null, current, isOutdated: false, upgradeAddress: null, isLoading: false })
      return
    }
    let cancelled = false
    const client = createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) })

    ;(async () => {
      try {
        const { domain } = await client.getEip712Domain({ address: address as Address })
        const match = /^BVCCSmartWalletV(\d+)$/.exec(domain.name ?? '')
        const version = match ? Number(match[1]) : null
        const isOutdated = version !== null && version < current

        let upgradeAddress: Address | null = null
        if (isOutdated) {
          // Same passkey, current factory → the address the user should move to.
          try {
            const [qx, qy] = await client.readContract({
              address: address as Address, abi: BVCC_WALLET_ABI, functionName: 'signer',
            }) as readonly [`0x${string}`, `0x${string}`]
            const walletType = await client.readContract({
              address: address as Address,
              abi: [{ type: 'function', name: 'walletType', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }],
              functionName: 'walletType',
            }).catch(() => 0)
            upgradeAddress = walletType === 1
              ? await getAgentWalletAddress(BigInt(qx), BigInt(qy), network)
              : await getWalletAddress(BigInt(qx), BigInt(qy), network)
          } catch {
            // The banner is worth showing even without the target address.
          }
        }
        if (!cancelled) setState({ version, current, isOutdated, upgradeAddress, isLoading: false })
      } catch {
        // Not a BVCC wallet, or the network is down: say nothing rather than cry wolf.
        if (!cancelled) setState({ version: null, current, isOutdated: false, upgradeAddress: null, isLoading: false })
      }
    })()

    return () => { cancelled = true }
  }, [address, isLoaded, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
