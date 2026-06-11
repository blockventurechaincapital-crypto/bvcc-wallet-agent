'use client'

// Left navigation for /docs/* (Uniswap-docs style) — active link from pathname,
// off-canvas drawer on mobile.
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOC_NAV } from '@/lib/docs/nav'

export default function DocsSidebar() {
  const pathname = usePathname()
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
        <div className="docs-kicker">Developer Docs</div>

        {DOC_NAV.map((group) => (
          <div className="docs-group" key={group.title}>
            <div className="docs-group-h">{group.title}</div>
            {group.items.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  className={`docs-nav-link${active ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="docs-group">
          <div className="docs-group-h">Links</div>
          <a
            className="docs-nav-link"
            href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <a
            className="docs-nav-link"
            href="/audits/BVCC-Agent-Wallet-Security-Report.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Security Report (PDF) ↗
          </a>
          <Link className="docs-nav-link" href="/" onClick={() => setOpen(false)}>
            ← Back to BVCC Wallet
          </Link>
        </div>
      </aside>
    </>
  )
}
