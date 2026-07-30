'use client'
import { useState } from 'react'
import { formatUnits, type Address } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { useLpPositions, type LpPosition } from '@/lib/useLpPositions'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { buildClaimCall, buildCloseCall } from '@/lib/claimFees'
import { isFullRange, priceAtTick } from '@/lib/tickMath'
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

// Slugs de cadena que usa la interfaz de Uniswap en la URL de una posición. Las que
// no estén aquí (p. ej. Arbitrum Sepolia) simplemente no muestran el enlace.
const UNISWAP_CHAIN: Record<number, string> = {
  1: 'ethereum', 42161: 'arbitrum', 8453: 'base', 137: 'polygon', 56: 'bnb',
}

/** Ficha de la posición en Uniswap, desde donde se puede añadir liquidez. */
function uniswapUrl(p: LpPosition, chainId: number): string | null {
  const chain = UNISWAP_CHAIN[chainId]
  if (!chain) return null
  return `https://app.uniswap.org/positions/v${p.version}/${chain}/${p.tokenId.toString()}`
}

// Un precio de pool puede ser 0,000034 o 62.000: una sola regla de decimales no
// sirve para los dos, así que la precisión se elige por magnitud.
function fmtPrice(v: number): string {
  if (!isFinite(v) || v <= 0) return '—'
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (v >= 0.01) return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return v.toPrecision(3)
}

/**
 * Rango de la posición en precio, más dónde está el precio actual dentro de él.
 *
 * La barra se posiciona en el espacio de TICKS, no de precio: el tick ya es
 * logarítmico, que es como se reparte de verdad la liquidez. En precio lineal, un
 * rango ancho aplastaría la mitad baja contra el borde izquierdo.
 */
function rangeInfo(p: LpPosition) {
  const full = isFullRange(p.tickLower, p.tickUpper, p.tickSpacing)
  const lower = priceAtTick(p.tickLower, p.decimals0, p.decimals1)
  const upper = priceAtTick(p.tickUpper, p.decimals0, p.decimals1)
  const current = priceAtTick(p.tickCurrent, p.decimals0, p.decimals1)
  const span = p.tickUpper - p.tickLower
  const pct = span > 0 ? ((p.tickCurrent - p.tickLower) / span) * 100 : 50

  // Margen hasta salirse, medido en precio sobre el borde más cercano. Fuera de
  // rango es la distancia de vuelta al borde que se cruzó.
  let edge: number | null = null
  if (!full && current > 0) {
    if (p.tickCurrent < p.tickLower) edge = (lower - current) / current
    else if (p.tickCurrent >= p.tickUpper) edge = (current - upper) / current
    else edge = Math.min((current - lower) / current, (upper - current) / current)
  }
  return { full, lower, upper, current, pct: Math.max(0, Math.min(100, pct)), edge }
}

function PositionCard({ p, t, onClaim, onClose, claiming, claimed, chainId }: {
  p: LpPosition; t: (k: string) => string
  onClaim: (p: LpPosition) => void; onClose: (p: LpPosition) => void
  claiming: boolean; claimed: boolean; chainId: number
}) {
  const uni = uniswapUrl(p, chainId)
  const hasFees = p.fees0 > 0n || p.fees1 > 0n
  const r = rangeInfo(p)
  const share0 = p.usd && p.usd > 0 && p.usd0 !== undefined ? (p.usd0 / p.usd) * 100 : null
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

      {/* Reparto del valor entre los dos lados — al moverse el precio, la posición se
          desequilibra hacia el token que el pool está acumulando. */}
      {share0 !== null && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${share0}%`, background: GOLD }} />
            <div style={{ width: `${100 - share0}%`, background: '#4a90d9' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#8892a4' }}>
            <span>{Math.round(share0)}% {p.symbol0}</span>
            <span>{Math.round(100 - share0)}% {p.symbol1}</span>
          </div>
        </div>
      )}

      {/* Rango de la posición */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('positions.range')}
          </span>
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
            color: r.full ? '#4a90d9' : '#a9b2c3',
            border: `1px solid ${r.full ? 'rgba(74,144,217,0.35)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            {r.full ? t('positions.fullRange') : t('positions.customRange')}
          </span>
        </div>

        {r.full ? (
          <div style={{ fontSize: '11px', color: '#8892a4' }}>{t('positions.fullRangeHint')}</div>
        ) : (
          <>
            {/* Barra: los extremos son los bordes del rango, el marcador el precio actual */}
            <div style={{ position: 'relative', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '3px',
                background: p.inRange ? 'rgba(72,187,120,0.25)' : 'rgba(169,118,59,0.2)',
              }} />
              <div style={{
                position: 'absolute', top: '-3px', left: `${r.pct}%`, transform: 'translateX(-50%)',
                width: '3px', height: '12px', borderRadius: '2px',
                background: p.inRange ? '#48bb78' : '#a9763b',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#a9b2c3', fontVariantNumeric: 'tabular-nums' }}>
              <span>{fmtPrice(r.lower)}</span>
              <span style={{ color: '#f0f4f8', fontWeight: 600 }}>{fmtPrice(r.current)}</span>
              <span>{fmtPrice(r.upper)}</span>
            </div>
            <div style={{ marginTop: '3px', fontSize: '10px', color: '#8892a4' }}>
              {p.symbol1} {t('positions.per')} {p.symbol0}
              {r.edge !== null && (
                <span style={{ color: p.inRange ? '#8892a4' : '#a9763b' }}>
                  {' · '}
                  {p.inRange
                    ? `${(r.edge * 100).toFixed(1)}% ${t('positions.toEdge')}`
                    : `${(r.edge * 100).toFixed(1)}% ${t('positions.pastEdge')}`}
                </span>
              )}
            </div>
          </>
        )}
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

      {/* Cerrar (aquí mismo) y añadir (en Uniswap: la app no mintea posiciones) */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
        <button onClick={() => onClose(p)} disabled={p.liquidity === 0n}
          style={{
            flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            border: '1px solid rgba(252,129,129,0.35)', background: 'transparent', color: '#fc8181',
            cursor: p.liquidity === 0n ? 'default' : 'pointer', opacity: p.liquidity === 0n ? 0.4 : 1,
          }}>
          {t('positions.close')}
        </button>
        {uni && (
          <a href={uni} target="_blank" rel="noopener noreferrer"
            title={t('positions.addHint')}
            style={{
              flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              border: `1px solid ${GOLD}44`, background: 'transparent', color: GOLD,
              textAlign: 'center', textDecoration: 'none',
            }}>
            {t('positions.add')} ↗
          </a>
        )}
      </div>

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
  const [closing, setClosing] = useState<LpPosition | null>(null)
  const [pct, setPct] = useState(100)
  const [closeBusy, setCloseBusy] = useState(false)
  const [closeError, setCloseError] = useState('')

  const openClose = (p: LpPosition) => { setClosing(p); setPct(100); setCloseError('') }

  const confirmClose = async () => {
    if (!closing || !address || !credentialId) return
    setCloseBusy(true)
    setCloseError('')
    try {
      const call = buildCloseCall(closing, address as Address, network.chainId, pct * 100)
      await executeWithFaceId({ network, walletAddress: address as Address, credentialId, calls: [call], submitUserOp })
      setClosing(null)
      setTimeout(reload, 2500)
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : String(e))
    } finally {
      setCloseBusy(false)
    }
  }

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
          return <PositionCard key={key} p={p} t={t} onClaim={claim} onClose={openClose}
            claiming={busy === key} claimed={!!done[key]} chainId={network.chainId} />
        })}
      </div>

      {/* Modal de cierre — cuánto retirar */}
      {closing && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !closeBusy) setClosing(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '380px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f0f4f8' }}>
              {t('positions.closeTitle')} · {closing.symbol0}/{closing.symbol1}
            </h2>
            <p style={{ margin: '6px 0 16px', fontSize: '12px', color: '#8892a4' }}>
              {pct === 100 ? t('positions.closeAllHint') : t('positions.closePartHint')}
            </p>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {[25, 50, 75, 100].map((v) => (
                <button key={v} onClick={() => setPct(v)} disabled={closeBusy}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${pct === v ? GOLD : 'rgba(255,255,255,0.1)'}`,
                    background: pct === v ? `${GOLD}18` : 'transparent',
                    color: pct === v ? GOLD : '#a9b2c3', cursor: closeBusy ? 'default' : 'pointer',
                  }}>
                  {v}%
                </button>
              ))}
            </div>

            {/* Lo que sale: los montos actuales escalados por el porcentaje */}
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', fontSize: '12px', color: '#a9b2c3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{closing.symbol0}</span>
                <span style={{ color: '#f0f4f8' }}>≈ {fmt(closing.amount0 * BigInt(pct) / 100n, closing.decimals0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <span>{closing.symbol1}</span>
                <span style={{ color: '#f0f4f8' }}>≈ {fmt(closing.amount1 * BigInt(pct) / 100n, closing.decimals1)}</span>
              </div>
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px' }}>
                {t('positions.closeFeesNote')}
              </div>
            </div>

            {closeError && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#fc8181', wordBreak: 'break-word' }}>{closeError}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setClosing(null)} disabled={closeBusy}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8892a4', fontSize: '13px', cursor: closeBusy ? 'default' : 'pointer' }}>
                {t('positions.cancel')}
              </button>
              <button onClick={confirmClose} disabled={closeBusy}
                style={{ flex: 2, padding: '10px', borderRadius: '6px', border: 'none', background: closeBusy ? 'rgba(252,129,129,0.4)' : '#fc8181', color: '#0d1117', fontSize: '13px', fontWeight: 700, cursor: closeBusy ? 'default' : 'pointer' }}>
                {closeBusy ? t('positions.closing') : `${t('positions.closeConfirm')} ${pct}%`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
