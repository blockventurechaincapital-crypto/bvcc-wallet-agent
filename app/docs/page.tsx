import type { Metadata } from 'next'
import Link from 'next/link'
import { DOC_NAV, DOC_FLAT } from '@/lib/docs/nav'

export const metadata: Metadata = { title: 'Developer Docs — BVCC Wallet' }

const C = {
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#d4af37',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  dim: '#8892a4',
}

export default function Page() {
  const next = DOC_FLAT[1] // first guide after the overview

  return (
    <article className="docs-article">
      <p
        style={{
          fontFamily: 'var(--font-plex-mono), monospace',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.gold,
          margin: '0 0 10px',
        }}
      >
        Developer Docs
      </p>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
        Build with BVCC Wallet
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: C.dim, margin: '0 0 28px' }}>
        Integrate AI agents, self-host the app, or talk to the contracts directly. Open source,
        non-custodial, experimental beta. The same docs live as markdown in the{' '}
        <a
          href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent/tree/main/docs"
          target="_blank"
          rel="noreferrer"
          style={{ color: C.gold, textDecoration: 'none' }}
        >
          GitHub repo ↗
        </a>
        .
      </p>

      {DOC_NAV.map((group) => {
        const items = group.items.filter((i) => i.slug !== 'index')
        if (items.length === 0) return null
        return (
          <div key={group.title} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontFamily: 'var(--font-plex-mono), monospace',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.dim,
                marginBottom: 12,
              }}
            >
              {group.title}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {items.map((p) => (
                <Link
                  key={p.slug}
                  href={p.href}
                  style={{
                    display: 'block',
                    padding: '18px 20px',
                    background: C.card,
                    border: `1px solid ${C.goldBorder}`,
                    borderRadius: 12,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ fontSize: 15.5, fontWeight: 650, color: C.text, marginBottom: 7 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.dim }}>{p.blurb}</div>
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: 'var(--font-plex-mono), monospace',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: C.gold,
                    }}
                  >
                    Read →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}

      <div
        style={{
          marginTop: 8,
          padding: '13px 16px',
          background: 'rgba(212,175,55,0.07)',
          border: '1px solid rgba(212,175,55,0.35)',
          borderRadius: 10,
          fontSize: 14,
          lineHeight: 1.65,
          color: C.text,
        }}
      >
        <span style={{ color: C.gold, fontWeight: 700, marginRight: 8 }}>⚠</span>
        Experimental beta software, not externally audited. Non-custodial: BVCC never holds,
        controls or can recover funds. See the{' '}
        <Link href="/legal/terms" style={{ color: C.gold, textDecoration: 'none' }}>
          legal pages
        </Link>{' '}
        before use.
      </div>

      {next && (
        <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
          <div style={{ flex: 1 }} />
          <Link
            href={next.href}
            style={{
              flex: 1,
              display: 'block',
              padding: '14px 18px',
              background: C.card,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 12,
              textDecoration: 'none',
              textAlign: 'right',
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-plex-mono), monospace',
                fontSize: 10.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.dim,
                marginBottom: 6,
              }}
            >
              Next →
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: C.gold }}>{next.label}</div>
          </Link>
        </div>
      )}
    </article>
  )
}
