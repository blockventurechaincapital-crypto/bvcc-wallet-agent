'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPublicClient, http, type Address } from 'viem'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid rgba(255,255,255,0.08)',
      borderTopColor: COLORS.textSubtle,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 12px',
      fontSize: '10px',
      fontWeight: '600',
      color: COLORS.textSubtle,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      {children}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: last ? 'none' : `1px solid rgba(255,255,255,0.04)`,
    }}>
      {children}
    </div>
  )
}

function AddressRow({
  label,
  address,
  arbiscanUrl,
  copyLabel,
  notAvailableLabel,
}: {
  label?: string
  address: string | null
  arbiscanUrl?: string
  copyLabel: string
  notAvailableLabel: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const short = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : notAvailableLabel

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        {label && (
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: COLORS.textSubtle }}>{label}</p>
        )}
        <span style={{
          fontSize: '12px',
          fontFamily: 'IBM Plex Mono, monospace',
          color: address ? COLORS.textSecondary : COLORS.textSubtle,
          letterSpacing: '-0.01em',
        }}>
          {short}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {address && (
          <>
            <button
              onClick={copy}
              title={copyLabel}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px',
                background: copied ? 'rgba(56,161,105,0.08)' : 'rgba(255,255,255,0.04)',
                border: copied ? '1px solid rgba(56,161,105,0.2)' : `1px solid ${COLORS.border}`,
                borderRadius: '4px',
                color: copied ? '#68d391' : COLORS.textSubtle,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? '✓' : copyLabel}
            </button>
            {arbiscanUrl && (
              <a
                href={arbiscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Arbiscan"
                style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  padding: '4px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '4px',
                  color: COLORS.textSubtle,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = COLORS.textSecondary)}
                onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSubtle)}
              >
                <IconExternal />
                Arbiscan
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { network } = useNetwork()
  const { address: walletAddress, credentialId, isLoaded } = useWalletAddress()
  const { t } = useI18n()

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [feeWallet, setFeeWallet] = useState<string | null>(null)
  const [guardians, setGuardians] = useState<(string | null)[]>([null, null, null])
  const [loadingChain, setLoadingChain] = useState(false)
  const [chainError, setChainError] = useState(false)

  useEffect(() => {
    if (!isLoaded || !walletAddress) return
    setLoadingChain(true)
    setChainError(false)

    Promise.all([
      publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'BVCC_FEE_WALLET',
      }).catch(() => null),
      publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'guardians',
        args: [0n],
      }).catch(() => null),
      publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'guardians',
        args: [1n],
      }).catch(() => null),
      publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'guardians',
        args: [2n],
      }).catch(() => null),
    ])
      .then(([fee, g0, g1, g2]) => {
        setFeeWallet(fee as string | null)
        setGuardians([
          g0 as string | null,
          g1 as string | null,
          g2 as string | null,
        ])
      })
      .catch(() => setChainError(true))
      .finally(() => setLoadingChain(false))
  }, [isLoaded, walletAddress])

  const handleSignOut = () => {
    localStorage.removeItem('bvcc_active_wallet')
    router.push('/')
  }

  const handleClearAll = () => {
    if (!window.confirm(t('settings.clearConfirm'))) return
    localStorage.removeItem('bvcc_wallet_credential')
    localStorage.removeItem('bvcc_active_wallet')
    localStorage.removeItem('bvcc_guardians')
    localStorage.removeItem('bvcc_address_book')
    router.push('/')
  }

  const credDisplay = credentialId
    ? `${credentialId.slice(0, 20)}...`
    : t('settings.notAvailable')

  const arbiscanBase = 'https://sepolia.arbiscan.io/address/'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .settings-section { animation: fadeUp 0.25s ease both; }
        .settings-section:nth-child(2) { animation-delay: 0.05s; }
        .settings-section:nth-child(3) { animation-delay: 0.1s; }
        .settings-section:nth-child(4) { animation-delay: 0.15s; }
        .btn-danger:hover { background: rgba(252,129,129,0.12) !important; }
        .btn-outline:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      <main style={{
        minHeight: '100vh',
        backgroundColor: COLORS.bg,
        padding: '32px 28px 80px',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          {/* Back button */}
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: COLORS.textSecondary, fontSize: '13px', padding: '0',
              marginBottom: '28px', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = COLORS.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSecondary)}
          >
            <IconBack />
            {t('settings.back')}
          </button>

          {/* Page title */}
          <h1 style={{
            fontSize: '20px', fontWeight: '600', color: COLORS.textPrimary,
            letterSpacing: '-0.02em', margin: '0 0 32px',
          }}>
            {t('settings.title')}
          </h1>

          {/* ── Sección 1: Red actual ─────────────────────────── */}
          <div className="settings-section" style={{ marginBottom: '28px' }}>
            <SectionLabel>{t('settings.sectionNetwork')}</SectionLabel>
            <Card>
              <Row>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38a169', display: 'block', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: COLORS.textPrimary }}>Arbitrum Sepolia</span>
                  </div>
                  <span style={{
                    fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace',
                    color: COLORS.textSubtle, padding: '2px 7px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.border}`, borderRadius: '4px',
                  }}>
                    Chain ID 421614
                  </span>
                </div>
              </Row>
              <Row>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: COLORS.textSubtle }}>{t('settings.entryPoint')}</p>
                <span style={{ fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', color: COLORS.textSecondary, wordBreak: 'break-all' }}>
                  0x433709009B8330FDa32311DF1C2AFA402eD8D009
                </span>
              </Row>
              <Row last>
                {walletAddress ? (
                  <a
                    href={`${arbiscanBase}${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      fontSize: '13px', fontWeight: '500', color: COLORS.gold,
                      textDecoration: 'none', transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <IconExternal />
                    {t('settings.viewOnArbiscan')}
                  </a>
                ) : (
                  <span style={{ fontSize: '13px', color: COLORS.textSubtle }}>{t('settings.noActiveWallet')}</span>
                )}
              </Row>
            </Card>
          </div>


          {/* ── Sección 3: Guardians ──────────────────────────── */}
          <div className="settings-section" style={{ marginBottom: '28px' }}>
            <SectionLabel>{t('settings.sectionGuardians')}</SectionLabel>
            <Card>
              {guardians.map((g, i) => (
                <Row key={i} last={i === 2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      flexShrink: 0,
                      width: '20px', height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${COLORS.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', color: COLORS.textSubtle, fontWeight: '600',
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {loadingChain ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Spinner />
                          <span style={{ fontSize: '12px', color: COLORS.textSubtle }}>{t('settings.loading')}</span>
                        </div>
                      ) : (
                        <AddressRow
                          address={g}
                          arbiscanUrl={g ? `${arbiscanBase}${g}` : undefined}
                          copyLabel={t('settings.copyBtn')}
                          notAvailableLabel={t('settings.notAvailable')}
                        />
                      )}
                    </div>
                  </div>
                </Row>
              ))}
              <div style={{
                padding: '12px 20px',
                borderTop: `1px solid rgba(255,255,255,0.04)`,
                backgroundColor: 'rgba(255,255,255,0.01)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              }}>
                <p style={{ margin: 0, fontSize: '11px', color: COLORS.textSubtle, lineHeight: '1.5' }}>
                  {t('settings.guardiansHint')}
                </p>
                <button
                  onClick={() => router.push('/recover')}
                  className="btn-outline"
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '5px',
                    color: COLORS.textSecondary,
                    fontSize: '12px', fontWeight: '500',
                    cursor: 'pointer', transition: 'background 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('settings.manageRecovery')}
                </button>
              </div>
            </Card>
          </div>

          {/* ── Sección 4: Sesión y datos ─────────────────────── */}
          <div className="settings-section" style={{ marginBottom: '28px' }}>
            <SectionLabel>{t('settings.sectionSession')}</SectionLabel>
            <Card>
              <Row>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: COLORS.textSubtle }}>{t('settings.credentialId')}</p>
                <span style={{
                  fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace',
                  color: COLORS.textSecondary, wordBreak: 'break-all',
                }}>
                  {credDisplay}
                </span>
              </Row>
              <Row>
                <button
                  onClick={handleSignOut}
                  className="btn-outline"
                  style={{
                    width: '100%', padding: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '6px',
                    color: COLORS.textSecondary,
                    fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('settings.signOut')}
                </button>
              </Row>
              <Row last>
                <button
                  onClick={handleClearAll}
                  className="btn-danger"
                  style={{
                    width: '100%', padding: '10px',
                    background: 'rgba(252,129,129,0.06)',
                    border: '1px solid rgba(252,129,129,0.2)',
                    borderRadius: '6px',
                    color: '#fc8181',
                    fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  {t('settings.clearAll')}
                </button>
              </Row>
            </Card>
          </div>

          {/* ── Sección 5: Legal ──────────────────────────────── */}
          <div className="settings-section" style={{ marginBottom: '28px' }}>
            <SectionLabel>{t('legal.footerHeading')}</SectionLabel>
            <Card>
              <Row last>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[
                    { href: '/legal/terms', key: 'terms' },
                    { href: '/legal/risk-disclosure', key: 'risk' },
                    { href: '/legal/non-custodial', key: 'nonCustodial' },
                    { href: '/legal/agent-wallet', key: 'agent' },
                    { href: '/legal/swap-fast', key: 'swap' },
                    { href: '/legal/fees', key: 'fees' },
                    { href: '/legal/privacy', key: 'privacy' },
                  ].map((l, i, arr) => (
                    <Link
                      key={l.key}
                      href={l.href}
                      style={{
                        padding: '10px 2px',
                        fontSize: '13px',
                        color: COLORS.textSecondary,
                        textDecoration: 'none',
                        borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      {t(`legal.nav.${l.key}`)}
                      <span style={{ color: COLORS.textSubtle }}>›</span>
                    </Link>
                  ))}
                </div>
              </Row>
            </Card>
          </div>

          {/* Version footer */}
          <p style={{
            textAlign: 'center',
            fontSize: '11px',
            color: COLORS.textSubtle,
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.05em',
            marginTop: '8px',
          }}>
            BVCC Wallet · {t('settings.version')} · {network.shortName}
          </p>

        </div>
      </main>
    </>
  )
}
