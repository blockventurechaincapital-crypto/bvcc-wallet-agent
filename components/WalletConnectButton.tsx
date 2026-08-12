'use client'
import { useState, useRef, useEffect } from 'react'
import { createPublicClient, http, type Hex } from 'viem'
import type { PendingRequestTypes } from '@walletconnect/types'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { getNetwork } from '@/lib/networks'
import { useWcWallet } from '@/lib/useWcWallet'
import WcConnectModal from '@/components/WcConnectModal'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
}

function IconWC() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
      <path d="M13 19c6.1-6 16-6 22.1 0l.7.7a.7.7 0 0 1 0 1l-2.4 2.4a.4.4 0 0 1-.5 0l-1-.9c-4.2-4.1-11-4.1-15.2 0l-1.1 1a.4.4 0 0 1-.5 0l-2.4-2.4a.7.7 0 0 1 0-1L13 19zm27.3 5.1 2.1 2.1a.7.7 0 0 1 0 1l-9.6 9.4a.7.7 0 0 1-1 0l-6.8-6.6a.2.2 0 0 0-.3 0l-6.8 6.6a.7.7 0 0 1-1 0L7.6 27.2a.7.7 0 0 1 0-1l2.1-2.1a.7.7 0 0 1 1 0l6.8 6.6c.1.1.2.1.3 0l6.8-6.6a.7.7 0 0 1 1 0l6.8 6.6c.1.1.2.1.3 0l6.8-6.6a.7.7 0 0 1 1 0z" fill="currentColor" />
    </svg>
  )
}

export default function WalletConnectButton() {
  const { address: walletAddr, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const { t } = useI18n()
  const {
    sessions, pendingRequests, ready, error: wcError,
    pair, respondSuccess, respondError, disconnect,
  } = useWcWallet(walletAddr, network.chainId)

  // Petición que el usuario decidió revisar (abre el modal de Face ID)
  const [activeRequest, setActiveRequest] = useState<PendingRequestTypes.Struct | null>(null)
  // Tx enviada y aún sin minar: bloquea firmar la siguiente para no pisar el
  // nonce del wallet (dos UserOps con el mismo nonce → la segunda revienta).
  const [inFlight, setInFlight] = useState<Hex | null>(null)
  const [open, setOpen] = useState(false)

  function trackTxUntilMined(txHash: Hex, request: PendingRequestTypes.Struct) {
    setInFlight(txHash)
    const c = request.params.chainId
    const reqChainId = c?.startsWith('eip155:') ? parseInt(c.slice(7), 10) : network.chainId
    let net = network
    try { net = getNetwork(reqChainId) } catch { /* red no soportada → red actual */ }
    const client = createPublicClient({ chain: net.viemChain, transport: http(net.rpcUrl) })
    client
      .waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
      .catch(() => { /* timeout/replaced: liberar igualmente */ })
      .finally(() => setInFlight(null))
  }
  const [mounted, setMounted] = useState(false)
  const [wcUri, setWcUri] = useState('')
  const [wcConnecting, setWcConnecting] = useState(false)
  const [wcPairError, setWcPairError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const sessionCount = sessions.length

  if (!mounted) return null

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          title="WalletConnect"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 11px', borderRadius: '7px',
            border: `1px solid ${open ? 'rgba(212,175,55,0.4)' : COLORS.border}`,
            background: open ? 'rgba(212,175,55,0.05)' : 'rgba(255,255,255,0.03)',
            color: sessionCount > 0 ? COLORS.gold : COLORS.textSecondary,
            fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s, color 0.15s',
            position: 'relative',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,175,55,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = open ? 'rgba(212,175,55,0.4)' : COLORS.border }}
        >
          <IconWC />
          {sessionCount > 0 && (
            <span style={{
              minWidth: '16px', height: '16px', padding: '0 4px',
              borderRadius: '8px', background: COLORS.gold, color: '#000',
              fontSize: '10px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {sessionCount}
            </span>
          )}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: '300px', backgroundColor: '#0d1117',
            border: `1px solid ${COLORS.border}`, borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
            zIndex: 200, padding: '14px',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>WalletConnect</p>
            <p style={{ margin: '0 0 12px', fontSize: '11px', color: COLORS.textSubtle }}>{t('dashboard.wcSubtitle')}</p>

            {wcError && (
              <div style={{
                padding: '8px 10px', marginBottom: '10px',
                background: 'rgba(252,129,129,0.06)', border: '1px solid rgba(252,129,129,0.2)',
                borderRadius: '5px', fontSize: '11px', color: '#fc8181',
                fontFamily: 'IBM Plex Mono, monospace',
              }}>{wcError}</div>
            )}

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={wcUri}
                onChange={e => { setWcUri(e.target.value); setWcPairError(null) }}
                placeholder={t('dashboard.wcInputPlaceholder')}
                disabled={!ready || wcConnecting}
                style={{
                  flex: 1, padding: '8px 10px', minWidth: 0,
                  background: 'rgba(255,255,255,0.03)',
                  border: wcPairError ? '1px solid rgba(252,129,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', color: COLORS.textPrimary, fontSize: '11px',
                  fontFamily: 'IBM Plex Mono, monospace', outline: 'none',
                  opacity: (!ready || wcConnecting) ? 0.5 : 1,
                }}
              />
              <button
                disabled={!ready || !wcUri.trim() || wcConnecting}
                onClick={async () => {
                  setWcConnecting(true); setWcPairError(null)
                  try { await pair(wcUri.trim()); setWcUri('') }
                  catch (e: unknown) { setWcPairError(e instanceof Error ? e.message : String(e)) }
                  finally { setWcConnecting(false) }
                }}
                style={{
                  padding: '8px 12px', flexShrink: 0,
                  background: (!ready || !wcUri.trim() || wcConnecting) ? 'rgba(212,175,55,0.3)' : COLORS.gold,
                  border: 'none', borderRadius: '6px', color: '#000',
                  fontSize: '12px', fontWeight: 600,
                  cursor: (!ready || !wcUri.trim() || wcConnecting) ? 'not-allowed' : 'pointer',
                }}
              >
                {wcConnecting ? t('dashboard.wcConnecting') : t('dashboard.wcConnect')}
              </button>
            </div>

            {wcPairError && (
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#fc8181', fontFamily: 'IBM Plex Mono, monospace', wordBreak: 'break-word' }}>{wcPairError}</p>
            )}

            {ready && sessionCount === 0 && !wcUri && (
              <p style={{ margin: '10px 0 0', fontSize: '11px', color: COLORS.textSubtle }}>{t('dashboard.wcHint')}</p>
            )}

            {sessionCount > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '10px', color: COLORS.textSubtle, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {t('dashboard.wcActiveSessions')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sessions.map(s => (
                    <div key={s.topic} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px',
                    }}>
                      {s.peer.metadata.icons[0] ? (
                        <img src={s.peer.metadata.icons[0]} alt="" width={20} height={20}
                          style={{ borderRadius: '4px', flexShrink: 0, objectFit: 'contain' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: COLORS.textSubtle }}>?</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: COLORS.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.peer.metadata.name}</p>
                        <p style={{ margin: '1px 0 0', fontSize: '10px', color: COLORS.textSubtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.peer.metadata.url}</p>
                      </div>
                      <button onClick={() => disconnect(s.topic)} title={t('common.disconnect')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: COLORS.textSubtle, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fc8181' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = COLORS.textSubtle }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bandeja de firmas pendientes (estilo Safe): caja flotante con botón
          para revisar — el modal con Face ID solo se abre al pulsarlo */}
      {pendingRequests.length > 0 && !activeRequest && walletAddr && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 900,
          display: 'flex', flexDirection: 'column', gap: 10,
          width: 320, maxWidth: 'calc(100vw - 40px)',
        }}>
          {pendingRequests.map((req, idx) => {
            const session = sessions.find(s => s.topic === req.topic)
            const meta = session?.peer.metadata
            const method = req.params.request.method
            const isTx = method === 'eth_sendTransaction'
            // Estrictamente secuencial: solo la petición más antigua es accionable,
            // y solo si no hay una tx anterior aún sin minar.
            const blocked = idx > 0 || inFlight !== null
            return (
              <div key={req.id} style={{
                background: '#0d1117',
                border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: COLORS.gold, boxShadow: '0 0 8px rgba(212,175,55,0.8)',
                    animation: 'wcPulse 1.6s ease-in-out infinite',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
                      {t('connect.pendingTitle')}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: COLORS.textSubtle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t('connect.pendingFrom')} {meta?.name ?? 'dApp'} · {isTx ? t('connect.pendingTx') : t('connect.pendingSignature')}
                    </p>
                  </div>
                  {meta?.icons?.[0] && (
                    <img src={meta.icons[0]} alt="" width={24} height={24}
                      style={{ borderRadius: 5, flexShrink: 0, objectFit: 'contain' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => respondError(req.topic, req.id, 'User rejected the request')}
                    style={{
                      flex: 1, padding: '8px 0', background: 'transparent',
                      border: '1px solid rgba(252,129,129,0.25)', borderRadius: 7,
                      color: '#fc8181', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {t('connect.reject')}
                  </button>
                  <button
                    onClick={() => !blocked && setActiveRequest(req)}
                    disabled={blocked}
                    style={{
                      flex: 2, padding: '8px 0',
                      background: blocked ? 'rgba(212,175,55,0.25)' : COLORS.gold,
                      border: 'none', borderRadius: 7, color: blocked ? 'rgba(0,0,0,0.6)' : '#000',
                      fontSize: 12, fontWeight: 600,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {inFlight !== null && idx === 0
                      ? t('connect.pendingWaiting')
                      : idx > 0
                        ? t('connect.pendingQueued')
                        : t('connect.pendingSign')}
                  </button>
                </div>
              </div>
            )
          })}
          <style>{`@keyframes wcPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
        </div>
      )}

      {activeRequest && walletAddr && (
        <WcConnectModal
          request={activeRequest}
          walletAddress={walletAddr}
          credentialId={credentialId}
          onApprove={(result) => {
            respondSuccess(activeRequest.topic, activeRequest.id, result)
            // Si era una tx, bloquear la siguiente firma hasta que mine
            if (activeRequest.params.request.method === 'eth_sendTransaction') {
              trackTxUntilMined(result as Hex, activeRequest)
            }
            setActiveRequest(null)
          }}
          // Contestar a la dApp sin cerrar: el modal se queda enseñando el
          // resultado hasta que el usuario lo cierre, pero la dApp ya tiene su
          // respuesta y no depende de que nadie pulse nada.
          onRespond={(result) => {
            respondSuccess(activeRequest.topic, activeRequest.id, result)
            if (activeRequest.params.request.method === 'eth_sendTransaction') {
              trackTxUntilMined(result as Hex, activeRequest)
            }
          }}
          onClose={() => setActiveRequest(null)}
          onReject={() => {
            respondError(activeRequest.topic, activeRequest.id, 'User rejected the request')
            setActiveRequest(null)
          }}
        />
      )}
    </>
  )
}
