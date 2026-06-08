'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatUnits } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useMultiChainTransactions } from '@/lib/useTransactions'
import type { TxItemChain } from '@/lib/useTransactions'
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

type FilterType = 'all' | 'eth' | 'token'

function TxRow({ tx, walletLower, timeAgo }: { tx: TxItemChain; walletLower: string; timeAgo: (ts: number) => string }) {
  const isSent = tx.from.toLowerCase() === walletLower
  const txNetwork = getNetwork(tx.chainId)
  const { t } = useI18n()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '13px 20px',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Direction icon + network badge */}
      <div style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%',
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
        <span style={{ position: 'absolute', right: -3, bottom: -3, border: '2px solid #06080f', borderRadius: '5px', display: 'flex' }}>
          <NetworkLogo network={txNetwork} size={15} title />
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
            textDecoration: 'none', display: 'block',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = COLORS.textPrimary)}
          onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSecondary)}
        >
          {truncateHash(tx.hash)}
        </a>
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: COLORS.textSubtle }}>
          {isSent ? `→ ${truncateAddress(tx.to)}` : `← ${truncateAddress(tx.from)}`} · {txNetwork.shortName}
        </p>
      </div>

      {/* Amount + time + badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{
          fontSize: '12.5px', fontWeight: '500',
          color: isSent ? COLORS.red : COLORS.green,
          fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '-0.02em',
        }}>
          {isSent ? '−' : '+'}{formatValue(tx.value, tx.tokenDecimal, tx.tokenSymbol)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: COLORS.textSubtle }}>{timeAgo(tx.timestamp)}</span>
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '3px',
            backgroundColor: tx.isError ? 'rgba(229,62,62,0.08)' : 'rgba(56,161,105,0.08)',
            border: `1px solid ${tx.isError ? 'rgba(229,62,62,0.2)' : 'rgba(56,161,105,0.2)'}`,
            color: tx.isError ? COLORS.red : COLORS.green,
          }}>
            {tx.isError ? t('transactions.statusFailed') : t('transactions.statusSuccess')}
          </span>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function TransactionsPage() {
  const router = useRouter()
  const { address } = useWalletAddress()
  const { networks } = useViewNetworks()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<FilterType>('all')
  const { t } = useI18n()

  const { items, isLoading, noApiKey } = useMultiChainTransactions(address, networks, 50)

  const walletLower = address?.toLowerCase() ?? ''

  const filteredItems = filter === 'all'
    ? items
    : items.filter(tx => tx.type === filter)

  // Paginación en cliente sobre el conjunto agregado multi-cadena
  const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasNext = filteredItems.length > page * PAGE_SIZE
  const hasPrev = page > 1

  const timeAgo = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000)
    const diff = now - timestamp
    if (diff < 60) return t('transactions.momentAgo')
    if (diff < 3600) return t('transactions.minutesAgo').replace('{n}', String(Math.floor(diff / 60)))
    if (diff < 86400) return t('transactions.hoursAgo').replace('{n}', String(Math.floor(diff / 3600)))
    if (diff < 2592000) return t('transactions.daysAgo').replace('{n}', String(Math.floor(diff / 86400)))
    const months = Math.floor(diff / 2592000)
    return (months > 1 ? t('transactions.monthsAgo') : t('transactions.monthAgo')).replace('{n}', String(months))
  }

  const filterBtn = (label: string, value: FilterType) => (
    <button
      onClick={() => { setFilter(value); setPage(1) }}
      style={{
        padding: '6px 14px',
        fontSize: '12px', fontWeight: '500',
        borderRadius: '5px', cursor: 'pointer',
        border: filter === value
          ? '1px solid rgba(212,175,55,0.4)'
          : '1px solid rgba(255,255,255,0.08)',
        backgroundColor: filter === value
          ? 'rgba(212,175,55,0.08)'
          : 'transparent',
        color: filter === value ? COLORS.gold : COLORS.textSubtle,
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <main style={{
        minHeight: '100vh',
        backgroundColor: COLORS.bg,
        padding: '32px 28px 80px',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>

          {/* Back + header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => router.back()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: COLORS.textSubtle, fontSize: '13px', padding: '0',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = COLORS.textSecondary)}
                onMouseLeave={e => (e.currentTarget.style.color = COLORS.textSubtle)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                {t('transactions.backBtn')}
              </button>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>
                {t('transactions.title')}
              </h1>
            </div>

          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {filterBtn(t('transactions.filterAll'), 'all')}
            {filterBtn('ETH', 'eth')}
            {filterBtn(t('transactions.filterTokens'), 'token')}
          </div>

          {/* Transactions card */}
          <div style={{
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            {/* No API key */}
            {noApiKey && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '13px', color: COLORS.textSubtle, lineHeight: '1.7' }}>
                  {t('transactions.configureApiKey').replace('{key}', '')}
                  <code style={{ color: COLORS.textSecondary, backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '3px' }}>ARBISCAN_API_KEY</code>
                  {' '}
                </p>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.08)',
                  borderTopColor: COLORS.gold,
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {/* Empty */}
            {!isLoading && !noApiKey && filteredItems.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '48px 24px', gap: '10px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                <p style={{ margin: 0, fontSize: '13px', color: COLORS.textSubtle }}>{t('transactions.emptyState')}</p>
              </div>
            )}

            {/* List */}
            {!isLoading && pagedItems.length > 0 && pagedItems.map((tx, idx) => (
              <div key={`${tx.chainId}-${tx.hash}-${tx.logIndex}-${idx}`}>
                {idx > 0 && <div style={{ height: '1px', backgroundColor: COLORS.borderSubtle, margin: '0 20px' }} />}
                <TxRow tx={tx} walletLower={walletLower} timeAgo={timeAgo} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!isLoading && !noApiKey && (hasPrev || hasNext) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!hasPrev}
                style={{
                  padding: '8px 20px', fontSize: '13px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'transparent',
                  color: hasPrev ? COLORS.textSecondary : COLORS.textSubtle,
                  cursor: hasPrev ? 'pointer' : 'not-allowed',
                  opacity: hasPrev ? 1 : 0.4,
                  transition: 'all 0.12s',
                }}
              >
                {t('transactions.prevPage')}
              </button>
              <span style={{
                display: 'flex', alignItems: 'center',
                fontSize: '12px', color: COLORS.textSubtle,
                fontFamily: 'IBM Plex Mono, monospace',
              }}>
                {t('transactions.page').replace('{n}', String(page))}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext}
                style={{
                  padding: '8px 20px', fontSize: '13px', borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'transparent',
                  color: hasNext ? COLORS.textSecondary : COLORS.textSubtle,
                  cursor: hasNext ? 'pointer' : 'not-allowed',
                  opacity: hasNext ? 1 : 0.4,
                  transition: 'all 0.12s',
                }}
              >
                {t('transactions.nextPage')}
              </button>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
