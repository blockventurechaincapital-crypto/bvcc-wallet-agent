'use client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.12)',
  goldBorder: 'rgba(212,175,55,0.25)',
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

function IconBridge() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  )
}

const PLANNED_BRIDGES = [
  {
    name: 'Arbitrum Bridge',
    description: 'Arbitrum ↔ Ethereum',
    color: '#4FC3F7',
  },
  {
    name: 'Base Bridge',
    description: 'Base ↔ Ethereum',
    color: '#0052FF',
  },
  {
    name: 'LayerZero',
    description: 'Cross-chain',
    color: '#A855F7',
  },
]

export default function BridgePage() {
  const router = useRouter()
  const { t } = useI18n()

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
        {t('bridge.backBtn')}
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ color: COLORS.gold }}>
          <IconBridge />
        </span>
        <h1 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: COLORS.textPrimary,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          {t('bridge.title')}
        </h1>
      </div>

      <p style={{
        fontSize: '13px',
        color: COLORS.textSecondary,
        margin: '0 0 28px',
        letterSpacing: '0.01em',
      }}>
        {t('bridge.subtitle')}
      </p>

      {/* Coming soon badge */}
      <div style={{
        backgroundColor: COLORS.goldDim,
        border: `1px solid ${COLORS.goldBorder}`,
        borderRadius: '8px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{
          display: 'inline-block',
          backgroundColor: COLORS.gold,
          color: '#000',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.1em',
          padding: '5px 14px',
          borderRadius: '20px',
          textTransform: 'uppercase',
        }}>
          {t('bridge.comingSoon')}
        </span>
        <p style={{
          fontSize: '13px',
          color: COLORS.textSecondary,
          margin: 0,
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          {t('bridge.comingSoonBody')}
        </p>
      </div>

      {/* Planned bridges list */}
      <div style={{
        backgroundColor: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '24px',
      }}>
        <p style={{
          fontSize: '11px',
          fontWeight: '600',
          color: COLORS.textSubtle,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
          padding: '14px 20px 10px',
        }}>
          {t('bridge.plannedBridges')}
        </p>

        {PLANNED_BRIDGES.map((bridge, i) => (
          <div
            key={bridge.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 20px',
              borderTop: i === 0 ? `1px solid ${COLORS.border}` : `1px solid ${COLORS.border}`,
              opacity: 0.65,
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: bridge.color,
              flexShrink: 0,
              display: 'inline-block',
            }} />
            <div>
              <p style={{
                fontSize: '13.5px',
                fontWeight: '500',
                color: COLORS.textPrimary,
                margin: '0 0 2px',
              }}>
                {bridge.name}
              </p>
              <p style={{
                fontSize: '11px',
                color: COLORS.textSecondary,
                margin: 0,
                letterSpacing: '0.02em',
              }}>
                {bridge.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Back to dashboard button */}
      <button
        onClick={() => router.push('/wallet')}
        style={{
          width: '100%',
          padding: '13px',
          borderRadius: '6px',
          backgroundColor: 'transparent',
          border: `1px solid ${COLORS.border}`,
          color: COLORS.textSecondary,
          fontSize: '13.5px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.15s',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
          e.currentTarget.style.color = COLORS.textPrimary
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = COLORS.border
          e.currentTarget.style.color = COLORS.textSecondary
        }}
      >
        <IconBack />
        {t('bridge.backToDashboard')}
      </button>
    </main>
  )
}
