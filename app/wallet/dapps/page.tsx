'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useWcWallet } from '@/lib/useWcWallet'
import { useI18n } from '@/lib/i18n/I18nContext'
import { DAPPS, type Category, type DApp } from '@/lib/dapps'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  borderHover: 'rgba(255,255,255,0.14)',
  gold: '#D4AF37',
  goldBg: 'rgba(212,175,55,0.08)',
  goldBgActive: 'rgba(212,175,55,0.10)',
  goldBorder: 'rgba(212,175,55,0.30)',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
  success: '#22c55e',
  successBg: 'rgba(34,197,94,0.08)',
  error: '#f87171',
  errorBg: 'rgba(248,113,113,0.08)',
}

// ─── Chain metadata ────────────────────────────────────────────────────────────
const CHAIN_COLOR: Record<number, string> = {
  1: '#627EEA',
  8453: '#0052FF',
  42161: '#28A0F0',
  56: '#F3BA2F',
}

const CHAIN_NAME: Record<number, string> = {
  1: 'ETH',
  8453: 'Base',
  42161: 'Arb',
  56: 'BNB',
}

// ─── dApps data ────────────────────────────────────────────────────────────────
// The curated dApp list + the DApp/Category types now live in lib/dapps.ts,
// shared with the iframe-check API route so both use one source of truth.
// Categories used internally for filtering — not translated (stable keys).
const CATEGORIES: Category[] = ['All', 'DEX', 'Lending', 'Bridge', 'Yield', 'NFT', 'Prediction', 'Tools']

// ─── Sub-components ────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function IconExternalLink() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function IconWalletConnect() {
  // WalletConnect logo simplified as a two-arc wave icon
  return (
    <svg width="22" height="22" viewBox="0 0 300 185" fill="none">
      <path
        d="M61.4 36.7c48.9-48.9 128.3-48.9 177.2 0l5.9 5.9a6.1 6.1 0 0 1 0 8.6l-20.1 20.1a3.2 3.2 0 0 1-4.5 0l-8.1-8.1c-34.1-34.1-89.4-34.1-123.5 0l-8.7 8.7a3.2 3.2 0 0 1-4.5 0L54.9 51.8a6.1 6.1 0 0 1 0-8.6l6.5-6.5zm218.7 40.8 17.9 17.9a6.1 6.1 0 0 1 0 8.6L193.8 207.1a6.1 6.1 0 0 1-8.6 0l-67.5-67.5a1.6 1.6 0 0 0-2.3 0l-67.5 67.5a6.1 6.1 0 0 1-8.6 0L-64.5 104a6.1 6.1 0 0 1 0-8.6l17.9-17.9a6.1 6.1 0 0 1 8.6 0l67.5 67.5a1.6 1.6 0 0 0 2.3 0l67.5-67.5a6.1 6.1 0 0 1 8.6 0l67.5 67.5a1.6 1.6 0 0 0 2.3 0l67.5-67.5a6.1 6.1 0 0 1 8.6 0z"
        fill="#3B99FC"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconDisconnectSession() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconEmpty() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSubtle }}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}

// dApp icon — colored circle with the first letter
function DAppIcon({ name, color, size = 44, logo }: { name: string; color: string; size?: number; logo?: string }) {
  const [imgError, setImgError] = useState(false)

  if (logo && !imgError) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size <= 30 ? '7px' : '10px',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: color + '22',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src={logo}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
        />
      </div>
    )
  }

  // Determine text color: use white for dark backgrounds, near-black for very light ones
  const isDark = (hex: string) => {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    // Perceived luminance
    return (r * 299 + g * 587 + b * 114) / 1000 < 140
  }
  const textColor = isDark(color) ? '#ffffff' : '#0d0d0d'

  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: size <= 30 ? '7px' : '10px',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: '700',
      fontSize: size <= 30 ? '12px' : '18px',
      color: textColor,
      letterSpacing: '-0.03em',
      userSelect: 'none',
    }}>
      {name[0].toUpperCase()}
    </div>
  )
}

// Category badge pill — displays the category key as-is (DEX, Lending, etc. are proper nouns)
function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    DEX: 'rgba(255,0,122,0.12)',
    Lending: 'rgba(182,80,158,0.12)',
    Bridge: 'rgba(147,51,234,0.12)',
    Yield: 'rgba(0,163,255,0.12)',
    NFT: 'rgba(32,129,226,0.12)',
    Prediction: 'rgba(16,185,129,0.12)',
    Tools: 'rgba(120,79,253,0.12)',
  }
  const textMap: Record<string, string> = {
    DEX: '#ff5fa8',
    Lending: '#d47ec0',
    Bridge: '#b67ef7',
    Yield: '#5ac8ff',
    NFT: '#6aaef7',
    Prediction: '#34d399',
    Tools: '#b09bfd',
  }
  return (
    <span style={{
      fontSize: '10px',
      fontFamily: 'IBM Plex Mono, monospace',
      fontWeight: '500',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      padding: '2px 7px',
      borderRadius: '4px',
      backgroundColor: colorMap[category] ?? 'rgba(255,255,255,0.05)',
      color: textMap[category] ?? C.textSecondary,
    }}>
      {category}
    </span>
  )
}

// Single dApp card
function DAppCard({ dapp, activeChainId, onOpen, openLabel }: { dapp: DApp; activeChainId: number; onOpen: (dapp: DApp) => void; openLabel: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: C.card,
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        borderRadius: '8px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        cursor: 'default',
      }}
    >
      {/* Top row: icon + name + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <DAppIcon name={dapp.name} color={dapp.color} logo={dapp.logo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: C.textPrimary,
            marginBottom: '4px',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {dapp.name}
          </div>
          <CategoryBadge category={dapp.category} />
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '12.5px',
        lineHeight: '1.55',
        color: C.textSecondary,
        margin: 0,
        flex: 1,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {dapp.desc}
      </p>

      {/* Bottom row: chain dots + open button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* Chain dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {dapp.chains.map((chainId) => {
            const isActive = chainId === activeChainId
            return (
              <div
                key={chainId}
                title={CHAIN_NAME[chainId] ?? String(chainId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span style={{
                  width: isActive ? '7px' : '6px',
                  height: isActive ? '7px' : '6px',
                  borderRadius: '50%',
                  backgroundColor: CHAIN_COLOR[chainId] ?? '#888',
                  display: 'inline-block',
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.5,
                  boxShadow: isActive ? `0 0 5px ${CHAIN_COLOR[chainId]}80` : 'none',
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                }} />
                {isActive && (
                  <span style={{
                    fontSize: '9px',
                    fontFamily: 'IBM Plex Mono, monospace',
                    color: CHAIN_COLOR[chainId] ?? C.textSubtle,
                    letterSpacing: '0.03em',
                    fontWeight: '600',
                  }}>
                    {CHAIN_NAME[chainId]}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Open button */}
        <button
          onClick={() => onOpen(dapp)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '12px',
            fontWeight: '500',
            color: C.textSecondary,
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            padding: '5px 11px',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = C.goldBg
            el.style.borderColor = C.goldBorder
            el.style.color = C.gold
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = 'rgba(255,255,255,0.04)'
            el.style.borderColor = C.border
            el.style.color = C.textSecondary
          }}
        >
          {openLabel}
        </button>
      </div>
    </div>
  )
}

// ─── DApp iframe viewer ─────────────────────────────────────────────────────
function DAppViewer({ dapp, onClose, backLabel, openNewTabLabel, openNewTabTitle, blockedTitle, blockedDetail, loadingLabel }: {
  dapp: DApp
  onClose: () => void
  backLabel: string
  openNewTabLabel: string
  openNewTabTitle: string
  blockedTitle: string
  blockedDetail: string
  loadingLabel: string
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'blocked'>('loading')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Server-side header check — reliable detection before trying to load
  useEffect(() => {
    let cancelled = false
    fetch(`/api/check-iframe?url=${encodeURIComponent(dapp.url)}`)
      .then((r) => r.json())
      .then(({ allowed }: { allowed: boolean }) => {
        if (!cancelled && !allowed) setStatus('blocked')
      })
      .catch(() => {}) // on error, proceed with iframe + fallback
    return () => { cancelled = true }
  }, [dapp.url])

  // Fallback: if no load event after 8s assume blocked
  useEffect(() => {
    const t = setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'blocked' : s))
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  function handleLoad() {
    try {
      const doc = iframeRef.current?.contentWindow?.document
      if (!doc?.body?.childNodes.length) {
        setStatus('blocked')
      } else {
        setStatus('loaded')
      }
    } catch {
      // SecurityError = cross-origin content loaded successfully
      setStatus('loaded')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Browser bar ── */}
      <div style={{
        height: '48px',
        flexShrink: 0,
        borderBottom: `1px solid ${C.border}`,
        backgroundColor: C.card,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 14px',
      }}>
        {/* Back */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            padding: '5px 10px',
            cursor: 'pointer',
            color: C.textSecondary,
            fontSize: '12px',
            fontWeight: '500',
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.borderHover
            e.currentTarget.style.color = C.textPrimary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border
            e.currentTarget.style.color = C.textSecondary
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {backLabel}
        </button>

        {/* Icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <DAppIcon name={dapp.name} color={dapp.color} size={26} logo={dapp.logo} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: C.textPrimary, letterSpacing: '-0.01em' }}>
            {dapp.name}
          </span>
        </div>

        {/* URL pill */}
        <div style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '11.5px',
          fontFamily: 'IBM Plex Mono, monospace',
          color: C.textSubtle,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dapp.url}
        </div>

        {/* Open in new tab */}
        <a
          href={dapp.url}
          target="_blank"
          rel="noopener noreferrer"
          title={openNewTabTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px',
            borderRadius: '5px',
            color: C.textSubtle,
            flexShrink: 0,
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = C.gold
            e.currentTarget.style.background = C.goldBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.textSubtle
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <IconExternalLink />
        </a>
      </div>

      {/* ── Content area ── */}
      {status === 'blocked' ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '18px',
          backgroundColor: C.bg,
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            backgroundColor: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: C.textPrimary, marginBottom: '8px', letterSpacing: '-0.01em' }}>
              {dapp.name} {blockedTitle}
            </div>
            <div style={{ fontSize: '13px', color: C.textSecondary, maxWidth: '360px', lineHeight: '1.6' }}>
              {blockedDetail}
            </div>
          </div>
          <a
            href={dapp.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#000',
              backgroundColor: C.gold,
              borderRadius: '7px',
              padding: '9px 22px',
              textDecoration: 'none',
              transition: 'filter 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1.1)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1)' }}
          >
            {openNewTabLabel}
            <IconExternalLink />
          </a>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {status === 'loading' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              backgroundColor: C.bg,
              zIndex: 1,
            }}>
              <span style={{
                width: '28px',
                height: '28px',
                border: `3px solid ${C.border}`,
                borderTop: `3px solid ${C.gold}`,
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'wc-spin 0.7s linear infinite',
              }} />
              <span style={{ fontSize: '12.5px', color: C.textSubtle }}>
                {loadingLabel} {dapp.name}...
              </span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={dapp.url}
            onLoad={handleLoad}
            // Delega Permissions-Policy al origen del iframe. Sin esto, las dApps
            // cross-origin no pueden usar navigator.clipboard (copiar el URI de
            // WalletConnect falla silenciosamente con NotAllowedError).
            allow="clipboard-write; clipboard-read"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              backgroundColor: C.bg,
            }}
            title={dapp.name}
          />
        </div>
      )}
    </div>
  )
}

// Active WC session row
function SessionRow({ session, onDisconnect, disconnectLabel, disconnectTitle, confirmLabel }: {
  session: { topic: string; peer: { metadata: { name: string; url: string; icons: string[] } } }
  onDisconnect: (topic: string) => void
  disconnectLabel: string
  disconnectTitle: string
  confirmLabel: string
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      backgroundColor: 'rgba(59,153,252,0.05)',
      border: '1px solid rgba(59,153,252,0.15)',
      borderRadius: '8px',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: C.success,
        flexShrink: 0,
        boxShadow: `0 0 6px ${C.success}80`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: C.textPrimary, letterSpacing: '-0.01em' }}>
          {session.peer.metadata.name}
        </div>
        <div style={{
          fontSize: '11px',
          color: C.textSubtle,
          fontFamily: 'IBM Plex Mono, monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {session.peer.metadata.url}
        </div>
      </div>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          title={disconnectTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: '500',
            color: C.textSubtle,
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: '5px',
            padding: '4px 9px',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171'
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = C.textSubtle
            e.currentTarget.style.borderColor = C.border
          }}
        >
          <IconDisconnectSession />
          {disconnectLabel}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => onDisconnect(session.topic)}
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#f87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: '5px',
              padding: '4px 9px',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '11px',
              color: C.textSubtle,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '5px',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            <IconX />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function DAppsPage() {
  const { address } = useWalletAddress()
  const { network } = useNetwork()
  const { pair, ready, sessions, disconnect } = useWcWallet(address, network.chainId)
  const { t } = useI18n()

  const [activeDapp, setActiveDapp] = useState<DApp | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [wcUri, setWcUri] = useState('')
  const [connectStatus, setConnectStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle')
  const [connectError, setConnectError] = useState('')

  // Map from internal category key to display label
  const categoryLabel = (cat: Category): string => {
    if (cat === 'All') return t('dapps.catAll')
    if (cat === 'Tools') return t('dapps.catTools')
    if (cat === 'Prediction') return t('dapps.catPrediction')
    return cat // DEX, Lending, Bridge, Yield, NFT — kept as-is (proper nouns / technical terms)
  }

  const filtered = useMemo(() => {
    return DAPPS.filter((d) => {
      const matchesCategory = activeCategory === 'All' || d.category === activeCategory
      const q = search.toLowerCase().trim()
      const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [search, activeCategory])

  async function handleConnect() {
    if (!wcUri.trim() || !ready) return
    setConnectError('')
    setConnectStatus('connecting')
    try {
      await pair(wcUri.trim())
      setWcUri('')
      setConnectStatus('success')
      setTimeout(() => setConnectStatus('idle'), 3000)
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e))
      setConnectStatus('error')
    }
  }

  // ── iframe viewer ──────────────────────────────────────────────────────────
  if (activeDapp) {
    return (
      <>
        <style>{`
          .dapp-viewer-wrap {
            height: calc(100vh - 52px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          @media (max-width: 767px) {
            .dapp-viewer-wrap { height: calc(100vh - 52px - 56px); }
          }
          @keyframes wc-spin { to { transform: rotate(360deg); } }
        `}</style>
        <div className="dapp-viewer-wrap">
          <DAppViewer
            dapp={activeDapp}
            onClose={() => setActiveDapp(null)}
            backLabel={t('dapps.backBtn')}
            openNewTabLabel={t('dapps.openNewTab')}
            openNewTabTitle={t('dapps.openNewTabTitle')}
            blockedTitle={t('dapps.blockedTitle')}
            blockedDetail={t('dapps.blockedDetail')}
            loadingLabel={t('dapps.loadingDapp')}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; transform: none !important; }
        }
        .dapps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .dapps-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 639px) {
          .dapps-grid {
            grid-template-columns: 1fr;
          }
        }
        .category-scroll {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 2px;
        }
        .category-scroll::-webkit-scrollbar {
          display: none;
        }
        .wc-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 639px) {
          .wc-steps-row {
            flex-direction: column;
          }
          .wc-step-divider {
            display: none !important;
          }
        }
        .wc-uri-input:focus {
          outline: none;
          border-color: rgba(59,153,252,0.5) !important;
          box-shadow: 0 0 0 3px rgba(59,153,252,0.08);
        }
        .search-input:focus {
          outline: none;
          border-color: rgba(212,175,55,0.3) !important;
        }
        .cat-btn {
          white-space: nowrap;
          flex-shrink: 0;
          cursor: pointer;
          border: none;
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 20px;
          letter-spacing: 0.01em;
          transition: background 0.15s, color 0.15s;
        }
        .connect-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .connect-btn:not(:disabled):hover {
          filter: brightness(1.08);
        }
      `}</style>

      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '32px 24px 80px',
      }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#f0f4f8',
            margin: '0 0 4px',
            letterSpacing: '-0.025em',
          }}>
            {t('dapps.title')}
          </h1>
          <p style={{
            fontSize: '13.5px',
            color: C.textSecondary,
            margin: 0,
            letterSpacing: '0.01em',
          }}>
            {t('dapps.subtitle')}
          </p>
        </div>

        {/* ── Search + filter row ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '24px',
        }}>
          {/* Search input */}
          <div style={{ position: 'relative', maxWidth: '380px' }}>
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.textSubtle,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}>
              <IconSearch />
            </span>
            <input
              className="search-input"
              type="text"
              placeholder={t('dapps.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                padding: '9px 14px 9px 36px',
                fontSize: '13px',
                color: C.textPrimary,
                fontFamily: 'inherit',
                caretColor: C.gold,
                transition: 'border-color 0.15s',
              }}
            />
          </div>

          {/* Category tabs */}
          <div className="category-scroll">
            {CATEGORIES.map((cat) => {
              const isActive = cat === activeCategory
              return (
                <button
                  key={cat}
                  className="cat-btn"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    backgroundColor: isActive ? C.goldBgActive : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? C.goldBorder : C.border}`,
                    color: isActive ? C.gold : C.textSecondary,
                  }}
                >
                  {categoryLabel(cat)}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── dApps grid ── */}
        {filtered.length > 0 ? (
          <div className="dapps-grid">
            {filtered.map((dapp) => (
              <DAppCard
                key={dapp.id}
                dapp={dapp}
                activeChainId={network.chainId}
                onOpen={setActiveDapp}
                openLabel={t('dapps.openBtn')}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '80px 24px',
            color: C.textSubtle,
          }}>
            <IconEmpty />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                {t('dapps.emptyTitle')}
              </div>
              <div style={{ fontSize: '12.5px', color: C.textSubtle }}>
                {t('dapps.emptySubtitle')}
              </div>
            </div>
          </div>
        )}

        {/* ── WalletConnect section ── */}
        <div style={{
          marginTop: '40px',
          backgroundColor: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          padding: '24px',
        }}>
          {/* WC header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59,153,252,0.08)',
              border: '1px solid rgba(59,153,252,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconWalletConnect />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: C.textPrimary, letterSpacing: '-0.01em' }}>
                {t('dapps.wcTitle')}
              </div>
              <div style={{ fontSize: '12px', color: C.textSubtle, marginTop: '2px' }}>
                {t('dapps.wcSubtitle')}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="wc-steps-row" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '6px',
            border: `1px solid ${C.border}`,
          }}>
            {([
              { n: '1', key: 'dapps.wcStep1' },
              { n: '2', key: 'dapps.wcStep2' },
              { n: '3', key: 'dapps.wcStep3' },
              { n: '4', key: 'dapps.wcStep4' },
            ] as { n: string; key: string }[]).map((step, i, arr) => (
              <div key={step.n} style={{ display: 'contents' }}>
                <div className="wc-step">
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59,153,252,0.12)',
                    border: '1px solid rgba(59,153,252,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#5ac8ff',
                    flexShrink: 0,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {step.n}
                  </span>
                  <span style={{ fontSize: '12px', color: C.textSecondary, lineHeight: '1.4' }}>
                    {t(step.key)}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className="wc-step-divider" style={{
                    width: '16px',
                    height: '1px',
                    backgroundColor: C.border,
                    flexShrink: 0,
                    alignSelf: 'center',
                    marginTop: '10px',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '11px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontWeight: '600',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: C.textSubtle,
                marginBottom: '8px',
              }}>
                {t('dapps.wcActiveSessions')} ({sessions.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sessions.map((session) => (
                  <SessionRow
                    key={session.topic}
                    session={session}
                    onDisconnect={disconnect}
                    disconnectLabel={t('dapps.sessionDisconnect')}
                    disconnectTitle={t('dapps.sessionDisconnectTitle')}
                    confirmLabel={t('dapps.sessionConfirm')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* URI input row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
            <input
              className="wc-uri-input"
              type="text"
              placeholder="wc:xxxxxxxx@2?relay-protocol=irn&symKey=..."
              value={wcUri}
              onChange={(e) => {
                setWcUri(e.target.value)
                if (connectStatus === 'error') {
                  setConnectStatus('idle')
                  setConnectError('')
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnect()
              }}
              style={{
                flex: 1,
                backgroundColor: '#06080f',
                border: `1px solid ${connectStatus === 'error' ? 'rgba(248,113,113,0.4)' : C.border}`,
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12.5px',
                fontFamily: 'IBM Plex Mono, monospace',
                color: C.textPrimary,
                caretColor: '#3B99FC',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
            <button
              className="connect-btn"
              onClick={handleConnect}
              disabled={!wcUri.trim() || !ready || connectStatus === 'connecting'}
              style={{
                flexShrink: 0,
                backgroundColor: C.gold,
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                letterSpacing: '0.01em',
                transition: 'filter 0.15s, opacity 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {connectStatus === 'connecting' ? (
                <>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(0,0,0,0.3)',
                    borderTop: '2px solid #000',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'wc-spin 0.7s linear infinite',
                  }} />
                  {t('dapps.wcConnecting')}
                </>
              ) : t('dapps.wcConnectBtn')}
            </button>
          </div>

          {/* Status messages */}
          {connectStatus === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: C.successBg,
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '6px',
              fontSize: '13px',
              color: C.success,
              fontWeight: '500',
            }}>
              <span style={{ color: C.success, display: 'flex', alignItems: 'center' }}>
                <IconCheck />
              </span>
              {t('dapps.wcSuccess')}
            </div>
          )}

          {connectStatus === 'error' && connectError && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginTop: '12px',
              padding: '10px 14px',
              backgroundColor: C.errorBg,
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: C.error,
            }}>
              <span style={{ flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center' }}>
                <IconX />
              </span>
              <span>{connectError}</span>
            </div>
          )}

          {!ready && address && (
            <div style={{
              marginTop: '10px',
              fontSize: '11.5px',
              color: C.textSubtle,
              fontFamily: 'IBM Plex Mono, monospace',
            }}>
              {t('dapps.wcInitializing')}
            </div>
          )}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes wc-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
