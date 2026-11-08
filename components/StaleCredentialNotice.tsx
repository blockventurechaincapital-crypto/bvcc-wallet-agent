'use client'
import { useState, useEffect } from 'react'
import { createPublicClient, type Address, type Hex } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { BVCC_WALLET_V5_ABI } from '@/lib/abis'
import { rpcTransport } from '@/lib/rpc'
import { credentialIdToBytes, discoverCredentialId, saveCredential, WrongPasskeyError } from '@/lib/webauthn'

const GOLD = '#D4AF37'
const AMBER = '#e6b800'

/**
 * Banner for a V5 wallet whose owner passkey is no longer the one this browser remembers.
 *
 * After a guardian recovery the wallet answers to a new passkey, but the browser keeps
 * asking for the old one by its id — on a phone reached by QR code, the old passkey is the
 * only one offered. The wallet keeps its owner's credential id on-chain, so the two can be
 * compared. The fix asks the authenticator to list its passkeys and keeps the one whose key
 * the contract reports as owner; a wrong pick is refused before anything is saved.
 */
export default function StaleCredentialNotice() {
  const { address, credentialId, isLoaded } = useWalletAddress()
  const { network } = useNetwork()
  const { t } = useI18n()
  const [owner, setOwner] = useState<{ x: bigint; y: bigint } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !address || !credentialId) return
    let cancelled = false
    const client = createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) })
    ;(async () => {
      try {
        const onChain = await client.readContract({
          address: address as Address, abi: BVCC_WALLET_V5_ABI, functionName: 'credentialId',
        }) as Hex
        // Nothing to compare against (or not a V5 wallet): stay quiet.
        if (!onChain || onChain === '0x') return
        if (credentialIdToBytes(credentialId).toLowerCase() === onChain.toLowerCase()) return
        const [x, y] = await client.readContract({
          address: address as Address, abi: BVCC_WALLET_V5_ABI, functionName: 'signer',
        }) as readonly [Hex, Hex]
        if (!cancelled) setOwner({ x: BigInt(x), y: BigInt(y) })
      } catch { /* pre-V5 wallet or a dead RPC: stay quiet */ }
    })()
    return () => { cancelled = true }
  }, [address, credentialId, isLoaded, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!owner || !address) return null

  async function pickCurrentPasskey() {
    if (!owner || !address) return
    setBusy(true)
    setError(null)
    try {
      const id = await discoverCredentialId({ pubKeyX: owner.x, pubKeyY: owner.y })
      saveCredential(id, address)
      window.location.reload()
    } catch (err) {
      setError(err instanceof WrongPasskeyError ? t('wallet.staleCredentialWrong') : t('wallet.staleCredentialFailed'))
      setBusy(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      padding: '9px 16px', backgroundColor: 'rgba(230,184,0,0.10)',
      borderBottom: '1px solid rgba(230,184,0,0.30)', fontSize: '12.5px', color: AMBER,
    }}>
      <span style={{ fontSize: '14px' }} aria-hidden>⚠</span>
      <span style={{ flex: 1, minWidth: '220px', lineHeight: 1.45 }}>
        <b>{t('wallet.staleCredentialTitle')}</b> — {t('wallet.staleCredentialBody')}
        {error && <span style={{ display: 'block', marginTop: '3px' }}>{error}</span>}
      </span>
      <button
        onClick={pickCurrentPasskey}
        disabled={busy}
        style={{
          padding: '6px 13px', fontSize: '11.5px', fontWeight: 600, color: '#06080f',
          backgroundColor: GOLD, border: 'none', borderRadius: '5px', cursor: busy ? 'default' : 'pointer',
          whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? t('wallet.staleCredentialBusy') : t('wallet.staleCredentialCta')}
      </button>
    </div>
  )
}
