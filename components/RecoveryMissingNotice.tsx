'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPublicClient, http, type Address } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { BVCC_WALLET_ABI } from '@/lib/abis'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const GOLD = '#D4AF37'
const AMBER = '#e6b800'

/**
 * Banner for a wallet whose guardians were never registered.
 *
 * Creation is two transactions and only the first is paid for by the connected EOA, so a
 * wallet can end up live but with no way to rotate its owner — and until this banner, the
 * only hint was an empty list buried in settings. Losing the passkey in that state means
 * losing the wallet, so the warning follows the user around until it is fixed.
 */
export default function RecoveryMissingNotice() {
  const { address, isLoaded } = useWalletAddress()
  const { network } = useNetwork()
  const { t } = useI18n()
  const router = useRouter()
  const [unset, setUnset] = useState(false)

  useEffect(() => {
    if (!isLoaded || !address) return
    let cancelled = false
    const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })

    Promise.all([0n, 1n, 2n].map(i =>
      client.readContract({
        address: address as Address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [i],
      }).catch(() => null),
    )).then(slots => {
      if (cancelled) return
      // Only an unambiguous read of three empty slots counts. A revert or a dead RPC
      // returns nulls, and telling someone their recovery is gone when it is not would be
      // worse than staying quiet.
      setUnset(slots.every(g => typeof g === 'string' && g.toLowerCase() === ZERO_ADDRESS))
    }).catch(() => { /* stay quiet */ })

    return () => { cancelled = true }
  }, [address, isLoaded, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!unset) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '9px 16px', backgroundColor: 'rgba(230,184,0,0.10)',
      borderBottom: '1px solid rgba(230,184,0,0.30)', fontSize: '12.5px', color: AMBER,
    }}>
      <span style={{ fontSize: '14px' }} aria-hidden>⚠</span>
      <span style={{ flex: 1, minWidth: '220px', lineHeight: 1.45 }}>
        <b>{t('wallet.recoveryMissingTitle')}</b> — {t('wallet.recoveryMissingBody')}
      </span>
      <button
        onClick={() => router.push('/wallet/settings')}
        style={{
          padding: '6px 13px', fontSize: '11.5px', fontWeight: 600, color: '#06080f',
          backgroundColor: GOLD, border: 'none', borderRadius: '5px', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {t('wallet.recoveryMissingCta')}
      </button>
    </div>
  )
}
