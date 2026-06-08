'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createPublicClient, http, type Address } from 'viem'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useViewNetworks } from '@/lib/useViewNetworks'
import type { NetworkConfig } from '@/lib/networks'
import { useMultiChainTokens, type WalletToken } from '@/lib/useTokens'
import { usePriceChart } from '@/lib/usePriceChart'
import { useWalletType } from '@/lib/useWalletType'
import RecoveryBanner from '@/components/RecoveryBanner'
import RecentTransactions from '@/components/RecentTransactions'
import AccountStatusCard from '@/components/AccountStatusCard'
import AgentsCard from '@/components/AgentsCard'
import Sparkline from '@/components/Sparkline'
import TokenDetailModal from '@/components/TokenDetailModal'
import ViewNetworksSelector from '@/components/ViewNetworksSelector'
import { useI18n } from '@/lib/i18n/I18nContext'

function fmtBalance(s: string): string {
  const n = parseFloat(s)
  if (!isFinite(n) || n === 0) return '0'
  if (n > 0 && n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function ChainBadge({ network }: { network: NetworkConfig }) {
  const [err, setErr] = useState(false)
  return (
    <span style={{
      position: 'absolute', right: -3, bottom: -3,
      width: 16, height: 16, borderRadius: '50%', overflow: 'hidden',
      border: '2px solid #0d1117', backgroundColor: network.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {!err && (
        <img
          src={network.logo}
          alt={network.shortName}
          width={16}
          height={16}
          style={{ width: 16, height: 16, objectFit: 'cover' }}
          onError={() => setErr(true)}
        />
      )}
    </span>
  )
}

function TokenIcon({ token }: { token: WalletToken }) {
  const [err, setErr] = useState(false)
  const showImg = token.logo && !err
  return (
    <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {showImg ? (
          <img
            src={token.logo}
            alt={token.symbol}
            width={36}
            height={36}
            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }}
            onError={() => setErr(true)}
          />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#8892a4' }}>{token.symbol.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <ChainBadge network={token.network} />
    </div>
  )
}

function TokenChartInline({ token }: { token: WalletToken }) {
  const { data: points, isLoading } = usePriceChart(token, token.network, 1)
  const values = (points ?? []).map(p => p[1])
  if (token.usdPrice === 0) return null
  if (isLoading && values.length < 2) return <div className="skeleton" style={{ width: '100%', height: 84, borderRadius: '8px' }} />
  if (values.length < 2) return null
  const up = values[values.length - 1] >= values[0]
  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <Sparkline points={values} width={600} height={84} color={up ? '#48bb78' : '#fc8181'} strokeWidth={1.75} responsive />
    </div>
  )
}

export default function WalletPage() {
  const router = useRouter()
  const { network, setNetworkByChainId } = useNetwork()
  const { networks: viewNetworks, chainIds: viewChainIds, toggle: toggleViewNetwork } = useViewNetworks()
  const { address: walletAddr, isLoaded } = useWalletAddress()
  const { t } = useI18n()

  // Enviar un token: si vive en otra red, cambiar la red de acción primero
  const goSend = (tk: WalletToken) => {
    if (tk.network.chainId !== network.chainId) setNetworkByChainId(tk.network.chainId)
    router.push(`/wallet/send?token=${tk.isNative ? tk.symbol : 'USDC'}`)
  }

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [address, setAddress] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [cancelling] = useState(false)

  const { tokens, totalUsd, isLoading: loading } = useMultiChainTokens(address || null, viewNetworks)
  const [selectedToken, setSelectedToken] = useState<WalletToken | null>(null)
  const { walletType } = useWalletType()

  useEffect(() => {
    if (!isLoaded) return
    if (walletAddr) {
      setAddress(walletAddr)
    } else {
      setIsPending(true)
    }
  }, [walletAddr, isLoaded])

  // Estado de recovery on-chain: con polling para reflejar aprobaciones/cancelaciones
  // del agente sin recargar la página.
  const { data: recovery } = useQuery({
    queryKey: ['recovery', address, network.chainId],
    enabled: !!address,
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [inProgress, approvals, readyAt] = await Promise.all([
        publicClient.readContract({
          address: address as Address, abi: BVCC_WALLET_ABI, functionName: 'recoveryInProgress',
        }).catch(() => false),
        publicClient.readContract({
          address: address as Address, abi: BVCC_WALLET_ABI, functionName: 'recoveryApprovals',
        }).catch(() => 0n),
        publicClient.readContract({
          address: address as Address, abi: BVCC_WALLET_ABI, functionName: 'recoveryReadyAt',
        }).catch(() => 0n),
      ])
      return {
        active: inProgress as boolean,
        approvals: Number(approvals as bigint),
        readyAt: (readyAt as bigint) > 0n ? (readyAt as bigint) : null,
      }
    },
  })
  const recoveryActive = recovery?.active ?? false
  const recoveryApprovals = recovery?.approvals ?? 0
  const recoveryReadyAt = recovery?.readyAt ?? null

  const short = address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .dash-page * { box-sizing: border-box; }
        .token-row { transition: background 0.12s; }
        .token-row:hover { background: rgba(255,255,255,0.02); }
        .action-btn { transition: opacity 0.15s, transform 0.1s; }
        .action-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .action-btn:active:not(:disabled) { transform: translateY(0); }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 4px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .fade-in { animation: fadeUp 0.3s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in:nth-child(2) { animation-delay: 0.06s; }
        .fade-in:nth-child(3) { animation-delay: 0.12s; }
        .fade-in:nth-child(4) { animation-delay: 0.18s; }
        .dash-grid { display: flex; gap: 16px; align-items: flex-start; }
        .dash-left { width: 1040px; flex-shrink: 1; min-width: 0; }
        .dash-right { flex: 1; min-width: 280px; }
        @media (max-width: 900px) {
          .dash-grid { flex-direction: column; }
          .dash-left { width: 100%; }
          .dash-right { width: 100%; flex: none; }
        }
      `}</style>

      <main className="dash-page" style={{
        minHeight: '100vh',
        backgroundColor: '#06080f',
        padding: '32px 32px 80px',
      }}>
        <div style={{ maxWidth: 'none', margin: 0 }}>

          {/* ── Header ──────────────────────────────────────── */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f0f4f8', letterSpacing: '-0.02em' }}>
              {t('dashboard.assets')}
            </h1>
            <ViewNetworksSelector selected={viewChainIds} onToggle={toggleViewNetwork} />
          </div>

          {/* ── Pending badge ────────────────────────────────── */}
          {isPending && (
            <div className="fade-in" style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '5px 11px', marginBottom: '20px',
              backgroundColor: 'rgba(212,175,55,0.06)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: '5px',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#D4AF37', display: 'block', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#D4AF37', fontWeight: '500' }}>{t('dashboard.pendingActivation')}</span>
            </div>
          )}

          {/* ── Recovery warning banner ──────────────────────── */}
          {recoveryActive && (
            <RecoveryBanner
              approvals={recoveryApprovals}
              readyAt={recoveryReadyAt}
              onCancel={() => router.push('/wallet/cancel-recovery')}
              cancelling={cancelling}
            />
          )}

          {/* ── Grid 2 columnas: izquierda activos / derecha cuenta+agentes ── */}
          <div className="dash-grid">
            <div className="dash-left">

          {/* ── Balance card ─────────────────────────────────── */}
          <div className="fade-in" style={{
            backgroundColor: '#0d1117',
            border: '1px solid rgba(255,255,255,0.07)',
            borderLeft: '3px solid rgba(212,175,55,0.35)',
            borderRadius: '8px',
            marginBottom: '12px',
            overflow: 'hidden',
          }}>
            {/* Total balance hero — en USD */}
            <div style={{ padding: '24px 24px 20px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#4a5568', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {t('dashboard.totalBalance')}
              </p>
              {loading ? (
                <div className="skeleton" style={{ width: '180px', height: '36px' }} />
              ) : (
                <p style={{
                  margin: 0, fontSize: '34px', fontWeight: '600',
                  color: '#f0f4f8', letterSpacing: '-0.04em',
                  fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1,
                }}>
                  <span style={{ fontSize: '18px', fontWeight: '400', color: '#8892a4', marginRight: '4px' }}>$</span>
                  {totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />

            {/* Token list — dinámica (solo los que tienes) */}
            <div style={{ padding: '8px 0' }}>
              {loading ? (
                [0, 1].map(i => (
                  <div key={i} className="token-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 24px' }}>
                    <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}><div className="skeleton" style={{ width: 90, height: 13 }} /></div>
                    <div className="skeleton" style={{ width: 64, height: 14 }} />
                  </div>
                ))
              ) : tokens.map((tk, idx) => (
                <div key={tk.key}>
                  {idx > 0 && <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)', margin: '0 24px' }} />}
                  <div
                    className="token-row"
                    onClick={() => setSelectedToken(tk)}
                    style={{ padding: '14px 24px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <TokenIcon token={tk} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '500', color: '#f0f4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tk.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4a5568' }}>{tk.symbol} · {tk.network.shortName}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em' }}>
                            {fmtBalance(tk.balanceFormatted)}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#8892a4', fontFamily: 'IBM Plex Mono, monospace' }}>
                              ${tk.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {tk.usdPrice > 0 && (
                              <span style={{
                                fontSize: '10px', fontWeight: '500', padding: '1px 5px', borderRadius: '3px',
                                color: tk.change24h >= 0 ? '#48bb78' : '#fc8181',
                                backgroundColor: tk.change24h >= 0 ? 'rgba(72,187,120,0.1)' : 'rgba(252,129,129,0.1)',
                              }}>
                                {tk.change24h >= 0 ? '+' : ''}{tk.change24h.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {(tk.isNative || tk.symbol === 'USDC') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); goSend(tk) }}
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '500', color: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}
                          >
                            {t('common.send')}
                          </button>
                        )}
                      </div>
                    </div>
                    <TokenChartInline token={tk} />
                  </div>
                </div>
              ))}
            </div>

            {/* Contract address footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 24px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              backgroundColor: 'rgba(255,255,255,0.01)',
            }}>
              <span style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t('dashboard.contract')}</span>
              <span style={{ fontSize: '12px', color: '#8892a4', fontFamily: 'IBM Plex Mono, monospace' }}>{short}</span>
            </div>
          </div>

          {/* ── Action buttons ───────────────────────────────── */}
          <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
            <button
              onClick={() => router.push('/wallet/send')}
              className="action-btn"
              style={{
                width: '140px', padding: '11px 0',
                backgroundColor: '#D4AF37', border: 'none',
                borderRadius: '6px', color: '#000',
                fontSize: '13.5px', fontWeight: '600',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              {t('dashboard.send')}
            </button>

            <button
              onClick={() => router.push('/wallet/receive')}
              className="action-btn"
              style={{
                width: '140px', padding: '11px 0',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: '#f0f4f8',
                fontSize: '13.5px', fontWeight: '500',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              {t('dashboard.receive')}
            </button>

            <button
              onClick={() => router.push('/wallet/swap')}
              className="action-btn"
              style={{
                width: '140px', padding: '11px 0',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', color: '#f0f4f8',
                fontSize: '13.5px', fontWeight: '500',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '7px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {t('dashboard.swap')}
            </button>
          </div>

          {/* ── Recent transactions ───────────────────────────── */}
          <div className="fade-in" style={{
            backgroundColor: '#0d1117',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#8892a4' }}>{t('dashboard.recentTransactions')}</p>
              <button
                onClick={() => router.push('/wallet/transactions')}
                style={{ fontSize: '11px', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8892a4')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >
                {t('dashboard.viewAll')}
              </button>
            </div>
            <RecentTransactions address={address} limit={5} />
          </div>

            </div>{/* /dash-left */}

            <div className="dash-right">
              <AccountStatusCard address={address} />
              {walletType === 1 && <AgentsCard address={address} />}
            </div>{/* /dash-right */}
          </div>{/* /dash-grid */}

        </div>

        {/* Modal de detalle de token */}
        {selectedToken && (
          <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />
        )}
      </main>
    </>
  )
}
