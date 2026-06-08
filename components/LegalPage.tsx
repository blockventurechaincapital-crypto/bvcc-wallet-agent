'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nContext'
import { dict } from '@/lib/i18n/translations'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export type LegalSlug = 'terms' | 'risk' | 'nonCustodial' | 'agent' | 'fees' | 'privacy' | 'swap'

const PAGES: { slug: LegalSlug; href: string }[] = [
  { slug: 'terms', href: '/legal/terms' },
  { slug: 'risk', href: '/legal/risk-disclosure' },
  { slug: 'nonCustodial', href: '/legal/non-custodial' },
  { slug: 'agent', href: '/legal/agent-wallet' },
  { slug: 'swap', href: '/legal/swap-fast' },
  { slug: 'fees', href: '/legal/fees' },
  { slug: 'privacy', href: '/legal/privacy' },
]

const C = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#d4af37',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  dim: '#8892a4',
  muted: '#4a5568',
}

interface LegalContent {
  title: string
  intro: string
  body: string[]
  feeWalletLabel?: string
  address?: string
}

export default function LegalPage({ slug }: { slug: LegalSlug }) {
  const { lang, t } = useI18n()
  const L = (dict[lang] as Record<string, unknown>).legal as Record<string, unknown>
  const data = L[slug] as LegalContent

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.08), transparent 58%), ' + C.bg,
        color: C.text,
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <Link
            href="/"
            style={{ color: C.dim, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
          >
            {t('legal.back')}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Header */}
        <img
          src="/bvcc_w.png"
          alt="BVCC Wallet"
          width={88}
          height={88}
          style={{ height: 88, width: 'auto', objectFit: 'contain', display: 'block', marginBottom: 18 }}
        />
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
          {t('legal.kicker')}
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
          {data.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: C.dim, margin: '0 0 28px' }}>{data.intro}</p>

        {/* Body */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.body.map((item, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 2, fontSize: 13 }}>●</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text }}>{item}</span>
            </li>
          ))}
        </ul>

        {/* Fee wallet address (fees page only) */}
        {data.address && (
          <div
            style={{
              marginTop: 26,
              padding: '16px 18px',
              background: C.card,
              border: `1px solid ${C.goldBorder}`,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: C.dim,
                marginBottom: 8,
              }}
            >
              {data.feeWalletLabel}
            </div>
            <code
              style={{
                fontFamily: 'var(--font-plex-mono), monospace',
                fontSize: 13,
                color: C.gold,
                wordBreak: 'break-all',
              }}
            >
              {data.address}
            </code>
          </div>
        )}

        {/* Brand/project note */}
        <p
          style={{
            marginTop: 34,
            paddingTop: 22,
            borderTop: `1px solid ${C.border}`,
            fontSize: 12.5,
            lineHeight: 1.6,
            color: C.muted,
          }}
        >
          {t('legal.note')}
        </p>

        {/* Cross-links to other legal pages */}
        <div style={{ marginTop: 30 }}>
          <div
            style={{
              fontFamily: 'var(--font-plex-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.gold,
              marginBottom: 14,
            }}
          >
            {t('legal.moreHeading')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px' }}>
            {PAGES.map((p) => {
              const active = p.slug === slug
              return (
                <Link
                  key={p.slug}
                  href={p.href}
                  style={{
                    fontSize: 13.5,
                    textDecoration: 'none',
                    color: active ? C.gold : C.dim,
                    fontWeight: active ? 600 : 500,
                    pointerEvents: active ? 'none' : 'auto',
                  }}
                >
                  {t(`legal.nav.${p.slug}`)}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
