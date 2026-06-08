'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress, type Address } from 'viem'
import {
  useConnect,
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi'
import { registerWebAuthn, saveCredential } from '@/lib/webauthn'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'

const C = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.08)',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  muted: '#8892a4',
  subtle: '#4a5568',
  error: '#fc8181',
  success: '#68d391',
}

function shortAddr(a: string) {
  return a.length >= 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a
}

function bigintToHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0')
}

function hexToBigint(hex: string): bigint | null {
  try {
    const clean = hex.trim().startsWith('0x') ? hex.trim() : '0x' + hex.trim()
    return BigInt(clean)
  } catch {
    return null
  }
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

export default function RecoverPage() {
  const router = useRouter()
  const { network } = useNetwork()
  const { t } = useI18n()

  const [addressInput, setAddressInput] = useState('')
  const [walletAddress, setWalletAddress] = useState<Address | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Nueva clave (dueño)
  const [newKeyData, setNewKeyData] = useState<{ x: string; y: string; credentialId: string } | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'x' | 'y' | null>(null)

  // Guardian inputs
  const [newXInput, setNewXInput] = useState('')
  const [newYInput, setNewYInput] = useState('')
  const [guardianError, setGuardianError] = useState<string | null>(null)

  // Countdown ticker
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000)
    return () => clearInterval(t)
  }, [])

  // Wagmi
  const { connect, connectors } = useConnect()
  const { address: connectedAddress, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isOnCorrectNetwork = chainId === network.chainId
  const injected = connectors.find(c => c.id === 'injected')

  const {
    writeContract: writeInitiate,
    data: initiateTxHash,
    isPending: isInitiating,
    error: initiateError,
    reset: resetInitiate,
  } = useWriteContract()
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()
  const {
    writeContract: writeExecute,
    data: executeTxHash,
    isPending: isExecuting,
    error: executeError,
    reset: resetExecute,
  } = useWriteContract()

  const { isLoading: initiateConfirming, isSuccess: initiateConfirmed } =
    useWaitForTransactionReceipt({ hash: initiateTxHash })
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: executeConfirming, isSuccess: executeConfirmed } =
    useWaitForTransactionReceipt({ hash: executeTxHash })

  // Stage 1: guardians + recovery metadata
  const { data: s1, refetch: refetch1 } = useReadContracts({
    contracts: walletAddress ? [
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [0n] },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [1n] },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [2n] },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'recoveryInProgress' },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'recoveryApprovals' },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'recoveryReadyAt' },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'pendingNewSignerX' },
      { address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'pendingNewSignerY' },
    ] : [],
  })

  const g0 = s1?.[0]?.result as Address | undefined
  const g1 = s1?.[1]?.result as Address | undefined
  const g2 = s1?.[2]?.result as Address | undefined
  const recoveryInProgress = s1?.[3]?.result as boolean | undefined
  const recoveryApprovals = s1?.[4]?.result as bigint | undefined
  const recoveryReadyAt   = s1?.[5]?.result as bigint | undefined
  const pendingX          = s1?.[6]?.result as bigint | undefined
  const pendingY          = s1?.[7]?.result as bigint | undefined

  // Stage 2: approval status per guardian (needs guardians loaded first)
  const { data: s2, refetch: refetch2 } = useReadContracts({
    contracts: g0 && g1 && g2 ? [
      { address: walletAddress!, abi: BVCC_WALLET_ABI, functionName: 'hasApprovedRecovery', args: [g0] },
      { address: walletAddress!, abi: BVCC_WALLET_ABI, functionName: 'hasApprovedRecovery', args: [g1] },
      { address: walletAddress!, abi: BVCC_WALLET_ABI, functionName: 'hasApprovedRecovery', args: [g2] },
    ] : [],
  })

  const approved = [
    s2?.[0]?.result as boolean | undefined,
    s2?.[1]?.result as boolean | undefined,
    s2?.[2]?.result as boolean | undefined,
  ]

  // Refetch after tx confirmed
  useEffect(() => {
    if (initiateConfirmed || approveConfirmed || executeConfirmed) {
      refetch1(); refetch2()
    }
  }, [initiateConfirmed, approveConfirmed, executeConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guardian detection
  const guardians = g0 && g1 && g2 ? [g0, g1, g2] : null
  const connectedIdx = connectedAddress && guardians
    ? guardians.findIndex(g => g.toLowerCase() === connectedAddress.toLowerCase())
    : -1
  const connectedIsGuardian = connectedIdx >= 0
  const connectedHasApproved = connectedIdx >= 0 ? approved[connectedIdx] : false

  // Timelock
  const timelockActive  = recoveryReadyAt !== undefined && recoveryReadyAt > 0n && BigInt(now) < recoveryReadyAt
  const timelockExpired = recoveryReadyAt !== undefined && recoveryReadyAt > 0n && BigInt(now) >= recoveryReadyAt
  const secsLeft = timelockActive ? Number(recoveryReadyAt! - BigInt(now)) : 0

  // State machine
  const stateLoaded    = walletAddress && g0 !== undefined
  const stateIdle      = stateLoaded && !recoveryInProgress
  const stateInProgress = stateLoaded && recoveryInProgress && !timelockExpired
  const stateReady     = stateLoaded && recoveryInProgress && timelockExpired

  function handleSearch() {
    if (!isAddress(addressInput)) { setSearchError(t('recovery.invalidAddress')); return }
    setSearchError(null)
    setWalletAddress(addressInput as Address)
  }

  async function handleGenerateKey() {
    setGeneratingKey(true)
    setKeyError(null)
    try {
      const label = 'BVCC-recovery-' + Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      const { pubKeyX, pubKeyY, credentialId } = await registerWebAuthn(label)
      const x = bigintToHex(pubKeyX)
      const y = bigintToHex(pubKeyY)
      setNewKeyData({ x, y, credentialId })
      setNewXInput(x)
      setNewYInput(y)
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : t('recovery.errorGenerating'))
    } finally {
      setGeneratingKey(false)
    }
  }

  function handleCopy(text: string, field: 'x' | 'y') {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  // If recovery executed and we have the new key, save it
  function handleSaveNewKey() {
    if (!newKeyData || !walletAddress) return
    saveCredential(newKeyData.credentialId, walletAddress)
    localStorage.setItem('bvcc_active_wallet', walletAddress)
    router.push('/wallet')
  }

  function handleInitiate() {
    if (!walletAddress) return
    const newX = hexToBigint(newXInput)
    const newY = hexToBigint(newYInput)
    if (!newX || !newY) { setGuardianError(t('recovery.invalidCoords')); return }
    setGuardianError(null)
    resetInitiate()
    writeInitiate({
      address: walletAddress,
      abi: BVCC_WALLET_ABI,
      functionName: 'initiateRecovery',
      args: [newX, newY],
      chainId: network.chainId,
    })
  }

  function handleApprove() {
    if (!walletAddress) return
    resetApprove()
    writeApprove({
      address: walletAddress,
      abi: BVCC_WALLET_ABI,
      functionName: 'approveRecovery',
      chainId: network.chainId,
    })
  }

  function handleExecute() {
    if (!walletAddress) return
    resetExecute()
    writeExecute({
      address: walletAddress,
      abi: BVCC_WALLET_ABI,
      functionName: 'executeRecovery',
      chainId: network.chainId,
    })
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '6px', color: C.text,
    fontSize: '13px', fontFamily: 'monospace',
    outline: 'none',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
  }

  const btnGold: React.CSSProperties = {
    padding: '11px 16px',
    backgroundColor: C.gold, border: 'none',
    borderRadius: '6px', color: '#000',
    fontSize: '13px', fontWeight: '600',
    cursor: 'pointer',
  }

  const btnOutline: React.CSSProperties = {
    padding: '11px 16px',
    backgroundColor: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: '6px', color: C.muted,
    fontSize: '13px', cursor: 'pointer',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.bg, padding: '24px 16px', maxWidth: '480px', margin: '0 auto' }}>
      <style>{`* { box-sizing: border-box; } input:focus { outline: none; border-color: rgba(212,175,55,0.4) !important; }`}</style>

      {/* Header */}
      <button onClick={() => router.back()} style={{ marginBottom: '20px', fontSize: '13px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        ← {t('recovery.back')}
      </button>
      <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        {t('recovery.title')}
      </h1>
      <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 24px', lineHeight: '1.6' }}>
        {t('recovery.subtitle')}
      </p>

      {/* ── Sección 1: Dirección de la wallet ── */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 10px', fontSize: '11px', color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('recovery.walletToRecover')}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={addressInput}
            onChange={e => { setAddressInput(e.target.value); setSearchError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="0x..."
            style={inputStyle}
          />
          <button onClick={handleSearch} style={{ ...btnGold, flexShrink: 0 }}>
            {t('recovery.load')}
          </button>
        </div>
        {searchError && <p style={{ fontSize: '12px', color: C.error, margin: '8px 0 0' }}>{searchError}</p>}
      </div>

      {/* ── Estado on-chain ── */}
      {stateLoaded && (
        <>
          {/* Guardians list */}
          <div style={cardStyle}>
            <p style={{ margin: '0 0 12px', fontSize: '11px', color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('recovery.guardiansLabel')}
            </p>
            {guardians?.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < 2 ? '8px' : 0 }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: C.muted }}>
                  {i + 1}. {shortAddr(g)}
                  {connectedAddress?.toLowerCase() === g.toLowerCase() && (
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: C.gold }}>{t('recovery.youLabel')}</span>
                  )}
                </span>
                <span style={{ fontSize: '12px', color: approved[i] ? C.success : C.subtle }}>
                  {approved[i] ? t('recovery.approved') : t('recovery.pending')}
                </span>
              </div>
            ))}
          </div>

          {/* Recovery state banner */}
          <div style={{
            ...cardStyle,
            backgroundColor: stateReady
              ? 'rgba(104,211,145,0.08)'
              : stateInProgress
                ? 'rgba(212,175,55,0.06)'
                : 'transparent',
            border: `1px solid ${
              stateReady ? 'rgba(104,211,145,0.25)' :
              stateInProgress ? C.goldBorder :
              C.border
            }`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: C.text }}>
                  {stateIdle && t('recovery.stateIdle')}
                  {stateInProgress && `${t('recovery.stateInProgress').replace('{approvals}', String(recoveryApprovals))}`}
                  {stateReady && t('recovery.stateReady')}
                </p>
                {stateInProgress && timelockActive && (
                  <p style={{ margin: 0, fontSize: '12px', color: C.gold }}>
                    {t('recovery.timelockRemaining').replace('{time}', formatCountdown(secsLeft))}
                  </p>
                )}
                {stateInProgress && !timelockActive && Number(recoveryApprovals) < 2 && (
                  <p style={{ margin: 0, fontSize: '12px', color: C.muted }}>
                    {t('recovery.waitingSecondGuardian')}
                  </p>
                )}
                {stateReady && (
                  <p style={{ margin: 0, fontSize: '12px', color: C.success }}>
                    {t('recovery.timelockExpiredAny')}
                  </p>
                )}
              </div>
              {stateInProgress && (
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  border: `3px solid ${Number(recoveryApprovals) >= 2 ? C.gold : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '700', color: C.gold,
                }}>
                  {Number(recoveryApprovals)}/2
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* ── Sección 2: Dueño — generar nueva clave ── */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: C.text }}>
          {t('recovery.ownerTitle')}
        </p>
        <p style={{ margin: '0 0 14px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
          {t('recovery.ownerDesc')}
        </p>

        {!newKeyData ? (
          <>
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              style={{ ...btnGold, width: '100%', opacity: generatingKey ? 0.6 : 1, cursor: generatingKey ? 'wait' : 'pointer' }}
            >
              {generatingKey ? t('recovery.waitingBiometrics') : t('recovery.generatePasskey')}
            </button>
            {keyError && <p style={{ fontSize: '12px', color: C.error, margin: '8px 0 0' }}>{keyError}</p>}
          </>
        ) : (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: C.success }}>
              {t('recovery.passkeyGenerated')}
            </p>
            {(['x', 'y'] as const).map(field => (
              <div key={field} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {field === 'x' ? t('recovery.coordX') : t('recovery.coordY')}
                  </span>
                  <button
                    onClick={() => handleCopy(newKeyData[field], field)}
                    style={{ fontSize: '11px', color: copied === field ? C.success : C.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {copied === field ? t('recovery.copied') : t('recovery.copy')}
                  </button>
                </div>
                <div style={{
                  padding: '8px 10px',
                  backgroundColor: '#080c14',
                  border: `1px solid ${C.border}`,
                  borderRadius: '5px',
                  fontSize: '10px', fontFamily: 'monospace',
                  color: C.muted, wordBreak: 'break-all', lineHeight: '1.6',
                }}>
                  {newKeyData[field]}
                </div>
              </div>
            ))}

            {/* Save credential after successful executeRecovery */}
            {executeConfirmed && (
              <button
                onClick={handleSaveNewKey}
                style={{ ...btnGold, width: '100%', marginTop: '8px' }}
              >
                {t('recovery.savePasskeyAndAccess')}
              </button>
            )}

            <button
              onClick={() => setNewKeyData(null)}
              style={{ ...btnOutline, width: '100%', marginTop: '8px', fontSize: '12px' }}
            >
              {t('recovery.generateAnother')}
            </button>
          </div>
        )}
      </div>

      {/* ── Sección 3: Guardian — acción ── */}
      {stateLoaded && (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: C.text }}>
            {t('recovery.guardianTitle')}
          </p>

          {/* Connect wallet */}
          {!connectedAddress ? (
            <>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>
                {t('recovery.connectMetaMaskDesc')}
              </p>
              {injected && (
                <button onClick={() => connect({ connector: injected })} style={{ ...btnGold, width: '100%' }}>
                  {t('recovery.connectMetaMask')}
                </button>
              )}
            </>
          ) : !isOnCorrectNetwork ? (
            <button onClick={() => switchChain({ chainId: network.chainId })} style={{ ...btnGold, width: '100%' }}>
              {t('recovery.switchNetwork').replace('{network}', network.name)}
            </button>
          ) : !connectedIsGuardian ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>
                {t('recovery.notGuardian').replace('{addr}', shortAddr(connectedAddress))}
              </p>
              {injected && (
                <button
                  onClick={() => connect({ connector: injected })}
                  style={{ ...btnOutline, width: '100%' }}
                >
                  {t('recovery.connectAnotherAccount')}
                </button>
              )}
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: C.success }}>
                {t('recovery.connectedAsGuardian')
                  .replace('{n}', String(connectedIdx + 1))
                  .replace('{addr}', shortAddr(connectedAddress))}
              </p>

              {/* ── Idle: iniciar recovery ── */}
              {stateIdle && (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>
                    {t('recovery.pasteCoords')}
                  </p>
                  {[
                    { label: t('recovery.newKeyX'), value: newXInput, set: setNewXInput },
                    { label: t('recovery.newKeyY'), value: newYInput, set: setNewYInput },
                  ].map(({ label, value, set }) => (
                    <div key={label} style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '11px', color: C.subtle, display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {label}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={e => { set(e.target.value); setGuardianError(null) }}
                        placeholder="0x..."
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  {guardianError && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{guardianError}</p>}
                  {initiateError && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{initiateError.message.split('\n')[0]}</p>}
                  {initiateTxHash && (
                    <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px' }}>
                      TX: {shortAddr(initiateTxHash)}
                      {initiateConfirming && ` ${t('recovery.txConfirming')}`}
                      {initiateConfirmed && <span style={{ color: C.success }}> {t('recovery.txConfirmed')}</span>}
                    </p>
                  )}
                  <button
                    onClick={handleInitiate}
                    disabled={isInitiating || initiateConfirming}
                    style={{ ...btnGold, width: '100%', opacity: isInitiating || initiateConfirming ? 0.6 : 1, cursor: isInitiating ? 'wait' : 'pointer' }}
                  >
                    {isInitiating ? t('recovery.waitingSignature') : initiateConfirming ? t('recovery.confirming') : t('recovery.initiateRecovery')}
                  </button>
                </>
              )}

              {/* ── In progress: approve ── */}
              {stateInProgress && !connectedHasApproved && Number(recoveryApprovals) < 2 && (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>
                    {t('recovery.approveDesc')}
                  </p>
                  {approveError && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{approveError.message.split('\n')[0]}</p>}
                  {approveTxHash && (
                    <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px' }}>
                      TX: {shortAddr(approveTxHash)}
                      {approveConfirming && ` ${t('recovery.txConfirming')}`}
                      {approveConfirmed && <span style={{ color: C.success }}> {t('recovery.txConfirmed')}</span>}
                    </p>
                  )}
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || approveConfirming}
                    style={{ ...btnGold, width: '100%', opacity: isApproving || approveConfirming ? 0.6 : 1, cursor: isApproving ? 'wait' : 'pointer' }}
                  >
                    {isApproving ? t('recovery.waitingSignature') : approveConfirming ? t('recovery.confirming') : t('recovery.approveRecovery')}
                  </button>
                </>
              )}

              {/* ── Timelock activo ── */}
              {stateInProgress && timelockActive && Number(recoveryApprovals) >= 2 && (
                <div style={{ padding: '12px', backgroundColor: C.goldDim, borderRadius: '6px', border: `1px solid ${C.goldBorder}` }}>
                  <p style={{ margin: 0, fontSize: '13px', color: C.gold }}>
                    {t('recovery.timelockActive').replace('{time}', formatCountdown(secsLeft))}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: C.muted }}>
                    {t('recovery.timelockActiveDesc')}
                  </p>
                </div>
              )}

              {/* ── Already approved ── */}
              {stateInProgress && connectedHasApproved && !timelockExpired && (
                <p style={{ margin: 0, fontSize: '12px', color: C.muted }}>
                  {t('recovery.alreadyApproved').replace(
                    '{waiting}',
                    Number(recoveryApprovals) < 2
                      ? t('recovery.waitingOtherGuardian')
                      : t('recovery.waitingTimelockExpiry').replace('{time}', formatCountdown(secsLeft))
                  )}
                </p>
              )}

              {/* ── Ready: execute ── */}
              {stateReady && (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.success }}>
                    {t('recovery.readyDesc')}
                  </p>
                  {executeError && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{executeError.message.split('\n')[0]}</p>}
                  {executeTxHash && (
                    <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px' }}>
                      TX: {shortAddr(executeTxHash)}
                      {executeConfirming && ` ${t('recovery.txConfirming')}`}
                      {executeConfirmed && <span style={{ color: C.success }}> {t('recovery.recoveryExecuted')}</span>}
                    </p>
                  )}
                  {!executeConfirmed && (
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting || executeConfirming}
                      style={{ ...btnGold, width: '100%', opacity: isExecuting || executeConfirming ? 0.6 : 1, cursor: isExecuting ? 'wait' : 'pointer' }}
                    >
                      {isExecuting ? t('recovery.waitingSignature') : executeConfirming ? t('recovery.confirming') : t('recovery.executeRecovery')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
