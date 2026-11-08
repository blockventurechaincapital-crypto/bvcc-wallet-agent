'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createPublicClient, encodeAbiParameters, keccak256, isHex, type Address, type Hex } from 'viem'
import {
  useConnect,
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
  useDisconnect,
} from 'wagmi'
import { registerWebAuthn, saveCredential, credentialIdToBytes } from '@/lib/webauthn'
import { coordToHex, isValidP256Point, parseCoord } from '@/lib/p256'
import { BVCC_WALLET_V5_ABI } from '@/lib/abis'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import WcQrConnect from '@/components/WcQrConnect'
import { useChainNow } from '@/lib/useChainNow'
import { rpcTransport } from '@/lib/rpc'

/**
 * Guardian recovery of a V5 wallet.
 *
 * V5 has no "initiate then approve": each guardian votes for one concrete new key
 * (X, Y and the passkey's credential id). Two votes for the same key arm it, and after
 * RECOVERY_DELAY any guardian executes it. A guardian can move or withdraw their vote.
 * The owner shares the new key as one "recovery code" so the three parts travel together.
 */

const C = {
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
  warn: '#f6ad55',
}

const ZERO32 = `0x${'0'.repeat(64)}` as Hex

interface NewKey { x: Hex; y: Hex; credential: Hex }

function shortAddr(a: string) {
  return a.length >= 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

/** Same id the contract gives a proposal: keccak256(abi.encode(x, y, keccak256(credentialId))). */
function proposalId(k: NewKey): Hex {
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }],
    [k.x, k.y, keccak256(k.credential)],
  ))
}

function toCode(k: NewKey): string {
  return `${k.x}:${k.y}:${k.credential}`
}

/** Parses "x:y:credential". Null when it is not three hex parts. */
function parseCode(code: string): NewKey | null {
  const parts = code.trim().split(/[\s:]+/).filter(Boolean)
  if (parts.length !== 3) return null
  const x = parseCoord(parts[0])
  const y = parseCoord(parts[1])
  const cred = parts[2].toLowerCase()
  if (x === null || y === null || !isHex(cred) || cred.length < 4 || cred.length % 2 !== 0) return null
  return { x: coordToHex(x) as Hex, y: coordToHex(y) as Hex, credential: cred as Hex }
}

function sameKey(a: NewKey | null, b: NewKey | null) {
  return !!a && !!b && a.x.toLowerCase() === b.x.toLowerCase() && a.y.toLowerCase() === b.y.toLowerCase()
    && a.credential.toLowerCase() === b.credential.toLowerCase()
}

export default function RecoverV5({ walletAddress }: { walletAddress: Address }) {
  const router = useRouter()
  const { network } = useNetwork()
  const { t } = useI18n()
  const chainId = network.chainId

  // Owner: the new passkey made on this device.
  const [newKey, setNewKey] = useState<NewKey | null>(null)
  const [newCredentialId, setNewCredentialId] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Guardian: the code being voted for.
  const [codeInput, setCodeInput] = useState('')
  const [verified, setVerified] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // The new passkey is remembered on this device until it is saved: the recovery takes at
  // least RECOVERY_DELAY, so the page will be closed and opened again before it finishes.
  const pendingKeyStorage = `bvcc_recovery_v5_${chainId}_${walletAddress.toLowerCase()}`
  useEffect(() => {
    try {
      const raw = localStorage.getItem(pendingKeyStorage)
      if (!raw) return
      const v = JSON.parse(raw) as { x: Hex; y: Hex; credential: Hex; credentialId: string }
      if (!v?.x || !v?.y || !v?.credential || !v?.credentialId) return
      const k = { x: v.x, y: v.y, credential: v.credential }
      // Restoring state saved by an earlier visit, which only exists in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewKey(k)
      setNewCredentialId(v.credentialId)
      setCodeInput(toCode(k))
    } catch { /* unreadable: ignore it */ }
  }, [pendingKeyStorage])

  // Chain time, so the countdown is right even when the computer's clock is not.
  const now = useChainNow(15_000)

  const { connect, connectors } = useConnect()
  const { address: connectedAddress, chainId: walletChainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { disconnect } = useDisconnect()
  const injected = connectors.find(c => c.id === 'injected')

  const vote = useWriteContract()
  const withdraw = useWriteContract()
  const execute = useWriteContract()
  const voteRc = useWaitForTransactionReceipt({ hash: vote.data, chainId })
  const withdrawRc = useWaitForTransactionReceipt({ hash: withdraw.data, chainId })
  const executeRc = useWaitForTransactionReceipt({ hash: execute.data, chainId })

  // ── On-chain state ─────────────────────────────────────────────────────────
  const base = { address: walletAddress, abi: BVCC_WALLET_V5_ABI, chainId } as const
  const { data: s1, refetch: refetch1 } = useReadContracts({
    contracts: [
      { ...base, functionName: 'guardians' },
      { ...base, functionName: 'recoveryVotes' },
      { ...base, functionName: 'armedRecovery' },
      { ...base, functionName: 'signer' },
      { ...base, functionName: 'walletType' },
    ],
  })
  const guardians = s1?.[0]?.result as readonly [Address, Address, Address] | undefined
  const votesRaw = s1?.[1]?.result as readonly [Hex, Hex, Hex] | undefined
  const votes = useMemo(() => votesRaw ?? [ZERO32, ZERO32, ZERO32] as const, [votesRaw])
  const armed = s1?.[2]?.result as readonly [Hex, bigint] | undefined
  const signerKey = s1?.[3]?.result as readonly [Hex, Hex] | undefined
  const isAgentWallet = (s1?.[4]?.result as number | undefined) === 1

  const armedId = armed && armed[0] !== ZERO32 ? armed[0] : null
  const readyAt = armed ? armed[1] : 0n

  // Every proposal someone votes for (or the armed one), in a stable order with a letter.
  const proposalIds = useMemo(() => {
    const ids: Hex[] = []
    for (const v of [...votes, armedId ?? ZERO32]) {
      if (v !== ZERO32 && !ids.includes(v)) ids.push(v)
    }
    return ids
  }, [votes, armedId])

  const { data: s2, refetch: refetch2 } = useReadContracts({
    contracts: proposalIds.map(id => ({ ...base, functionName: 'recoveryProposal' as const, args: [id] as const })),
  })
  const proposals = proposalIds.map((id, i) => {
    const r = s2?.[i]?.result as { x: Hex; y: Hex; credentialId: Hex } | undefined
    return {
      id,
      letter: String.fromCharCode(65 + i),
      key: r ? { x: r.x, y: r.y, credential: r.credentialId } as NewKey : null,
      count: votes.filter(v => v === id).length,
    }
  })
  const letterOf = (id: Hex) => proposals.find(p => p.id === id)?.letter ?? '?'

  useEffect(() => {
    if (voteRc.isSuccess || withdrawRc.isSuccess || executeRc.isSuccess) { refetch1(); refetch2() }
  }, [voteRc.isSuccess, withdrawRc.isSuccess, executeRc.isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────
  const timelockActive = !!armedId && BigInt(now) < readyAt
  const timelockExpired = !!armedId && BigInt(now) >= readyAt
  const secsLeft = timelockActive ? Number(readyAt - BigInt(now)) : 0
  const anyVote = votes.some(v => v !== ZERO32)

  const connectedIdx = connectedAddress && guardians
    ? guardians.findIndex(g => g.toLowerCase() === connectedAddress.toLowerCase())
    : -1
  const connectedIsGuardian = connectedIdx >= 0
  const myVote = connectedIdx >= 0 ? votes[connectedIdx] : ZERO32

  // The owner's new key is already the wallet's signer: the recovery went through.
  const newKeyIsOwner = !!newKey && !!signerKey
    && signerKey[0].toLowerCase() === newKey.x.toLowerCase() && signerKey[1].toLowerCase() === newKey.y.toLowerCase()

  const parsed = parseCode(codeInput)
  const parsedId = parsed ? proposalId(parsed) : null
  const parsedOnCurve = parsed ? isValidP256Point(BigInt(parsed.x), BigInt(parsed.y)) : false
  const parsedExisting = parsedId ? proposals.find(p => p.id === parsedId) : undefined
  const votingSame = !!parsedId && parsedId === myVote
  // Moving the vote away from the armed key can take its second vote and restart the wait.
  const movesArmedVote = !!armedId && myVote === armedId && !!parsedId && parsedId !== armedId

  // Gas is estimated here, on the app's own RPC, and handed to the wallet. Some wallets'
  // own estimate on testnets fails with an empty reason, which left the guardian
  // editing the gas by hand. A failure here also names the contract error.
  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) }),
    [network.chainId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [estimateError, setEstimateError] = useState<string | null>(null)
  async function gasFor(
    functionName: 'voteRecovery' | 'withdrawRecoveryVote' | 'executeRecovery',
    args?: readonly [Hex, Hex, Hex],
  ): Promise<bigint | null> {
    setEstimateError(null)
    try {
      const est = await publicClient.estimateContractGas({
        address: walletAddress, abi: BVCC_WALLET_V5_ABI, functionName, args, account: connectedAddress,
      } as Parameters<typeof publicClient.estimateContractGas>[0])
      return (est * 13n) / 10n
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string }
      setEstimateError((e.shortMessage ?? e.message ?? String(err)).split('\n')[0])
      return null
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleGenerateKey() {
    setGeneratingKey(true)
    setKeyError(null)
    try {
      const label = 'BVCC-recovery-' + Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      const { pubKeyX, pubKeyY, credentialId } = await registerWebAuthn(label)
      const k: NewKey = {
        x: coordToHex(pubKeyX) as Hex,
        y: coordToHex(pubKeyY) as Hex,
        credential: credentialIdToBytes(credentialId),
      }
      setNewKey(k)
      setNewCredentialId(credentialId)
      setCodeInput(toCode(k))
      localStorage.setItem(pendingKeyStorage, JSON.stringify({ ...k, credentialId }))
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : t('recovery.errorGenerating'))
    } finally {
      setGeneratingKey(false)
    }
  }

  function handleCopy() {
    if (!newKey) return
    navigator.clipboard.writeText(toCode(newKey))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSaveNewKey() {
    if (!newCredentialId) return
    saveCredential(newCredentialId, walletAddress)
    localStorage.setItem('bvcc_active_wallet', walletAddress)
    localStorage.removeItem(pendingKeyStorage)
    router.push('/wallet')
  }

  async function handleVote() {
    if (!parsed) { setFormError(t('recovery.v5.codeInvalid')); return }
    // The contract checks the curve too, but a typo caught here costs nothing.
    if (!parsedOnCurve) { setFormError(t('recovery.v5.keyNotOnCurve')); return }
    if (newKey && !sameKey(parsed, newKey)) { setFormError(t('recovery.v5.codeMismatchGenerated')); return }
    setFormError(null)
    vote.reset()
    const args = [parsed.x, parsed.y, parsed.credential] as const
    const gas = await gasFor('voteRecovery', args)
    if (gas === null) return
    vote.writeContract({ ...base, functionName: 'voteRecovery', args, gas })
  }

  async function handleWithdraw() {
    withdraw.reset()
    const gas = await gasFor('withdrawRecoveryVote')
    if (gas === null) return
    withdraw.writeContract({ ...base, functionName: 'withdrawRecoveryVote', gas })
  }

  async function handleExecute() {
    execute.reset()
    const gas = await gasFor('executeRecovery')
    if (gas === null) return
    execute.writeContract({ ...base, functionName: 'executeRecovery', gas })
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', marginBottom: '12px',
  }
  const btnGold: React.CSSProperties = {
    padding: '11px 16px', backgroundColor: C.gold, border: 'none', borderRadius: '6px', color: '#000',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  }
  const btnOutline: React.CSSProperties = {
    padding: '11px 16px', backgroundColor: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px',
    color: C.muted, fontSize: '13px', cursor: 'pointer',
  }
  const mono: React.CSSProperties = {
    padding: '8px 10px', backgroundColor: '#080c14', border: `1px solid ${C.border}`, borderRadius: '5px',
    fontSize: '10px', fontFamily: 'monospace', color: C.text, wordBreak: 'break-all', lineHeight: '1.6',
  }
  const label: React.CSSProperties = { fontSize: '10px', color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em' }

  function txLine(hash: Hex | undefined, confirming: boolean, confirmed: boolean, error: Error | null) {
    return (
      <>
        {error && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{error.message.split('\n')[0]}</p>}
        {hash && (
          <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px' }}>
            TX: {shortAddr(hash)}
            {confirming && ` ${t('recovery.txConfirming')}`}
            {confirmed && <span style={{ color: C.success }}> {t('recovery.txConfirmed')}</span>}
          </p>
        )}
      </>
    )
  }

  function keyBlock(k: NewKey) {
    return (
      <>
        {([['x', t('recovery.coordX')], ['y', t('recovery.coordY')], ['credential', t('recovery.v5.credentialLabel')]] as const)
          .map(([field, name]) => (
            <div key={field} style={{ marginBottom: '8px' }}>
              <span style={label}>{name}</span>
              <div style={{ ...mono, marginTop: '4px' }}>{k[field]}</div>
            </div>
          ))}
      </>
    )
  }

  if (!guardians) return null

  return (
    <>
      {/* ── Guardians and their votes ── */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 12px', ...label, fontSize: '11px' }}>{t('recovery.guardiansLabel')}</p>
        {guardians.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < 2 ? '8px' : 0 }}>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: C.muted }}>
              {i + 1}. {shortAddr(g)}
              {connectedAddress?.toLowerCase() === g.toLowerCase() && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: C.gold }}>{t('recovery.youLabel')}</span>
              )}
            </span>
            <span style={{ fontSize: '12px', color: votes[i] !== ZERO32 ? C.success : C.subtle }}>
              {votes[i] !== ZERO32
                ? t('recovery.v5.votedFor', { letter: letterOf(votes[i]) })
                : t('recovery.v5.noVote')}
            </span>
          </div>
        ))}
      </div>

      {/* ── State ── */}
      <div style={{
        ...cardStyle,
        backgroundColor: timelockExpired ? 'rgba(104,211,145,0.08)' : armedId ? 'rgba(212,175,55,0.06)' : 'transparent',
        border: `1px solid ${timelockExpired ? 'rgba(104,211,145,0.25)' : armedId ? C.goldBorder : C.border}`,
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: C.text }}>
          {!anyVote && !armedId && t('recovery.stateIdle')}
          {anyVote && !armedId && t('recovery.v5.stateVoting')}
          {armedId && timelockActive && t('recovery.v5.stateArmed', { letter: letterOf(armedId) })}
          {armedId && timelockExpired && t('recovery.stateReady')}
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: timelockExpired ? C.success : armedId ? C.gold : C.muted, lineHeight: 1.5 }}>
          {anyVote && !armedId && t('recovery.v5.needTwoSame')}
          {armedId && timelockActive && t('recovery.v5.armedWait', { time: formatCountdown(secsLeft) })}
          {armedId && timelockExpired && t('recovery.timelockExpiredAny')}
        </p>
        {isAgentWallet && (anyVote || armedId) && (
          <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: C.muted, lineHeight: 1.5 }}>
            {t('recovery.v5.agentsPausedNote')}
          </p>
        )}
      </div>

      {/* ── Proposed keys ── */}
      {proposals.length > 0 && (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '600', color: C.gold }}>{t('recovery.v5.proposalsTitle')}</p>
          <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: C.muted, lineHeight: '1.6' }}>{t('recovery.pendingKeyDesc')}</p>
          {proposals.map(p => (
            <div key={p.id} style={{ padding: '12px', marginBottom: '10px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: C.gold }}>{t('recovery.v5.keyLetter', { letter: p.letter })}</span>
                <span style={{ fontSize: '12px', color: p.id === armedId ? C.success : C.muted }}>
                  {t('recovery.v5.votesCount', { n: p.count })}{p.id === armedId ? ` · ${t('recovery.v5.armedBadge')}` : ''}
                </span>
              </div>
              {p.key ? keyBlock(p.key) : <p style={{ fontSize: '11px', color: C.subtle, margin: 0 }}>…</p>}
              {newKey && p.key && (
                <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: sameKey(p.key, newKey) ? C.success : C.error }}>
                  {sameKey(p.key, newKey) ? t('recovery.pendingKeyMatches') : t('recovery.pendingKeyDiffers')}
                </p>
              )}
              {connectedIsGuardian && p.key && myVote !== p.id && !newKey && (
                <button
                  onClick={() => { setCodeInput(toCode(p.key!)); setVerified(false); setFormError(null) }}
                  style={{ ...btnOutline, width: '100%', marginTop: '8px', fontSize: '12px' }}
                >
                  {t('recovery.v5.useThisKey')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Owner: new passkey ── */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: C.text }}>{t('recovery.ownerTitle')}</p>
        <p style={{ margin: '0 0 14px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>{t('recovery.v5.ownerDesc')}</p>
        {!newKey ? (
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
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: C.success }}>{t('recovery.v5.passkeyGenerated')}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={label}>{t('recovery.v5.codeLabel')}</span>
              <button onClick={handleCopy} style={{ fontSize: '11px', color: copied ? C.success : C.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {copied ? t('recovery.copied') : t('recovery.copy')}
              </button>
            </div>
            <div style={{ ...mono, color: C.muted, marginBottom: '10px' }}>{toCode(newKey)}</div>
            <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: C.warn, lineHeight: 1.5 }}>{t('recovery.v5.keepTabOpen')}</p>
            {newKeyIsOwner && (
              <button onClick={handleSaveNewKey} style={{ ...btnGold, width: '100%', marginTop: '4px' }}>
                {t('recovery.savePasskeyAndAccess')}
              </button>
            )}
            {!newKeyIsOwner && (
              <button
                onClick={() => { setNewKey(null); setNewCredentialId(null); setCodeInput(''); localStorage.removeItem(pendingKeyStorage) }}
                style={{ ...btnOutline, width: '100%', marginTop: '4px', fontSize: '12px' }}
              >
                {t('recovery.generateAnother')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Guardian: vote / withdraw / execute ── */}
      <div style={cardStyle}>
        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: C.text }}>{t('recovery.v5.guardianTitle')}</p>

        {!connectedAddress ? (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>{t('recovery.connectMetaMaskDesc')}</p>
            {injected && (
              <button onClick={() => connect({ connector: injected })} style={{ ...btnGold, width: '100%' }}>
                {t('recovery.connectMetaMask')}
              </button>
            )}
            <WcQrConnect label={t('recovery.connectWalletConnect')} style={{ ...btnOutline, width: '100%', marginTop: injected ? '8px' : 0 }} />
          </>
        ) : walletChainId !== chainId ? (
          <button onClick={() => switchChain({ chainId })} style={{ ...btnGold, width: '100%' }}>
            {t('recovery.switchNetwork').replace('{network}', network.name)}
          </button>
        ) : !connectedIsGuardian ? (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.muted }}>
              {t('recovery.notGuardian').replace('{addr}', shortAddr(connectedAddress))}
            </p>
            {injected && (
              <button onClick={() => connect({ connector: injected })} style={{ ...btnOutline, width: '100%' }}>
                {t('recovery.connectAnotherAccount')}
              </button>
            )}
            <button onClick={() => disconnect()} style={{ ...btnOutline, width: '100%', marginTop: injected ? '8px' : 0 }}>
              {t('recovery.disconnectWallet')}
            </button>
          </div>
        ) : (
          <div>
            {estimateError && <p style={{ fontSize: '12px', color: C.error, margin: '0 0 10px' }}>{estimateError}</p>}
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: C.success }}>
              {t('recovery.connectedAsGuardian').replace('{n}', String(connectedIdx + 1)).replace('{addr}', shortAddr(connectedAddress))}
            </p>

            {/* Ready: execute the armed key */}
            {timelockExpired && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.success }}>
                  {t('recovery.v5.readyDesc', { letter: letterOf(armedId!) })}
                </p>
                {txLine(execute.data, executeRc.isLoading, executeRc.isSuccess, execute.error)}
                {!executeRc.isSuccess && (
                  <button
                    onClick={handleExecute}
                    disabled={execute.isPending || executeRc.isLoading}
                    style={{ ...btnGold, width: '100%', opacity: execute.isPending || executeRc.isLoading ? 0.6 : 1 }}
                  >
                    {execute.isPending ? t('recovery.waitingSignature') : executeRc.isLoading ? t('recovery.confirming') : t('recovery.executeRecovery')}
                  </button>
                )}
              </div>
            )}

            {/* Vote for a key */}
            {!executeRc.isSuccess && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: C.muted, lineHeight: 1.5 }}>
                  {myVote !== ZERO32
                    ? t('recovery.v5.youVoted', { letter: letterOf(myVote) })
                    : t('recovery.v5.pasteCode')}
                </p>
                <textarea
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setVerified(false); setFormError(null) }}
                  placeholder="0x…:0x…:0x…"
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 12px', backgroundColor: C.card, border: `1px solid ${C.border}`,
                    borderRadius: '6px', color: C.text, fontSize: '11px', fontFamily: 'monospace', outline: 'none', resize: 'vertical',
                  }}
                />
                {codeInput.trim() && !parsed && (
                  <p style={{ fontSize: '12px', color: C.error, margin: '6px 0 0' }}>{t('recovery.v5.codeInvalid')}</p>
                )}
                {parsed && !parsedOnCurve && (
                  <p style={{ fontSize: '12px', color: C.error, margin: '6px 0 0' }}>{t('recovery.v5.keyNotOnCurve')}</p>
                )}
                {parsed && parsedOnCurve && (
                  <p style={{ fontSize: '11.5px', color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                    {parsedExisting
                      ? t('recovery.v5.codeIsExisting', { letter: parsedExisting.letter, n: parsedExisting.count })
                      : t('recovery.v5.codeIsNew')}
                  </p>
                )}
                {movesArmedVote && (
                  <p style={{ fontSize: '11.5px', color: C.warn, margin: '6px 0 0', lineHeight: 1.5 }}>{t('recovery.v5.movesArmedWarn')}</p>
                )}
                {formError && <p style={{ fontSize: '12px', color: C.error, margin: '8px 0 0' }}>{formError}</p>}

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '12px 0', fontSize: '11.5px', color: C.muted, lineHeight: '1.5', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={e => setVerified(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: C.gold, flexShrink: 0 }}
                  />
                  {t('recovery.v5.verifiedCheckbox')}
                </label>
                {txLine(vote.data, voteRc.isLoading, voteRc.isSuccess, vote.error)}
                <button
                  onClick={handleVote}
                  disabled={!verified || !parsed || !parsedOnCurve || votingSame || vote.isPending || voteRc.isLoading}
                  style={{
                    ...btnGold, width: '100%',
                    opacity: !verified || !parsed || !parsedOnCurve || votingSame || vote.isPending || voteRc.isLoading ? 0.5 : 1,
                    cursor: !verified || votingSame ? 'not-allowed' : 'pointer',
                  }}
                >
                  {vote.isPending ? t('recovery.waitingSignature')
                    : voteRc.isLoading ? t('recovery.confirming')
                    : votingSame ? t('recovery.v5.alreadyVotedThis')
                    : t('recovery.v5.voteBtn')}
                </button>

                {/* Withdraw my vote */}
                {myVote !== ZERO32 && (
                  <>
                    <div style={{ height: '10px' }} />
                    {txLine(withdraw.data, withdrawRc.isLoading, withdrawRc.isSuccess, withdraw.error)}
                    <button
                      onClick={handleWithdraw}
                      disabled={withdraw.isPending || withdrawRc.isLoading}
                      style={{ ...btnOutline, width: '100%', opacity: withdraw.isPending || withdrawRc.isLoading ? 0.6 : 1 }}
                    >
                      {withdraw.isPending ? t('recovery.waitingSignature') : withdrawRc.isLoading ? t('recovery.confirming') : t('recovery.v5.withdrawBtn')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
