'use client'

// /docs index — grouped card grid, bilingual EN/ES.
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nContext'
import { DOC_NAV, DOC_FLAT, DOCS_UI } from '@/lib/docs/nav'

const C = {
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#d4af37',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  dim: '#8892a4',
}

const T = {
  title: { en: 'Build with BVCC Wallet', es: 'Construye con BVCC Wallet' },
  intro1: {
    en: 'Integrate AI agents, self-host the app, or talk to the contracts directly. Open source, non-custodial, experimental beta. The same docs live as markdown in the ',
    es: 'Integra agentes IA, hospeda la app tú mismo o habla directamente con los contratos. Open source, non-custodial, beta experimental. Estas mismas docs viven como markdown en el ',
  },
  introLink: { en: 'GitHub repo ↗', es: 'repo de GitHub ↗' },
  warning: {
    en: 'Experimental beta software, not externally audited. Non-custodial: BVCC never holds, controls or can recover funds. See the ',
    es: 'Software experimental en beta, sin auditoría externa. Non-custodial: BVCC nunca custodia, controla ni puede recuperar fondos. Consulta las ',
  },
  warningLink: { en: 'legal pages', es: 'páginas legales' },
  warningEnd: { en: ' before use.', es: ' antes de usarla.' },
}

export default function DocsIndex() {
  const { lang } = useI18n()
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
        {DOCS_UI.kicker[lang]}
      </p>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
        {T.title[lang]}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.65, color: C.dim, margin: '0 0 28px' }}>
        {T.intro1[lang]}
        <a
          href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent/tree/main/docs"
          target="_blank"
          rel="noreferrer"
          style={{ color: C.gold, textDecoration: 'none' }}
        >
          {T.introLink[lang]}
        </a>
        .
      </p>

      {DOC_NAV.map((group) => {
        const items = group.items.filter((i) => i.slug !== 'index')
        if (items.length === 0) return null
        return (
          <div key={group.title.en} style={{ marginBottom: 28 }}>
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
              {group.title[lang]}
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
                    {p.label[lang]}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.dim }}>{p.blurb[lang]}</div>
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
                    {DOCS_UI.read[lang]}
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
        {T.warning[lang]}
        <Link href="/legal/terms" style={{ color: C.gold, textDecoration: 'none' }}>
          {T.warningLink[lang]}
        </Link>
        {T.warningEnd[lang]}
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
              {DOCS_UI.next[lang]}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: C.gold }}>{next.label[lang]}</div>
          </Link>
        </div>
      )}
    </article>
  )
}
