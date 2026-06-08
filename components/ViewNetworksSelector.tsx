'use client'
import { useState, useRef, useEffect } from 'react'
import { NETWORKS, type NetworkConfig } from '@/lib/networks'
import { useI18n } from '@/lib/i18n/I18nContext'

function ChainDot({ n, size = 18 }: { n: NetworkConfig; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size / 4),
      overflow: 'hidden', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, backgroundColor: n.color + '22',
    }}>
      <img
        src={n.logo} alt={n.shortName} width={size} height={size}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: Math.round(size / 5) }}
        onError={(e) => {
          const el = e.currentTarget
          el.style.display = 'none'
          el.parentElement!.style.backgroundColor = n.color
        }}
      />
    </span>
  )
}

export default function ViewNetworksSelector({
  selected, onToggle,
}: {
  selected: number[]
  onToggle: (chainId: number) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const selectedNets = NETWORKS.filter(n => selected.includes(n.chainId))
  const testnets = NETWORKS.filter(n => n.isTestnet)
  const mainnets = NETWORKS.filter(n => !n.isTestnet)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger — pila de logos + contador */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px 6px 10px',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          background: open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
          cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {selectedNets.slice(0, 4).map((n, i) => (
            <span key={n.chainId} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i, display: 'flex', borderRadius: 5, boxShadow: '0 0 0 2px #06080f' }}>
              <ChainDot n={n} size={18} />
            </span>
          ))}
        </span>
        <span style={{ fontSize: '12px', color: '#d4d4d4', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
          {selectedNets.length === 1 ? selectedNets[0].shortName : t('dashboard.networksCount').replace('{n}', String(selectedNets.length))}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ opacity: 0.45, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '236px',
          background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          zIndex: 200, padding: '8px',
        }}>
          <div style={{
            fontSize: '10px', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '4px 8px 8px',
          }}>
            {t('dashboard.networksFilter')}
          </div>
          <Group label={t('components.networkGroupMainnets')} networks={mainnets} selected={selected} onToggle={onToggle} />
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
          <Group label={t('components.networkGroupTestnets')} networks={testnets} selected={selected} onToggle={onToggle} />
        </div>
      )}
    </div>
  )
}

function Group({ label, networks, selected, onToggle }: {
  label: string
  networks: NetworkConfig[]
  selected: number[]
  onToggle: (chainId: number) => void
}) {
  return (
    <div>
      <div style={{
        fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em',
        textTransform: 'uppercase', padding: '4px 8px 6px',
      }}>
        {label}
      </div>
      {networks.map(n => {
        const isOn = selected.includes(n.chainId)
        return (
          <button
            key={n.chainId}
            onClick={() => onToggle(n.chainId)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
              padding: '7px 10px', borderRadius: '8px', border: 'none',
              background: isOn ? 'rgba(212,175,55,0.09)' : 'transparent',
              cursor: 'pointer', transition: 'background 0.12s', textAlign: 'left',
            }}
            onMouseEnter={e => { if (!isOn) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isOn ? 'rgba(212,175,55,0.09)' : 'transparent' }}
          >
            <ChainDot n={n} size={20} />
            <span style={{ flex: 1, fontSize: '12px', color: '#e2e2e2', lineHeight: 1 }}>{n.name}</span>
            <span style={{
              width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
              border: '1px solid ' + (isOn ? '#D4AF37' : 'rgba(255,255,255,0.18)'),
              background: isOn ? '#D4AF37' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isOn && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
