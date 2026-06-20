'use client'
import { useState } from 'react'
import { formatUnits, type Address } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { useLpPositions, type LpPosition } from '@/lib/useLpPositions'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { buildClaimCall } from '@/lib/claimFees'
import { useI18n } from '@/lib/i18n/I18nContext'

const GOLD = '#D4AF37'

function feePct(fee: number): string {
  const p = fee / 10000
  return `${p % 1 === 0 ? p.toFixed(0) : p}%`
}
function fmt(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
function fmtUsd(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function PositionCard({ p, t, onClaim, claiming, claimed }: {
  p: LpPosition; t: (k: string) => string
  onClaim: (p: LpPosition) => void; claiming: boolean; claimed: boolean
}) {
  const hasFees = p.fees0 > 0n || p.fees1 > 0n
  return (
    <div style={{ padding: '16px', borderRadius: '12px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#f0f4f8' }}>{p.symbol0} / {p.symbol1}</span>
          <span style={{ fontSize: '11px', color: '#a9b2c3', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 6px' }}>{feePct(p.fee)}</span>
        </div>
        <span style={{ fontSize: '10px', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '2px 7px', whiteSpace: 'nowrap' }}>Uniswap v{p.version}</span>
      </div>

      {/* Valor total en USD */}
      {p.usd !== undefined && (
        <div style={{ marginTop: '10px', fontSize: '20px', fontWeight: 700, color: '#f0f4f8' }}>{fmtUsd(p.usd)}</div>
      )}

      {/* Montos por token */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: '#8892a4' }}>{p.symbol0}</span>
          <span style={{ color: '#f0f4f8', fontWeight: 600 }}>{fmt(p.amount0, p.decimals0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: '#8892a4' }}>{p.symbol1}</span>
          <span style={{ color: '#f0f4f8', fontWeight: 600 }}>{fmt(p.amount1, p.decimals1)}</span>
        </div>
      </div>

      {/* Comisiones reclamables */}
      {hasFees && (
        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(72,187,120,0.07)', border: '1px solid rgba(72,187,120,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '10px', color: '#48bb78', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('positions.claimable')}</span>
            {p.usdFees !== undefined && p.usdFees > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: '#48bb78' }}>{fmtUsd(p.usdFees)}</span>}
          </div>
          <div style={{ fontSize: '12px', color: '#a9b2c3', marginTop: '2px' }}>
            {fmt(p.fees0, p.decimals0)} {p.symbol0} · {fmt(p.fees1, p.decimals1)} {p.symbol1}
          </div>
          <button onClick={() => onClaim(p)} disabled={claiming || claimed}
            style={{ marginTop: '8px', width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(72,187,120,0.4)', background: claimed ? 'transparent' : 'rgba(72,187,120,0.12)', color: '#48bb78', fontSize: '12px', fontWeight: 600, cursor: claiming || claimed ? 'default' : 'pointer' }}>
            {claimed ? t('positions.claimed') : claiming ? t('positions.claiming') : t('positions.claim')}
          </button>
        </div>
      )}

      {/* Estado de rango + tokenId */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: p.inRange ? '#48bb78' : '#a9763b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.inRange ? '#48bb78' : '#a9763b', display: 'inline-block' }} />
          {p.inRange ? t('positions.inRange') : t('positions.outOfRange')}
        </span>
        <span style={{ fontSize: '11px', color: '#4a5568', fontFamily: 'monospace' }}>#{p.tokenId.toString()}</span>
      </div>
    </div>
  )
}

export default function PositionsPage() {
  const { address, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const submitUserOp = useSubmitUserOp()
  const { t } = useI18n()
  const { items, loading, error, reload } = useLpPositions(address)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  const claim = async (p: LpPosition) => {
    if (!address || !credentialId) return
    const key = `${p.version}-${p.tokenId}`
    setBusy(key)
    try {
      const call = buildClaimCall(p, address as Address, network.chainId)
      await executeWithFaceId({ network, walletAddress: address as Address, credentialId, calls: [call], submitUserOp })
      setDone((d) => ({ ...d, [key]: true }))
      setTimeout(reload, 2500)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f4f8', margin: 0 }}>{t('positions.title')}</h1>
        <button onClick={reload} disabled={loading}
          style={{ padding: '7px 14px', borderRadius: '7px', border: `1px solid ${GOLD}55`, background: 'transparent', color: GOLD, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {t('positions.refresh')}
        </button>
      </div>
      <p style={{ color: '#8892a4', fontSize: '13px', margin: '0 0 20px', maxWidth: '620px' }}>{t('positions.subtitle')}</p>

      {loading && <div style={{ color: '#8892a4', fontSize: '13px' }}>{t('positions.loading')}</div>}
      {error && <div style={{ color: '#fc8181', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div style={{ color: '#8892a4', fontSize: '13px' }}>{t('positions.empty')}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {items.map((p) => {
          const key = `${p.version}-${p.tokenId}`
          return <PositionCard key={key} p={p} t={t} onClaim={claim} claiming={busy === key} claimed={!!done[key]} />
        })}
      </div>
    </div>
  )
}
