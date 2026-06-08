'use client'

import { useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi'
import { arbitrumSepolia, base, arbitrum, mainnet, bsc } from 'wagmi/chains'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
}

const CHAIN_NAMES: Record<number, string> = {
  [arbitrumSepolia.id]: 'Arb Sepolia',
  [base.id]: 'Base',
  [arbitrum.id]: 'Arbitrum',
  [mainnet.id]: 'Ethereum',
  [bsc.id]: 'BNB Chain',
}

function addrToColor(addr: string): string {
  const hex = addr.toLowerCase().replace('0x', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgb(${r},${g},${b})`
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// Icons
function IconFox() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
      <path d="M42 6L27.5 17l2.7-6.3L42 6z" fill="#E17726" />
      <path d="M6 6l14.4 11.1L18 10.7 6 6z" fill="#E27625" />
      <path d="M36.5 33.5l-3.8 5.8 8.1 2.2 2.3-7.8-6.6-.2z" fill="#E27625" />
      <path d="M4.9 33.7l2.3 7.8 8.1-2.2-3.8-5.8-6.6.2z" fill="#E27625" />
      <path d="M14.9 21.5l-2.2 3.3 7.9.4-.3-8.5-5.4 4.8z" fill="#E27625" />
      <path d="M33.1 21.5l-5.5-4.9-.3 8.6 7.9-.4-2.1-3.3z" fill="#E27625" />
      <path d="M15.3 39.3l4.8-2.3-4.1-3.2-.7 5.5z" fill="#E27625" />
      <path d="M27.9 37l4.8 2.3-.7-5.5-4.1 3.2z" fill="#E27625" />
    </svg>
  )
}

function IconWC() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="#3B99FC" />
      <path d="M13 19c6.1-6 16-6 22.1 0l.7.7a.7.7 0 0 1 0 1l-2.4 2.4a.4.4 0 0 1-.5 0l-1-.9c-4.2-4.1-11-4.1-15.2 0l-1.1 1a.4.4 0 0 1-.5 0l-2.4-2.4a.7.7 0 0 1 0-1L13 19zm27.3 5.1 2.1 2.1a.7.7 0 0 1 0 1l-9.6 9.4a.7.7 0 0 1-1 0l-6.8-6.6a.2.2 0 0 0-.3 0l-6.8 6.6a.7.7 0 0 1-1 0L7.6 27.2a.7.7 0 0 1 0-1l2.1-2.1a.7.7 0 0 1 1 0l6.8 6.6c.1.1.2.1.3 0l6.8-6.6a.7.7 0 0 1 1 0l6.8 6.6c.1.1.2.1.3 0l6.8-6.6a.7.7 0 0 1 1 0z" fill="white" />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none" />
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

function IconDisconnect() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wcUri, setWcUri] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Auto-close QR modal when wallet connects
  useEffect(() => {
    if (isConnected && wcUri) setWcUri(null)
  }, [isConnected, wcUri])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
  const avatarColor = address ? addrToColor(address) : COLORS.gold

  // Avoid SSR/client mismatch — render neutral state until mounted
  if (!mounted) return (
    <button style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px',
      borderRadius: '7px', border: `1px solid ${COLORS.border}`,
      background: 'rgba(255,255,255,0.03)', color: COLORS.textPrimary,
      fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
    }}>
      {t('connect.connectWallet')}
    </button>
  )

  return (
    <>
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Trigger button */}
      {!isConnected ? (
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '7px',
            border: `1px solid rgba(212,175,55,0.3)`,
            background: 'transparent',
            color: COLORS.textPrimary,
            fontSize: '12.5px',
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '0.01em',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,175,55,0.6)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,175,55,0.05)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,175,55,0.3)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <span style={{ color: COLORS.gold, display: 'flex', alignItems: 'center' }}>
            <IconWallet />
          </span>
          {t('connect.connectWallet')}
        </button>
      ) : (
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 10px',
            borderRadius: '7px',
            border: `1px solid ${COLORS.border}`,
            background: 'rgba(255,255,255,0.03)',
            color: COLORS.textPrimary,
            fontSize: '12.5px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,175,55,0.25)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,175,55,0.04)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
          }}
        >
          {/* Avatar circle */}
          <span style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, white 0%, ${avatarColor} 100%)`,
            flexShrink: 0,
            opacity: 0.85,
          }} />
          {/* Address */}
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: COLORS.textSecondary }}>
            {address ? shortAddr(address) : ''}
          </span>
          {/* Green dot */}
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#38a169',
            flexShrink: 0,
          }} title={chainName} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          minWidth: '220px',
          backgroundColor: '#0d1117',
          border: `1px solid ${COLORS.border}`,
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 200,
        }}>

          {!isConnected && (
            <>
              <div style={{ padding: '10px 14px 6px', fontSize: '10px', fontWeight: 600, color: COLORS.textSubtle, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {t('connect.connectWith')}
              </div>
              {connectors.find(c => c.type === 'injected') && (
                <DropdownItem
                  icon={<IconFox />}
                  label="MetaMask"
                  onClick={() => { connect({ connector: connectors.find(c => c.type === 'injected')! }); setOpen(false) }}
                />
              )}
              {connectors.find(c => c.type === 'walletConnect') && (
                <DropdownItem
                  icon={<IconWC />}
                  label="WalletConnect"
                  onClick={() => {
                    const wc = connectors.find(c => c.type === 'walletConnect')!
                    // In wagmi v3, display_uri fires on config.emitter (not connector.emitter)
                    // In wagmi v3, display_uri fires on the connector's own emitter
                    const handler = (msg: { type: string; data?: unknown; uid: string }) => {
                      if (msg.type === 'display_uri') {
                        setWcUri(msg.data as string)
                        wc.emitter.off('message', handler)
                      }
                    }
                    wc.emitter.on('message', handler)
                    connect({ connector: wc })
                    setOpen(false)
                  }}
                />
              )}
            </>
          )}

          {isConnected && (
            <>
              {/* Address + chain info */}
              <div style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#38a169',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '11px', color: COLORS.textSubtle }}>{chainName}</span>
                </div>
                <button
                  onClick={copyAddress}
                  title={t('connect.copyAddressTitle')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: copied ? COLORS.gold : COLORS.textSecondary,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    transition: 'color 0.15s',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1, wordBreak: 'break-all' }}>{address}</span>
                  <span style={{ flexShrink: 0, color: copied ? COLORS.gold : COLORS.textSubtle }}>
                    {copied ? '✓' : <IconCopy />}
                  </span>
                </button>
              </div>

              {/* Disconnect */}
              <DropdownItem
                icon={<IconDisconnect />}
                label={t('common.disconnect')}
                danger
                onClick={() => { disconnect(); setOpen(false) }}
              />
            </>
          )}
        </div>
      )}
    </div>

    {/* WalletConnect QR Modal */}
    {wcUri && (
      <div
        onClick={() => setWcUri(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            backgroundColor: '#0d1117',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '14px',
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            maxWidth: '340px', width: '90%',
          }}
        >
          <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#f0f4f8' }}>{t('connect.wcScanTitle')}</p>
          <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
            <QRCodeSVG value={wcUri} size={220} />
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#4a5568', textAlign: 'center' }}>
            {t('connect.wcScanHint')}
          </p>
          <button
            onClick={() => { navigator.clipboard.writeText(wcUri); }}
            style={{
              padding: '7px 16px', borderRadius: '6px',
              border: '1px solid rgba(212,175,55,0.3)',
              background: 'transparent', color: '#D4AF37',
              fontSize: '12px', cursor: 'pointer',
            }}
          >
            {t('connect.wcCopyUri')}
          </button>
          <button
            onClick={() => setWcUri(null)}
            style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '12px', cursor: 'pointer' }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )}
    </>
  )
}

function DropdownItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '9px 14px',
        background: hover
          ? danger
            ? 'rgba(229,62,62,0.08)'
            : 'rgba(212,175,55,0.06)'
          : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hover
          ? danger ? '#fc8181' : COLORS.textPrimary
          : danger ? COLORS.textSubtle : COLORS.textSecondary,
        fontSize: '13px',
        fontWeight: 500,
        textAlign: 'left',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )
}
