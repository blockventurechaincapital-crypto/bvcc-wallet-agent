'use client'
import { useEffect, useState } from 'react'
import { createPublicClient, http, getAddress } from 'viem'
import { BVCC_WALLET_ABI, WALLET_TYPE_ABI } from './abis'
import { useNetwork } from './NetworkContext'
import { NETWORKS } from './networks'

/**
 * Which contract a wallet actually is, and when it was deployed.
 *
 * Wallets cannot be upgraded in place: a V3 wallet keeps running V3 bytecode until its
 * owner creates a V4 one and moves the funds. So the generation is not trivia — it is
 * what tells someone whether they need to migrate. It was not surfaced anywhere.
 *
 * Two reads, because neither alone gives the contract name a block explorer shows:
 *
 *  - `eip712Domain()` (ERC-5267) is baked into the bytecode and carries the generation,
 *    but it reads "BVCCSmartWalletV4" on BOTH kinds of wallet — the agent contract
 *    inherits the parent's EIP712 constructor, so the domain never says "Agent".
 *  - `walletType()` returns 0 or 1 and separates personal from agent.
 *
 * Reporting the domain alone would print "BVCCSmartWalletV4" for a wallet whose verified
 * name on Arbiscan is "BVCCAgentWalletV4". Anyone cross-checking would think something
 * was wrong, so the name is reassembled from both.
 */
export interface WalletIdentity {
  /** 'BVCCAgentWalletV4' — matches the verified name on the explorer. */
  contractName: string | null
  /** 'V4', parsed off the domain name. Null when the domain does not carry one. */
  generation: string | null
  /** True when the generation matches the factories this build points at. */
  isCurrent: boolean | null
  /** Unix seconds. Null when the explorer has no key or does not answer. */
  createdAt: number | null
  /** Factory that deployed it — a second, independent read on the generation. */
  factory: string | null
  isLoading: boolean
}

/** Generation the current build deploys, taken from the configured factory. */
const CURRENT_GENERATION = 'V4'

export function useWalletIdentity(walletAddress: string | null): WalletIdentity {
  const { network } = useNetwork()
  const [state, setState] = useState<WalletIdentity>({
    contractName: null, generation: null, isCurrent: null,
    createdAt: null, factory: null, isLoading: false,
  })

  useEffect(() => {
    if (!walletAddress) {
      setState(s => ({ ...s, isLoading: false }))
      return
    }
    let cancelled = false
    setState(s => ({ ...s, isLoading: true }))

    const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })

    const readDomain = client
      .readContract({
        address: walletAddress as `0x${string}`,
        abi: BVCC_WALLET_ABI,
        functionName: 'eip712Domain',
      })
      .then(r => {
        // ERC-5267 returns (fields, name, version, chainId, verifyingContract, salt, ext)
        const name = Array.isArray(r) ? String(r[1] ?? '') : ''
        return name || null
      })
      .catch(() => null)

    const readType = client
      .readContract({
        address: walletAddress as `0x${string}`,
        abi: WALLET_TYPE_ABI,
        functionName: 'walletType',
      })
      .then(v => Number(v) as 0 | 1)
      .catch(() => null)

    const readCreation = fetch(
      `/api/wallet-info?chainId=${network.chainId}&address=${walletAddress}`,
    )
      .then(r => r.json())
      .then(j => (j && !j.error ? j : null))
      .catch(() => null)

    Promise.all([readDomain, readType, readCreation]).then(([domain, walletType, creation]) => {
      if (cancelled) return
      // The explorer's verified name wins — it is what the user sees if they check.
      // The reconstruction below only covers unverified contracts and no-API-key builds,
      // and it assumes the BVCC{Kind}Wallet{Gen} convention, so it is the weaker source.
      const fallbackName = domain?.match(/V\d+$/)
        ? `BVCC${walletType === 1 ? 'Agent' : 'Smart'}Wallet${domain.match(/V\d+$/)![0]}`
        : domain
      const contractName = creation?.contractName ?? fallbackName
      // Generation off whichever name we ended up with, so the badge stays consistent.
      const generation = contractName?.match(/V\d+$/)?.[0] ?? null
      setState({
        contractName,
        generation,
        isCurrent: generation ? generation === CURRENT_GENERATION : null,
        createdAt: creation?.timestamp ?? null,
        factory: creation?.factory ? safeChecksum(creation.factory) : null,
        isLoading: false,
      })
    })

    return () => { cancelled = true }
  }, [walletAddress, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}

function safeChecksum(a: string): string {
  try { return getAddress(a) } catch { return a }
}

/** True when `factory` is one of the factories this build targets. */
export function isKnownFactory(factory: string | null): boolean {
  if (!factory) return false
  const f = factory.toLowerCase()
  return NETWORKS.some(
    n =>
      n.contracts.factory?.toLowerCase() === f ||
      n.contracts.agentFactory?.toLowerCase() === f,
  )
}
