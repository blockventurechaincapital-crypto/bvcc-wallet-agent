'use client'

import { useState } from 'react'

interface DisclaimerModalProps {
  title: string
  intro: string
  checkboxes: string[]
  confirmLabel: string
  /** Label for the single required confirmation checkbox at the bottom. */
  finalCheckboxLabel: string
  /** Optional links to full legal pages, shown under the intro (open in a new tab). */
  links?: { label: string; href: string }[]
  /** Optional label preceding the links row. */
  linksLabel?: string
  onAccept: () => void
  onClose: () => void
}

export default function DisclaimerModal({
  title,
  intro,
  checkboxes,
  confirmLabel,
  finalCheckboxLabel,
  links,
  linksLabel,
  onAccept,
  onClose,
}: DisclaimerModalProps) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#0d1117',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f0f4f8', margin: '0 0 14px' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#8892a4', margin: '0 0 16px' }}>
          {intro}
        </p>

        {links && links.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 12px',
              margin: '0 0 20px',
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {linksLabel && (
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#4a5568',
                }}
              >
                {linksLabel}
              </span>
            )}
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: '#d4af37', textDecoration: 'none' }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>
        )}

        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 22px',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {checkboxes.map((label, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: '#f0f4f8',
              }}
            >
              <span style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }}>✓</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: '#f0f4f8',
            padding: '12px 0',
            marginBottom: 16,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={() => setAgreed((v) => !v)}
            style={{ accentColor: '#D4AF37', marginTop: 2, flexShrink: 0 }}
          />
          <span>{finalCheckboxLabel}</span>
        </label>

        <button
          type="button"
          onClick={() => {
            if (agreed) onAccept()
          }}
          disabled={!agreed}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            fontSize: 14,
            color: '#000',
            background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)',
            opacity: agreed ? 1 : 0.4,
            cursor: agreed ? 'pointer' : 'not-allowed',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
