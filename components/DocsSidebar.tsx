'use client'

// Left navigation for /docs/* (Uniswap-docs style) — active link from pathname,
// off-canvas drawer on mobile, bilingual EN/ES via useI18n.
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { DOC_NAV, DOCS_UI } from '@/lib/docs/nav'

const SECURITY_PDF = {
  en: '/audits/BVCC-Agent-Wallet-Security-Report.pdf',
  es: '/audits/BVCC-Agent-Wallet-Informe-Seguridad.pdf',
}

export default function DocsSidebar() {
  const pathname = usePathname()
  const { lang } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="docs-menu-btn"
        aria-label="Toggle docs menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '✕' : '☰'}
      </button>
      {open && <div className="docs-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`docs-aside${open ? ' open' : ''}`}>
        <Link href="/" className="docs-brand" onClick={() => setOpen(false)}>
          <img src="/bvcc_w.png" alt="BVCC Wallet" width={96} height={96} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
          <div className="docs-kicker">{DOCS_UI.kicker[lang]}</div>
          <LanguageSwitcher />
        </div>

        {DOC_NAV.map((group) => (
          <div className="docs-group" key={group.title.en}>
            <div className="docs-group-h">{group.title[lang]}</div>
            {group.items.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  className={`docs-nav-link${active ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label[lang]}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="docs-group">
          <div className="docs-group-h">{DOCS_UI.links[lang]}</div>
          <a
            className="docs-nav-link"
            href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <a className="docs-nav-link" href={SECURITY_PDF[lang]} target="_blank" rel="noreferrer">
            {DOCS_UI.securityReport[lang]}
          </a>
          <Link className="docs-nav-link" href="/" onClick={() => setOpen(false)}>
            {DOCS_UI.backToWallet[lang]}
          </Link>
        </div>
      </aside>
    </>
  )
}
