'use client'
import React from 'react'
import { useI18n } from '@/lib/i18n/I18nContext'
import { ExplorerAddress } from '@/components/ExplorerAddress'
import {
  CAPABILITY_ORDER,
  agentCapabilitiesFor,
  capabilityBundle,
  composeFromCapabilities,
  type CapabilityId,
} from '@/lib/agentCapabilities'

const C = {
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.08)',
  goldBorder: 'rgba(212,175,55,0.35)',
  text: '#f0f4f8',
  muted: '#8892a4',
  subtle: '#5a6474',
}

/**
 * "What should this agent be able to do?" — checkboxes for capabilities, each of
 * which composes the underlying protocols/tokens/recipients. When a capability is
 * on, the exact addresses it adds are shown, every one a link to the explorer's
 * Contract tab so the user can verify they're the real contracts.
 */
export function CapabilityPicker({
  chainId,
  explorerBase,
  selected,
  onChange,
}: {
  chainId: number
  explorerBase?: string
  selected: CapabilityId[]
  onChange: (next: CapabilityId[]) => void
}) {
  const { t } = useI18n()
  const available = agentCapabilitiesFor(chainId)
  if (available.length === 0) return null

  const isOn = (id: CapabilityId) => selected.includes(id)
  const toggle = (id: CapabilityId) =>
    onChange(isOn(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const composed = composeFromCapabilities(chainId, selected)

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '11px',
          color: C.muted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}
      >
        {t('agents.cap.title')}
      </label>
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: C.subtle, lineHeight: 1.5 }}>
        {t('agents.cap.subtitle')}
      </p>
      <a
        href="/docs/agent-permissions"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-block', marginBottom: '12px', fontSize: '12px', color: C.gold, textDecoration: 'none' }}
      >
        {t('agents.cap.learnMore')}
      </a>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {CAPABILITY_ORDER.filter((id) => available.includes(id)).map((id) => {
          const on = isOn(id)
          const bundle = capabilityBundle(chainId, id)
          const addrs = bundle
            ? Array.from(
                new Map(
                  [...bundle.protocols, ...bundle.requiredTokens, ...bundle.recipients].map((a) => [
                    a.toLowerCase(),
                    a,
                  ]),
                ).values(),
              )
            : []
          return (
            <div
              key={id}
              style={{
                border: `1px solid ${on ? C.goldBorder : C.border}`,
                background: on ? C.goldDim : 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                padding: '12px 14px',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(id)}
                  style={{ marginTop: '2px', accentColor: C.gold, width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text }}>
                    {t(`agents.cap.${id}.title`)}
                  </span>
                  <span style={{ display: 'block', fontSize: '12px', color: C.muted, lineHeight: 1.45, marginTop: '2px' }}>
                    {t(`agents.cap.${id}.desc`)}
                  </span>
                </span>
              </label>

              {on && addrs.length > 0 && (
                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '10px', color: C.subtle, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {t('agents.cap.addsAddresses')}
                  </span>
                  {addrs.map((a) => (
                    <ExplorerAddress key={a} addr={a} explorerBase={explorerBase} tab="code" />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary of what the selection composes, so nothing is hidden. */}
      {selected.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.015)',
            fontSize: '12px',
            color: C.muted,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: C.text }}>{t('agents.cap.willAdd')}</strong>{' '}
          {composed.requiredTokens.length > 0 && (
            <span>
              {t('agents.cap.willAddTokens')} ({composed.requiredTokens.length}); {' '}
            </span>
          )}
          {t('agents.cap.willAddProtocols')} ({composed.protocols.length}). {' '}
          {composed.recipients.length > 0 && <span>{t('agents.cap.willAddRecipientsNote')}</span>}
        </div>
      )}
    </div>
  )
}

export default CapabilityPicker
