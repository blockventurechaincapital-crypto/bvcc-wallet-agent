'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletAddress } from '@/lib/useWalletAddress'
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ReceivePage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const { address } = useWalletAddress()
  const { t } = useI18n()

  const displayAddress = address ?? '0x0000000000000000000000000000000000000000'

  const copy = () => {
    navigator.clipboard.writeText(displayAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: COLORS.bg,
      padding: '32px 28px',
      paddingBottom: '80px',
      maxWidth: '480px',
    }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: COLORS.textSecondary,
          fontSize: '13px',
          padding: '0',
          marginBottom: '28px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = COLORS.textPrimary)}
        onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSecondary)}
      >
        <IconBack />
        {t('receive.backBtn')}
      </button>

      {/* Page title */}
      <h1 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: COLORS.textPrimary,
        letterSpacing: '-0.02em',
        margin: '0 0 28px',
      }}>
        {t('receive.title')}
      </h1>

      {/* QR card */}
      <div style={{
        backgroundColor: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        padding: '32px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        {/* QR code */}
        <div style={{
          backgroundColor: '#ffffff',
          padding: '14px',
          borderRadius: '6px',
          marginBottom: '24px',
          display: 'inline-block',
          lineHeight: 0,
        }}>
          <QRCodeSVG
            value={displayAddress}
            size={168}
            bgColor="#ffffff"
            fgColor="#0d1117"
            level="M"
          />
        </div>

        {/* Address display */}
        <p style={{
          fontSize: '12px',
          fontFamily: 'monospace',
          color: COLORS.textSecondary,
          wordBreak: 'break-all',
          textAlign: 'center',
          lineHeight: '1.6',
          margin: '0 0 20px',
        }}>
          {displayAddress}
        </p>

        {/* Network hint */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#38a169',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          <p style={{
            fontSize: '11px',
            color: COLORS.textSubtle,
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            {t('receive.networkHint')}
          </p>
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={copy}
        style={{
          width: '100%',
          padding: '13px',
          borderRadius: '6px',
          backgroundColor: copied ? 'rgba(56,161,105,0.1)' : COLORS.gold,
          border: copied ? '1px solid rgba(56,161,105,0.3)' : 'none',
          color: copied ? '#68d391' : '#000',
          fontSize: '13.5px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.15s',
          letterSpacing: '0.01em',
        }}
      >
        {copied ? <IconCheck /> : <IconCopy />}
        {copied ? t('receive.addressCopied') : t('receive.copyAddress')}
      </button>
    </main>
  )
}
