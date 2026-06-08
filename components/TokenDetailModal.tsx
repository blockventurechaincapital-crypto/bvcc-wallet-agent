'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sparkline from './Sparkline'
import { usePriceChart, type ChartDays } from '@/lib/usePriceChart'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import type { WalletToken } from '@/lib/useTokens'

const GREEN = '#48bb78'
const RED = '#fc8181'

function fmtBalance(s: string): string {
  const n = parseFloat(s)
  if (!isFinite(n) || n === 0) return '0'
  if (n > 0 && n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function Icon({ token }: { token: WalletToken }) {
  const [err, setErr] = useState(false)
  const show = token.logo && !err
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {show
        ? <img src={token.logo} alt={token.symbol} width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '50%' }} onError={() => setErr(true)} />
        : <span style={{ fontSize: 13, fontWeight: 600, color: '#8892a4' }}>{token.symbol.slice(0, 3).toUpperCase()}</span>}
    </div>
  )
}

const TIMEFRAMES: { label: string; days: ChartDays }[] = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '1m', days: 30 },
]

export default function TokenDetailModal({ token, onClose }: { token: WalletToken; onClose: () => void }) {
  const router = useRouter()
  const { network, setNetworkByChainId } = useNetwork()
  const { t } = useI18n()
  const [days, setDays] = useState<ChartDays>(1)
  const { data: points, isLoading } = usePriceChart(token, token.network, days)

  const values = (points ?? []).map(p => p[1])
  const hasChart = values.length >= 2
  const first = hasChart ? values[0] : 0
  const last = hasChart ? values[values.length - 1] : 0
  const tfChange = hasChart && first > 0 ? ((last - first) / first) * 100 : token.change24h
  const up = tfChange >= 0
  const color = up ? GREEN : RED

  const canSend = token.isNative || token.symbol === 'USDC'

  const go = (path: string) => {
    if (token.network.chainId !== network.chainId) setNetworkByChainId(token.network.chainId)
    onClose()
    router.push(path)
  }

  const H = 170

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
          padding: '20px 22px 22px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <Icon token={token} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f0f4f8' }}>{token.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4a5568' }}>{token.symbol} · {token.network.shortName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: '4px', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Precio actual + cambio del periodo */}
        <div style={{ marginBottom: '14px' }}>
          <p style={{ margin: 0, fontSize: '26px', fontWeight: 600, color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.03em' }}>
            ${token.usdPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: token.usdPrice < 1 ? 6 : 2 })}
          </p>
          {token.usdPrice > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 500, color, fontFamily: 'IBM Plex Mono, monospace' }}>
              {up ? '▲' : '▼'} {Math.abs(tfChange).toFixed(2)}% · {TIMEFRAMES.find(tf => tf.days === days)?.label}
            </span>
          )}
        </div>

        {/* Gráfica */}
        <div style={{ height: H, marginBottom: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {token.usdPrice === 0 ? (
            <p style={{ fontSize: '12px', color: '#4a5568' }}>{t('dashboard.chartUnavailable')}</p>
          ) : isLoading ? (
            <div className="skeleton" style={{ width: '100%', height: H, borderRadius: '8px' }} />
          ) : hasChart ? (
            <div style={{ width: '100%' }}><Sparkline points={values} width={600} height={H} color={color} strokeWidth={2} responsive /></div>
          ) : (
            <p style={{ fontSize: '12px', color: '#4a5568' }}>{t('dashboard.chartUnavailable')}</p>
          )}
        </div>

        {/* Toggle temporalidad */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '18px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.days}
              onClick={() => setDays(tf.days)}
              style={{
                padding: '5px 16px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 500,
                border: '1px solid ' + (days === tf.days ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'),
                background: days === tf.days ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: days === tf.days ? '#D4AF37' : '#8892a4',
                transition: 'all 0.15s',
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Holdings */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', marginBottom: '16px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '10px', color: '#4a5568', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t('dashboard.yourBalance')}</p>
            <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 500, color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace' }}>
              {fmtBalance(token.balanceFormatted)} {token.symbol}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '10px', color: '#4a5568', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t('dashboard.value')}</p>
            <p style={{ margin: '3px 0 0', fontSize: '14px', fontWeight: 500, color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace' }}>
              ${token.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {canSend && (
            <button onClick={() => go(`/wallet/send?token=${token.isNative ? token.symbol : 'USDC'}`)} className="action-btn"
              style={{ flex: 1, padding: '10px 0', background: '#D4AF37', border: 'none', borderRadius: '7px', color: '#000', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {t('dashboard.send')}
            </button>
          )}
          <button onClick={() => go('/wallet/receive')} className="action-btn"
            style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#f0f4f8', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            {t('dashboard.receive')}
          </button>
          <button onClick={() => go('/wallet/swap')} className="action-btn"
            style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#f0f4f8', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            {t('dashboard.swap')}
          </button>
        </div>
      </div>
    </div>
  )
}
