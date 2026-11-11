'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi'
import { createPublicClient, formatEther, type Address } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useDeploySeed } from '@/lib/useCrossChainDeploy'
import { BVCC_WALLET_FACTORY_ABI, BVCC_AGENT_WALLET_FACTORY_ABI, BVCC_WALLET_FACTORY_V5_ABI } from '@/lib/abis'
import { signCredentialForWallet, toBytes32, encodeSetGuardians } from '@/lib/walletGeneration'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { getPrefundNeed } from '@/lib/prefund'
import { rpcTransport } from '@/lib/rpc'
import { discoverCredentialId, saveCredential, loadCredential, WrongPasskeyError } from '@/lib/webauthn'

const ZERO = '0x0000000000000000000000000000000000000000'

const GOLD = '#D4AF37'
const GOLD_GRADIENT = 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)'

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

// Botón "Desplegar en esta red" + modal. Se muestra en el dashboard cuando la
// wallet existe en otra red pero no en la activa. La wallet conectada
// (MetaMask/WC) paga el gas del createWallet, igual que en la creación.
export default function DeployOnNetwork({ address }: { address: string }) {
  const { network } = useNetwork()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const { address: connected, chainId: connectedChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { data: seed, isLoading: seedLoading } = useDeploySeed(address, network, open)
  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash, chainId: network.chainId })
  const queryClient = useQueryClient()

  // The credential is not needed to deploy — createWallet takes the key alone — but the
  // wallet needs it to sign afterwards. When neither this browser nor the chain vouches for
  // one, the passkey itself is asked, and checked against the signer before it is kept.
  const [recoveredCredId, setRecoveredCredId] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState<string | null>(null)
  // V5 only: the factory wants the passkey's signature over its credential id.
  const [signing, setSigning] = useState(false)

  // After the deploy, the same two steps as creating a wallet: fund it so it can pay for
  // its first signature, then register the guardians with the passkey.
  const { sendTransactionAsync } = useSendTransaction()
  const submitUserOp = useSubmitUserOp()
  const [setupPhase, setSetupPhase] = useState<'idle' | 'funding' | 'signing' | 'done' | 'stopped'>('idle')
  const [setupNote, setSetupNote] = useState<string | null>(null)
  const setupStarted = useRef(false)

  async function handleRecoverCredential() {
    if (!seed) return
    setRecovering(true)
    setRecoverError(null)
    try {
      const id = await discoverCredentialId({ pubKeyX: seed.pubKeyX, pubKeyY: seed.pubKeyY })
      saveCredential(id, address)
      setRecoveredCredId(id)
    } catch (err) {
      setRecoverError(err instanceof WrongPasskeyError ? t('dashboard.depWrongPasskey') : t('dashboard.depRecoverFailed'))
    } finally {
      setRecovering(false)
    }
  }

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries({ queryKey: ['accountStatus'] })
  }, [isSuccess, queryClient])

  /**
   * Leave the wallet able to pay for its own signature, then register the guardians it has
   * on the source network, signed with the passkey. Stops — and says why — before asking for
   * the passkey if the wallet still cannot pay, as the creation flow does.
   */
  async function finishSetup() {
    if (!seed) return
    const wallet = address as Address
    const stored = loadCredential()
    const credentialId = recoveredCredId ?? seed.credentialId
      ?? (stored?.walletAddress.toLowerCase() === wallet.toLowerCase() ? stored.credentialId : null)
    const guardians = seed.guardians
    if (!credentialId || guardians.some(g => !g || g.toLowerCase() === ZERO)) {
      setSetupPhase('stopped')
      setSetupNote(t('dashboard.depRecoveryPending'))
      return
    }
    setSetupNote(null)
    try {
      setSetupPhase('funding')
      const { missing } = await getPrefundNeed(wallet, network)
      if (missing > 0n) {
        const hash = await sendTransactionAsync({ to: wallet, value: missing, chainId: network.chainId, data: '0x' })
        const client = createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) })
        await client.waitForTransactionReceipt({ hash })
      }
      // A load-balanced RPC can answer from a node behind the receipt: look a few times.
      let funded = false
      let lastMissing = missing
      for (let i = 0; i < 5 && !funded; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 2000))
        const need = await getPrefundNeed(wallet, network)
        funded = need.available >= need.required
        lastMissing = need.missing
      }
      if (!funded) {
        setSetupPhase('stopped')
        setSetupNote(t('dashboard.depFundShort')
          .replace('{amount}', formatEther(lastMissing))
          .replace('{symbol}', network.nativeToken.symbol))
        return
      }

      setSetupPhase('signing')
      const callData = encodeSetGuardians(network.contracts.walletVersion, guardians as [Address, Address, Address], credentialId)
      await executeWithFaceId({
        network, walletAddress: wallet, credentialId,
        calls: [{ target: wallet, value: 0n, callData }],
        submitUserOp,
      })
      setSetupPhase('done')
      queryClient.invalidateQueries()
    } catch (err) {
      setSetupPhase('stopped')
      setSetupNote(t('dashboard.depSetupFailed').replace('{reason}', err instanceof Error ? err.message.slice(0, 160) : String(err)))
    }
  }

  useEffect(() => {
    if (!isSuccess || setupStarted.current) return
    setupStarted.current = true
    void finishSetup()
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const factoryAddr = seed?.walletType === 1 ? network.contracts.agentFactory : network.contracts.factory
  const isOnTargetChain = connectedChainId === network.chainId
  const isProcessing = isWriting || isConfirming || signing
  // createWallet derives the address from the key it is given. If that is not this wallet's
  // address — the owner key was rotated by a recovery, or the wallet predates this factory —
  // deploying would create a different wallet while funds keep arriving at the usual one.
  const addressMatches = !!seed?.targetAddress && seed.targetAddress.toLowerCase() === address.toLowerCase()

  async function handleDeploy() {
    if (!seed || !factoryAddr || !addressMatches) return
    if (network.contracts.walletVersion >= 5) {
      // V5: the factory deploys only with the passkey's signature over its credential id,
      // bound to this address — the same step as creating the wallet. The credential is
      // needed for that, so it has to be known (stored, read from the chain or recovered).
      const credentialId = recoveredCredId ?? seed.credentialId
      if (!credentialId) { setRecoverError(t('dashboard.depNeedCredential')); return }
      setRecoverError(null)
      setSigning(true)
      try {
        const { credential, credentialSig } = await signCredentialForWallet(address as `0x${string}`, credentialId)
        writeContract({
          address: factoryAddr,
          abi: BVCC_WALLET_FACTORY_V5_ABI,
          functionName: 'createWallet',
          args: [toBytes32(seed.pubKeyX), toBytes32(seed.pubKeyY), credential, credentialSig],
          chainId: network.chainId,
        })
      } catch {
        setRecoverError(t('dashboard.depRecoverFailed'))
      } finally {
        setSigning(false)
      }
      return
    }
    // V4: the factory only deploys. The guardians of the source network are NOT copied
    // here any more — they are registered on this network in a passkey-signed call, so
    // the deployer of an address never gets to choose who can rotate its owner.
    const args = [seed.pubKeyX, seed.pubKeyY] as const
    if (seed.walletType === 1) {
      writeContract({
        address: factoryAddr,
        abi: BVCC_AGENT_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    } else {
      writeContract({
        address: factoryAddr,
        abi: BVCC_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    }
  }

  function close() {
    setOpen(false)
    reset()
    setupStarted.current = false
    setSetupPhase('idle')
    setSetupNote(null)
  }

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }
  const lbl: React.CSSProperties = { fontSize: '11px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }
  const val: React.CSSProperties = { fontSize: '12px', color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'right' }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#06080f',
          background: GOLD_GRADIENT,
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 0 14px rgba(212,175,55,0.25)',
        }}
      >
        {t('dashboard.depBtn')}
      </button>

      {/* Rendered into <body>: the card this button sits in keeps a transform from its entry
          animation, and a transformed ancestor becomes the containing block of any fixed
          descendant — the overlay ended up the size of the card, cut off, under the page. */}
      {open && createPortal(
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.72)',
            display: 'flex', padding: '20px', overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              // Auto margins centre it, and unlike align-items: center they let a modal taller
              // than the screen scroll from its top instead of losing it.
              margin: 'auto',
              width: '100%', maxWidth: '420px',
              backgroundColor: '#0d1117',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              padding: '22px 24px',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#f0f4f8' }}>
              {t('dashboard.depTitle')} — {network.name}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#8892a4', lineHeight: 1.5 }}>
              {t('dashboard.depDesc')}
            </p>

            {seedLoading && (
              <p style={{ fontSize: '12px', color: '#8892a4' }}>{t('dashboard.depLoading')}</p>
            )}

            {!seedLoading && !seed && (
              <p style={{ fontSize: '12px', color: '#fc8181' }}>{t('dashboard.depNoSource')}</p>
            )}

            {!seedLoading && seed && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.depSameAddr')}</span>
                    <span style={{ ...val, color: GOLD }}>{shortAddr(address)}</span>
                  </div>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.accountType')}</span>
                    <span style={val}>{seed.walletType === 1 ? t('dashboard.typeAgent') : t('dashboard.typeSmart')}</span>
                  </div>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.depSource')}</span>
                    <span style={val}>{seed.sourceName}</span>
                  </div>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.accountGuardians')}</span>
                    <span style={{ ...val, color: '#8892a4' }}>{seed.guardians.map(shortAddr).join('  ')}</span>
                  </div>
                  <div style={{ ...row, borderBottom: 'none' }}>
                    <span style={lbl}>{t('dashboard.depCredential')}</span>
                    {seed.credentialId || recoveredCredId ? (
                      <span style={{ ...val, color: '#48bb78' }}>{t('dashboard.depCredFound')}</span>
                    ) : (
                      <button
                        onClick={handleRecoverCredential}
                        disabled={recovering}
                        style={{ fontSize: '11px', fontWeight: 600, color: GOLD, background: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '4px', padding: '4px 8px', cursor: recovering ? 'wait' : 'pointer', opacity: recovering ? 0.6 : 1 }}
                      >
                        {recovering ? t('dashboard.depRecovering') : t('dashboard.depRecoverCred')}
                      </button>
                    )}
                  </div>
                  {recoverError && (
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#fc8181' }}>{recoverError}</p>
                  )}
                </div>

                {isSuccess ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#48bb78', fontWeight: 600 }}>
                      ✓ {t('dashboard.depSuccess')}
                    </p>
                    {setupPhase === 'funding' && (
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#8892a4', lineHeight: 1.5 }}>{t('dashboard.depFunding')}</p>
                    )}
                    {setupPhase === 'signing' && (
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#8892a4', lineHeight: 1.5 }}>{t('dashboard.depSigningGuardians')}</p>
                    )}
                    {setupPhase === 'done' && (
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#48bb78', lineHeight: 1.5 }}>✓ {t('dashboard.depGuardiansDone')}</p>
                    )}
                    {setupPhase === 'stopped' && setupNote && (
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#e6b800', lineHeight: 1.5 }}>{setupNote}</p>
                    )}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {setupPhase === 'stopped' && (
                        <button onClick={() => void finishSetup()} style={{ padding: '9px 18px', fontSize: '12px', fontWeight: 600, color: GOLD, background: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '6px', cursor: 'pointer' }}>
                          {t('dashboard.depRetrySetup')}
                        </button>
                      )}
                      <button
                        onClick={close}
                        disabled={setupPhase === 'funding' || setupPhase === 'signing'}
                        style={{ padding: '9px 18px', fontSize: '12px', fontWeight: 600, color: '#06080f', background: GOLD_GRADIENT, border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: setupPhase === 'funding' || setupPhase === 'signing' ? 0.5 : 1 }}
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  </div>
                ) : !factoryAddr ? (
                  <p style={{ fontSize: '12px', color: '#fc8181' }}>{t('dashboard.depAgentMissing')}</p>
                ) : !seed.targetAddress ? (
                  <p style={{ fontSize: '12px', color: '#fc8181', lineHeight: 1.5 }}>{t('dashboard.depAddrUnverified')}</p>
                ) : !addressMatches ? (
                  <p style={{ fontSize: '12px', color: '#fc8181', lineHeight: 1.5 }}>
                    {t('dashboard.depAddrMismatch')
                      .replace('{target}', shortAddr(seed.targetAddress))
                      .replace('{address}', shortAddr(address))}
                  </p>
                ) : !connected ? (
                  <p style={{ fontSize: '12px', color: '#8892a4' }}>{t('dashboard.depConnect')}</p>
                ) : !isOnTargetChain ? (
                  <button
                    onClick={() => switchChain({ chainId: network.chainId })}
                    disabled={isSwitching}
                    style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 600, color: GOLD, backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '6px', cursor: 'pointer', opacity: isSwitching ? 0.6 : 1 }}
                  >
                    {t('dashboard.depSwitch')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDeploy}
                      disabled={isProcessing}
                      style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 600, color: '#06080f', background: GOLD_GRADIENT, border: 'none', borderRadius: '6px', cursor: isProcessing ? 'wait' : 'pointer', opacity: isProcessing ? 0.7 : 1, boxShadow: '0 0 18px rgba(212,175,55,0.3)' }}
                    >
                      {isProcessing ? t('dashboard.depDeploying') : t('dashboard.depAction')}
                    </button>
                    {writeError && (
                      <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#fc8181', wordBreak: 'break-word' }}>
                        {(writeError as Error).message.split('\n')[0].slice(0, 160)}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
