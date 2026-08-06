'use client'
import { useState, useEffect } from 'react'
import { createPublicClient, http, encodeFunctionData, isAddress, type Address } from 'viem'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { credentialIdToBytes, discoverCredentialId, saveCredential, WrongPasskeyError } from '@/lib/webauthn'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { getPrefundNeed } from '@/lib/prefund'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  gold: '#D4AF37',
  border: 'rgba(255,255,255,0.07)',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
  error: '#fc8181',
  warn: '#e6b800',
}

const SIGNER_ABI = [{
  type: 'function', name: 'signer', stateMutability: 'view',
  inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }],
}] as const

/**
 * Recovery setup for a wallet that was deployed but never configured.
 *
 * The creation flow is two transactions — the factory deploys, then a passkey-signed
 * self-call registers the guardians — and only the first one is paid for by the connected
 * EOA. If the second never lands (passkey unavailable, wallet out of gas, tab closed) the
 * wallet works but has no way to rotate its owner, and nothing in the UI used to offer a
 * retry. This is that retry.
 */
export default function GuardianSetup({
  walletAddress, credentialId, onDone,
}: {
  walletAddress: Address
  credentialId: string | null
  onDone: () => void
}) {
  const { network } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()

  const [guardians, setGuardians] = useState<[string, string, string]>(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [underfunded, setUnderfunded] = useState(false)
  // Recovered from the authenticator when localStorage has no pointer to the passkey.
  const [foundCredentialId, setFoundCredentialId] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const activeCredentialId = credentialId ?? foundCredentialId


  async function handleFindPasskey() {
    setError(null)
    setFinding(true)
    try {
      const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
      // The owner the contract itself reports — the one thing here that is authenticated.
      const [pubKeyX, pubKeyY] = await client.readContract({
        address: walletAddress, abi: SIGNER_ABI, functionName: 'signer',
      }) as readonly [bigint, bigint]

      const id = await discoverCredentialId({ pubKeyX, pubKeyY })
      setFoundCredentialId(id)
      // Keep it, so the rest of the app stops treating this wallet as passkey-less.
      saveCredential(id, walletAddress)
    } catch (err) {
      setError(
        err instanceof WrongPasskeyError
          ? t('settings.guardianSetupWrongPasskey')
          : err instanceof Error ? err.message : String(err),
      )
    } finally {
      setFinding(false)
    }
  }

  // Whatever the creation flow saved before it failed, so the user does not have to dig
  // the three addresses out again.
  useEffect(() => {
    for (const key of ['bvcc_pending_guardians', 'bvcc_guardians']) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null')
        if (Array.isArray(saved) && saved.length === 3 && saved.every(g => typeof g === 'string' && g)) {
          // Read after mount, not in a state initializer: localStorage does not exist
          // during the server render and the mismatch would break hydration.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setGuardians([saved[0], saved[1], saved[2]])
          return
        }
      } catch { /* corrupt entry: fall through to the next key */ }
    }
  }, [])

  // setGuardians travels as a UserOp, and the prefund comes out of the wallet itself — a
  // freshly deployed wallet holding nothing fails validation with AA21 before the call
  // ever runs. Say so up front instead of letting the user burn a passkey prompt on it.
  useEffect(() => {
    let cancelled = false
    getPrefundNeed(walletAddress, network)
      .then(need => { if (!cancelled) setUnderfunded(need.available < need.required) })
      .catch(() => { /* the send itself will surface any real problem */ })
    return () => { cancelled = true }
  }, [walletAddress, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (!activeCredentialId) { setError(t('settings.guardianSetupNoCredential')); return }
    if (!guardians.every(g => isAddress(g))) { setError(t('appshell.guardianErrorInvalid')); return }
    if (new Set(guardians.map(g => g.toLowerCase())).size !== 3) {
      setError(t('appshell.guardianErrorNotUnique')); return
    }

    setError(null)
    setBusy(true)
    try {
      const callData = encodeFunctionData({
        abi: BVCC_WALLET_ABI,
        functionName: 'setGuardians',
        args: [guardians as [Address, Address, Address], credentialIdToBytes(activeCredentialId)],
      })
      const hash = await executeWithFaceId({
        network,
        walletAddress,
        credentialId: activeCredentialId,
        calls: [{ target: walletAddress, value: 0n, callData }],
        submitUserOp,
      })
      setTxHash(hash)
      localStorage.setItem('bvcc_guardians', JSON.stringify(guardians))
      localStorage.removeItem('bvcc_pending_guardians')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (txHash) {
    return (
      <div style={{ padding: '14px 20px', fontSize: '12px', color: '#68d391', lineHeight: 1.6 }}>
        {t('settings.guardianSetupDone')}
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 20px', borderTop: `1px solid rgba(255,255,255,0.04)` }}>
      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: COLORS.gold }}>
        {t('settings.guardianSetupTitle')}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: COLORS.textSecondary, lineHeight: 1.6 }}>
        {t('settings.guardianSetupDesc')}
      </p>

      {underfunded && (
        <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: COLORS.warn, lineHeight: 1.6 }}>
          ⚠ {t('settings.guardianSetupUnderfunded').replace('{symbol}', network.nativeToken.symbol)}
        </p>
      )}

      {guardians.map((g, i) => (
        <input
          key={i}
          value={g}
          onChange={e => {
            const next = [...guardians] as [string, string, string]
            next[i] = e.target.value.trim()
            setGuardians(next)
          }}
          disabled={busy}
          placeholder={`${t('settings.guardianSetupPlaceholder')} ${i + 1}`}
          spellCheck={false}
          style={{
            width: '100%', padding: '9px 11px', marginBottom: '8px',
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.border}`,
            borderRadius: '5px', color: COLORS.textPrimary,
            fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace',
          }}
        />
      ))}

      {error && (
        <p style={{ margin: '4px 0 10px', fontSize: '11.5px', color: COLORS.error, lineHeight: 1.6, wordBreak: 'break-word' }}>
          {error}
        </p>
      )}

      {!activeCredentialId && (
        <>
          <p style={{ margin: '4px 0 8px', fontSize: '11.5px', color: COLORS.textSecondary, lineHeight: 1.6 }}>
            {t('settings.guardianSetupFindDesc')}
          </p>
          <button
            onClick={handleFindPasskey}
            disabled={finding}
            style={{
              width: '100%', padding: '10px', marginBottom: '8px',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLORS.border}`,
              borderRadius: '6px', color: COLORS.textPrimary,
              fontSize: '13px', fontWeight: 600, cursor: finding ? 'default' : 'pointer',
            }}
          >
            {finding ? t('settings.guardianSetupFinding') : t('settings.guardianSetupFindCta')}
          </button>
        </>
      )}

      <button
        onClick={handleSubmit}
        disabled={busy || !activeCredentialId}
        style={{
          width: '100%', padding: '10px', marginTop: '4px',
          background: busy || !activeCredentialId ? 'rgba(212,175,55,0.35)' : COLORS.gold,
          border: 'none', borderRadius: '6px', color: '#06080f',
          fontSize: '13px', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? t('settings.guardianSetupSigning') : t('settings.guardianSetupCta')}
      </button>
    </div>
  )
}
