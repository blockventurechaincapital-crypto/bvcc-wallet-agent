'use client'
import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/I18nContext'

interface RecoveryBannerProps {
  approvals: number
  readyAt: bigint | null
  onCancel: () => void
  cancelling: boolean
}

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return '0h 0m'
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  return `${h}h ${m}m`
}

export default function RecoveryBanner({ approvals, readyAt, onCancel, cancelling }: RecoveryBannerProps) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const readyAtNum = readyAt !== null ? Number(readyAt) : 0
  const hasTimer = readyAtNum > 0
  const isExecutable = hasTimer && now >= readyAtNum
  const secondsLeft = hasTimer ? readyAtNum - now : 0

  return (
    <div
      className="fade-in"
      style={{
        padding: '16px 20px',
        marginBottom: '16px',
        backgroundColor: '#1a0a0a',
        border: '1px solid #ff4444',
        borderRadius: '10px',
        color: '#fff',
      }}
    >
      {/* Title */}
      <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: '#ff6666', letterSpacing: '-0.01em' }}>
        {t('components.recoveryTitle')}
      </p>

      {/* Approvals */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: i < approvals ? '#ff4444' : 'transparent',
                border: `2px solid ${i < approvals ? '#ff4444' : 'rgba(255,68,68,0.35)'}`,
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: '12px', color: '#ffaaaa' }}>
          {t('components.recoverySignatures').replace('{count}', String(approvals))}
        </span>
      </div>

      {/* Countdown / Executable badge */}
      {hasTimer && (
        <div style={{ marginBottom: '14px' }}>
          {isExecutable ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px',
              backgroundColor: '#ff2222',
              borderRadius: '5px',
              fontSize: '11px', fontWeight: '700',
              color: '#fff', letterSpacing: '0.04em',
              textTransform: 'uppercase',
              animation: 'pulse 1.5s infinite',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', flexShrink: 0 }} />
              {t('components.recoveryExecutableNow')}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#ffaaaa' }}>
              {t('components.recoveryExecutableIn')}{' '}
              <span style={{ fontWeight: '600', fontFamily: 'IBM Plex Mono, monospace' }}>
                {formatCountdown(secondsLeft)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Cancel button */}
      <button
        onClick={onCancel}
        disabled={cancelling}
        style={{
          width: '100%',
          padding: '10px 0',
          backgroundColor: cancelling ? 'rgba(255,68,68,0.3)' : '#ff4444',
          border: 'none',
          borderRadius: '7px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: '700',
          cursor: cancelling ? 'not-allowed' : 'pointer',
          letterSpacing: '0.01em',
          transition: 'background 0.15s, opacity 0.15s',
          opacity: cancelling ? 0.7 : 1,
        }}
      >
        {cancelling ? t('components.recoveryCancelling') : t('components.recoveryCancelBtn')}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  )
}
