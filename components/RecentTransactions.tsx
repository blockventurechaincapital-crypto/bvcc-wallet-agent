'use client'
import { formatUnits } from 'viem'
import { useMultiChainTransactions } from '@/lib/useTransactions'
import { useViewNetworks } from '@/lib/useViewNetworks'
import { getNetwork } from '@/lib/networks'
import NetworkLogo from '@/components/NetworkLogo'
import { useI18n } from '@/lib/i18n/I18nContext'

const COLORS = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  gold: '#D4AF37',
  textPrimary: '#f0f4f8',
  textSecondary: '#8892a4',
  textSubtle: '#4a5568',
  green: '#38a169',
  red: '#e53e3e',
}

/** Relative age of a transaction. Takes `t` because this sat outside i18n and printed
 *  "hace 2d" under an English interface — the same bug the WalletConnect decoder had. */
function timeAgo(timestamp: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return t('transactions.agoNow')
  if (diff < 3600) return t('transactions.agoMin', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('transactions.agoHour', { n: Math.floor(diff / 3600) })
  if (diff < 2592000) return t('transactions.agoDay', { n: Math.floor(diff / 86400) })
  const months = Math.floor(diff / 2592000)
  return t(months > 1 ? 'transactions.agoMonths' : 'transactions.agoMonth', { n: months })
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function truncateAddress(addr: string): string {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatValue(value: string, decimals: number, symbol: string): string {
  try {
    const formatted = formatUnits(BigInt(value), decimals)
    const num = parseFloat(formatted)
    if (num === 0) return `0 ${symbol}`
    if (num < 0.0001) return `<0.0001 ${symbol}`
    return `${num.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`
  } catch {
    return `— ${symbol}`
  }
}

interface Props {
  address: string | null
  limit?: number
}

export default function RecentTransactions({ address, limit = 5 }: Props) {
  const { networks } = useViewNetworks()
  const { t } = useI18n()
  const { items, isLoading, noApiKey } = useMultiChainTransactions(address, networks)

  const walletLower = address?.toLowerCase() ?? ''

  if (isLoading) {
    return (
      <div style={{ padding: '32px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '20px', height: '20px', borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: COLORS.gold,
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (noApiKey) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', color: COLORS.textSubtle, lineHeight: '1.6' }}>
          {(() => {
            const msg = t('components.txNoApiKey')
            const [before, after] = msg.split('{key}')
            return <>{before}<code style={{ color: COLORS.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '3px' }}>ARBISCAN_API_KEY</code>{after}</>
          })()}
        </p>
      </div>
    )
  }

  const shown = items.slice(0, limit)

  if (shown.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', gap: '10px',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
        <p style={{ margin: 0, fontSize: '13px', color: COLORS.textSubtle }}>{t('components.txEmpty')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {shown.map((tx, idx) => {
        const isSent = tx.from.toLowerCase() === walletLower
        const txNetwork = getNetwork(tx.chainId)
        return (
          <div key={`${tx.chainId}-${tx.hash}-${tx.logIndex}-${idx}`}>
            {idx > 0 && <div style={{ height: '1px', backgroundColor: COLORS.borderSubtle, margin: '0 20px' }} />}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 20px',
            }}>
              {/* Direction icon + network badge */}
              <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  backgroundColor: isSent ? 'rgba(229,62,62,0.08)' : 'rgba(56,161,105,0.08)',
                  border: `1px solid ${isSent ? 'rgba(229,62,62,0.2)' : 'rgba(56,161,105,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSent ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  )}
                </div>
                <span style={{ position: 'absolute', right: -3, bottom: -3, border: '2px solid #0d1117', borderRadius: '5px', display: 'flex' }}>
                  <NetworkLogo network={txNetwork} size={14} title />
                </span>
              </div>

              {/* Hash + counterpart */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={`${txNetwork.blockExplorer.url}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '12.5px', color: COLORS.textSecondary,
                    fontFamily: 'IBM Plex Mono, monospace',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = COLORS.textPrimary)}
                  onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSecondary)}
                >
                  {truncateHash(tx.hash)}
                </a>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: COLORS.textSubtle }}>
                  {isSent ? `→ ${truncateAddress(tx.to)}` : `← ${truncateAddress(tx.from)}`}
                </p>
              </div>

              {/* Amount + time + status */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '12.5px', fontWeight: '500',
                  color: isSent ? COLORS.red : COLORS.green,
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '-0.02em',
                }}>
                  {isSent ? '−' : '+'}{formatValue(tx.value, tx.tokenDecimal, tx.tokenSymbol)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: COLORS.textSubtle }}>{timeAgo(tx.timestamp, t)}</span>
                  <span style={{
                    fontSize: '10px', padding: '1px 6px', borderRadius: '3px',
                    backgroundColor: tx.isError ? 'rgba(229,62,62,0.08)' : 'rgba(56,161,105,0.08)',
                    border: `1px solid ${tx.isError ? 'rgba(229,62,62,0.2)' : 'rgba(56,161,105,0.2)'}`,
                    color: tx.isError ? COLORS.red : COLORS.green,
                  }}>
                    {tx.isError ? t('components.txStatusFailed') : t('components.txStatusSuccess')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
