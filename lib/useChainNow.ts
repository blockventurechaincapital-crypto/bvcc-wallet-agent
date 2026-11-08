'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPublicClient } from 'viem'
import { useNetwork } from '@/lib/NetworkContext'
import { rpcTransport } from '@/lib/rpc'

/**
 * Current time in seconds as the chain sees it, ticking every `tickMs`.
 *
 * Countdowns that decide what the user can still do (cancel a recovery before it can be
 * executed) must not depend on the computer's clock, which can be off by hours. The
 * offset to the latest block's timestamp is measured on mount and every few minutes;
 * until it is known, the local clock is used.
 */
export function useChainNow(tickMs = 1000): number {
  const { network } = useNetwork()
  const client = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) }),
    [network.chainId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [offset, setOffset] = useState(0)
  const [local, setLocal] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    let cancelled = false
    async function measure() {
      try {
        const block = await client.getBlock({ blockTag: 'latest' })
        if (!cancelled) setOffset(Number(block.timestamp) - Math.floor(Date.now() / 1000))
      } catch { /* keep the last offset */ }
    }
    measure()
    const id = setInterval(measure, 5 * 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [client])

  useEffect(() => {
    const id = setInterval(() => setLocal(Math.floor(Date.now() / 1000)), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  return local + offset
}
