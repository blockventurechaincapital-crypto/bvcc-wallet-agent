'use client'
import { useState, useRef, useEffect } from 'react'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import type { NetworkConfig } from '@/lib/networks'

export default function NetworkSelector() {
  const { network, networks, setNetworkByChainId } = useNetwork()
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

  const testnets = networks.filter(n => n.isTestnet)
  const mainnets = networks.filter(n => !n.isTestnet)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px 5px 8px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          background: open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      >
        <span style={{
          width: '18px', height: '18px', borderRadius: '4px',
          overflow: 'hidden', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
          backgroundColor: network.color + '22',
        }}>
          <img
            src={network.logo}
            alt={network.shortName}
            width={18}
            height={18}
            style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '3px' }}
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              el.parentElement!.style.backgroundColor = network.color
            }}
          />
        </span>
        <span style={{
          fontSize: '11px', color: '#d4d4d4', letterSpacing: '0.04em',
          fontFamily: 'IBM Plex Mono, monospace', whiteSpace: 'nowrap',
        }}>
          {network.shortName}
        </span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ opacity: 0.45, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '228px',
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          zIndex: 200,
          padding: '8px',
        }}>
          <NetworkGroup
            label={t('components.networkGroupTestnets')}
            networks={testnets}
            activeChainId={network.chainId}
            onSelect={id => { setNetworkByChainId(id); setOpen(false) }}
          />
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
          <NetworkGroup
            label={t('components.networkGroupMainnets')}
            networks={mainnets}
            activeChainId={network.chainId}
            onSelect={id => { setNetworkByChainId(id); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}

function NetworkGroup({ label, networks, activeChainId, onSelect }: {
  label: string
  networks: NetworkConfig[]
  activeChainId: number
  onSelect: (chainId: number) => void
}) {
  const { t } = useI18n()
  return (
    <div>
      <div style={{
        fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em',
        textTransform: 'uppercase', padding: '4px 8px 6px',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {label}
      </div>
      {networks.map(n => {
        const isActive = n.chainId === activeChainId
        const isDeployed = n.contracts.factory !== null
        return (
          <button
            key={n.chainId}
            onClick={() => isDeployed && onSelect(n.chainId)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: 'none',
              background: isActive ? 'rgba(212,175,55,0.09)' : 'transparent',
              cursor: isDeployed ? 'pointer' : 'default',
              opacity: isDeployed ? 1 : 0.38,
              transition: 'background 0.12s',
              textAlign: 'left',
            }}
            onMouseEnter={e => {
              if (isDeployed && !isActive)
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isActive ? 'rgba(212,175,55,0.09)' : 'transparent'
            }}
          >
            <span style={{
              width: '20px', height: '20px', borderRadius: '5px',
              overflow: 'hidden', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
              backgroundColor: (isDeployed ? n.color : 'rgba(255,255,255,0.15)') + '22',
            }}>
              <img
                src={n.logo}
                alt={n.name}
                width={20}
                height={20}
                style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px', opacity: isDeployed ? 1 : 0.3 }}
                onError={(e) => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  el.parentElement!.style.backgroundColor = isDeployed ? n.color : 'rgba(255,255,255,0.15)'
                }}
              />
            </span>
            <span style={{ flex: 1, fontSize: '12px', color: '#e2e2e2', lineHeight: 1 }}>
              {n.name}
            </span>
            {isActive && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {!isDeployed && (
              <span style={{
                fontSize: '9px', color: 'rgba(255,255,255,0.22)',
                fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em',
              }}>
                {t('components.networkSoon')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
