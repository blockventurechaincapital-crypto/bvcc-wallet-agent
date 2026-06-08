'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

/* ────────────────────────────────────────────────────────────────────────────
   BVCC Wallet — Marketing landing
   Brand system (blockventurechaincapital.com): deep black + antique gold.
   bg #06080f · surface #0d1117 · accent #d4af37 → #ecc84a · green #22c55e · Inter
   ──────────────────────────────────────────────────────────────────────────── */

interface MarketingLandingProps {
  onCreate: () => void
  onAccess: () => void
  onRecover: () => void
  onDirectAccess: () => void
  walletExists: boolean
  loading: boolean
  error?: string | null
}

const NETWORKS = ['Ethereum', 'Arbitrum', 'Base', 'BNB Chain', 'Arbitrum Sepolia']

export default function MarketingLanding({
  onCreate,
  onAccess,
  onRecover,
  onDirectAccess,
  walletExists,
  loading,
  error,
}: MarketingLandingProps) {
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('[data-reveal]')
    if (!els) return
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  const CAPABILITIES = [
    {
      n: '01',
      title: t('marketing.cap01Title'),
      body: t('marketing.cap01Body'),
      tag: t('marketing.cap01Tag'),
    },
    {
      n: '02',
      title: t('marketing.cap02Title'),
      body: t('marketing.cap02Body'),
      tag: t('marketing.cap02Tag'),
    },
    {
      n: '03',
      title: t('marketing.cap03Title'),
      body: t('marketing.cap03Body'),
      tag: t('marketing.cap03Tag'),
    },
    {
      n: '04',
      title: t('marketing.cap04Title'),
      body: t('marketing.cap04Body'),
      tag: t('marketing.cap04Tag'),
    },
  ]

  const STEPS = [
    { k: '01', title: t('marketing.step01Title'), desc: t('marketing.step01Body') },
    { k: '02', title: t('marketing.step02Title'), desc: t('marketing.step02Body') },
    { k: '03', title: t('marketing.step03Title'), desc: t('marketing.step03Body') },
    { k: '04', title: t('marketing.step04Title'), desc: t('marketing.step04Body') },
  ]

  const AGENT_FEATURES = [
    [t('marketing.agentFeature1Title'), t('marketing.agentFeature1Body')],
    [t('marketing.agentFeature2Title'), t('marketing.agentFeature2Body')],
    [t('marketing.agentFeature3Title'), t('marketing.agentFeature3Body')],
    [t('marketing.agentFeature4Title'), t('marketing.agentFeature4Body')],
  ]

  const SEC_STATS = [
    [t('marketing.secStat1Title'), t('marketing.secStat1Body')],
    [t('marketing.secStat2Title'), t('marketing.secStat2Body')],
    [t('marketing.secStat3Title'), t('marketing.secStat3Body')],
    [t('marketing.secStat4Title'), t('marketing.secStat4Body')],
  ]

  return (
    <div ref={rootRef} className="bvcc-mk">
      <style>{styles}</style>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="#top" aria-label="BVCC Wallet">
            <img className="nav-logo" src="/bvcc_w.png" alt="BVCC Wallet" width={96} height={96} />
          </a>
          <nav className="nav-links">
            <a href="#agentes">{t('marketing.navAgents')}</a>
            <a href="#manifiesto">{t('marketing.navPhilosophy')}</a>
            <a href="#codigo">{t('marketing.navOpenSource')}</a>
            <a href="#redes">{t('marketing.navNetworks')}</a>
          </nav>
          <div className="nav-cta">
            <LanguageSwitcher className="nav-lang" />
            <a className="link-btn gh" href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent" target="_blank" rel="noreferrer">{t('marketing.navGithub')}</a>
            {walletExists ? (
              <button className="link-btn" onClick={onDirectAccess}>
                {t('marketing.navEnter')}
              </button>
            ) : (
              <button className="link-btn" onClick={onAccess}>
                {t('marketing.navAccess')}
              </button>
            )}
            <button className="btn-gold" onClick={onCreate} disabled={loading}>
              {loading ? t('marketing.waitingBiometrics') : t('marketing.navCreateWallet')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden />
        <div className="hero-grid-tex" aria-hidden />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow load" style={{ animationDelay: '.05s' }}>
              <span className="eyebrow-dot" /> {t('marketing.eyebrow')}
            </p>
            <h1 className="display">
              <span className="load" style={{ animationDelay: '.12s' }}>{t('marketing.heroLine1')}</span>
              <span className="load" style={{ animationDelay: '.20s' }}>{t('marketing.heroLine2')}</span>
              <span className="load" style={{ animationDelay: '.28s' }}>
                {t('marketing.heroLine3Part1')} <span className="gold-text">{t('marketing.heroLine3Gold')}</span>{t('marketing.heroLine3Part2')}
              </span>
            </h1>
            <p className="lede load" style={{ animationDelay: '.40s' }}>
              {t('marketing.lede')}
            </p>
            <div className="hero-actions load" style={{ animationDelay: '.50s' }}>
              <button className="btn-gold lg" onClick={onCreate} disabled={loading}>
                {loading ? t('marketing.waitingBiometrics') : t('marketing.heroCreateBtn')}
                <span className="btn-arrow">→</span>
              </button>
              <button className="btn-quiet lg" onClick={onAccess}>
                {t('marketing.heroIHaveOne')}
              </button>
            </div>
            <p className="recover-line load" style={{ animationDelay: '.58s' }}>
              {t('marketing.recoverLine')}{' '}
              <button className="underline-btn" onClick={onRecover}>
                {t('marketing.recoverCta')}
              </button>
            </p>
            <p
              className="load"
              style={{
                animationDelay: '.62s',
                color: 'var(--dim)',
                fontSize: '12px',
                lineHeight: 1.5,
                maxWidth: '440px',
                marginTop: '14px',
              }}
            >
              {t('marketing.heroRiskNotice')}
            </p>
          </div>

          {/* Account card — premium instrument */}
          <aside className="hero-aside load" style={{ animationDelay: '.34s' }}>
            <div className="card-glow" aria-hidden />
            <div className="acct">
              <div className="acct-top">
                <img className="acct-logo" src="/bvcc_wallet.png" alt="BVCC Wallet" width={56} height={56} />
                <span className="acct-chip">{t('marketing.cardChip')}</span>
              </div>
              <p className="acct-kicker">{t('marketing.cardKicker')}</p>
              <div className="perm-budget">
                <div className="perm-budget-head">
                  <span>{t('marketing.cardBudgetLabel')}</span>
                  <span className="mono">1.2 / 5 ETH</span>
                </div>
                <div className="perm-bar"><span style={{ width: '24%' }} /></div>
              </div>
              <div className="acct-rule" />
              <dl className="acct-rows">
                <div><dt>{t('marketing.cardRecipients')}</dt><dd>{t('marketing.cardRecipientsValue')}</dd></div>
                <div><dt>{t('marketing.cardRenewal')}</dt><dd className="mono">{t('marketing.cardRenewalValue')}</dd></div>
                <div><dt>{t('marketing.cardStatus')}</dt><dd className="perm-live">{t('marketing.cardStatusValue')}</dd></div>
              </dl>
              <div className="acct-seal">
                <span className="seal-ring"><span className="seal-glyph">⌖</span></span>
                <span className="seal-text" style={{ whiteSpace: 'pre-line' }}>{t('marketing.cardSealText')}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Network ticker ──────────────────────────────────── */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...NETWORKS, ...NETWORKS, ...NETWORKS].map((n, i) => (
            <span key={i} className="ticker-item">
              {n} <span className="ticker-dot">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Agents (differentiator) ─────────────────────────── */}
      <section className="agents" id="agentes">
        <div className="agents-grid">
          <div className="agents-copy" data-reveal>
            <p className="section-index">{t('marketing.sectionAgents')}</p>
            <h2 className="h2">
              {t('marketing.agentsH2Part1')} <span className="gold-text">{t('marketing.agentsH2Gold')}</span> {t('marketing.agentsH2Part2')}
            </h2>
            <p className="agents-lede">
              {t('marketing.agentsLede')}
            </p>
            <button className="btn-gold" onClick={onCreate} disabled={loading}>
              {t('marketing.agentsCreateBtn')} <span className="btn-arrow">→</span>
            </button>
          </div>
          <ul className="agents-list" data-reveal>
            {AGENT_FEATURES.map(([title, desc]) => (
              <li key={title}>
                <span className="agent-tick">✦</span>
                <div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Manifesto ───────────────────────────────────────── */}
      <section className="manifesto" id="manifiesto">
        <p className="section-index" data-reveal>{t('marketing.sectionPhilosophy')}</p>
        <blockquote className="quote" data-reveal>
          {t('marketing.quoteText')}{' '}
          <span className="gold-text">{t('marketing.quoteGold')}</span>{t('marketing.quoteEnd')}
        </blockquote>
        <p className="quote-by mono" data-reveal>{t('marketing.quoteBy')}</p>
      </section>

      {/* ── Capabilities ────────────────────────────────────── */}
      <section className="caps" id="capacidades">
        <header className="caps-head">
          <p className="section-index" data-reveal>{t('marketing.sectionCaps')}</p>
          <h2 className="h2" data-reveal>
            {t('marketing.capsH2Part1')} <span className="gold-text">{t('marketing.capsH2Gold')}</span>{t('marketing.capsH2Part2')}
          </h2>
        </header>
        <ol className="caps-list">
          {CAPABILITIES.map((c, i) => (
            <li className="cap" key={c.n} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="cap-n">{c.n}</span>
              <div className="cap-body">
                <h3 className="cap-title">{c.title}</h3>
                <p className="cap-text">{c.body}</p>
                <span className="cap-tag mono">{c.tag}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="how">
        <div className="how-inner">
          <p className="section-index" data-reveal>{t('marketing.sectionHow')}</p>
          <div className="how-grid">
            {STEPS.map((s, i) => (
              <div className="step" key={s.k} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="step-k mono">{s.k}</span>
                <h3 className="step-t">{s.title}</h3>
                <p className="step-d">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────── */}
      <section className="security">
        <div className="sec-glow" aria-hidden />
        <div className="sec-inner">
          <div className="sec-copy" data-reveal>
            <p className="section-index">{t('marketing.sectionSecurity')}</p>
            <h2 className="h2">
              {t('marketing.secH2Part1')} <span className="gold-text">{t('marketing.secH2Gold')}</span>{t('marketing.secH2Part2')}
            </h2>
            <p className="sec-lede">
              {t('marketing.secLede')}
            </p>
          </div>
          <dl className="sec-stats" data-reveal>
            {SEC_STATS.map(([title, desc]) => (
              <div className="sec-stat" key={title}>
                <span className="sec-check">✓</span>
                <div>
                  <dt className="mono">{title}</dt>
                  <dd>{desc}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Open source ─────────────────────────────────────── */}
      <section className="oss" id="codigo">
        <div className="oss-grid">
          <div className="oss-copy" data-reveal>
            <p className="section-index">{t('marketing.sectionOss')}</p>
            <h2 className="h2">
              {t('marketing.ossH2Part1')} <span className="gold-text">{t('marketing.ossH2Gold')}</span>{t('marketing.ossH2Part2')}
            </h2>
            <p className="oss-lede">
              {t('marketing.ossLede')}
            </p>
            <a
              className="btn-gold"
              href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent"
              target="_blank"
              rel="noreferrer"
            >
              {t('marketing.ossGithubBtn')} <span className="btn-arrow">→</span>
            </a>
          </div>
          <div className="oss-term" data-reveal>
            <div className="term-head">
              <span className="term-dot" /><span className="term-dot" /><span className="term-dot" />
              <span className="term-title mono">bvcc-wallet-agent — local</span>
            </div>
            <div className="term-body mono">
              <p className="t-line"><span className="t-prompt">$</span> git clone github.com/blockventurechaincapital-crypto/bvcc-wallet-agent</p>
              <p className="t-line"><span className="t-prompt">$</span> cd bvcc-wallet-agent && npm install</p>
              <p className="t-line"><span className="t-prompt">$</span> npm run dev</p>
              <p className="t-line t-ok">{t('marketing.termLocalDashboard')}</p>
              <p className="t-line t-ok">{t('marketing.termKeysNote')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fees + Networks ─────────────────────────────────── */}
      <section className="ledger" id="redes">
        <div className="ledger-grid">
          <div className="fees" data-reveal>
            <p className="section-index">{t('marketing.sectionFees')}</p>
            <div className="fee-row">
              <span className="fee-pct gold-text">0.05%</span>
              <span className="fee-label">
                <strong>Smart Wallet</strong>
                <span>{t('marketing.feePerTx')}</span>
              </span>
            </div>
            <div className="fee-row">
              <span className="fee-pct gold-text">0.15%</span>
              <span className="fee-label">
                <strong>Agent Wallet</strong>
                <span>{t('marketing.feePerTx')}</span>
              </span>
            </div>
            <p className="fees-note">
              {t('marketing.feesNote')}
            </p>
          </div>
          <div className="nets" data-reveal>
            <p className="section-index">{t('marketing.sectionDeployed')}</p>
            <ul className="net-list">
              <li><span className="net-n mono">01</span> Ethereum</li>
              <li><span className="net-n mono">02</span> Arbitrum</li>
              <li><span className="net-n mono">03</span> Base</li>
              <li><span className="net-n mono">04</span> BNB Chain</li>
            </ul>
            <p className="net-testnet mono">{t('marketing.testnetActive')}</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="cta">
        <div className="cta-glow" aria-hidden />
        <img className="cta-logo" src="/bvcc_wallet.png" alt="" width={72} height={72} data-reveal />
        <h2 className="cta-title" data-reveal>
          {t('marketing.ctaTitle1')} <span className="gold-text">{t('marketing.ctaTitle2Gold')}</span>
        </h2>
        <div className="cta-actions" data-reveal>
          <button className="btn-gold lg" onClick={onCreate} disabled={loading}>
            {loading ? t('marketing.waitingBiometrics') : t('marketing.heroCreateBtn')}
            <span className="btn-arrow">→</span>
          </button>
          <button className="btn-quiet lg" onClick={onAccess}>{t('marketing.ctaAccessBtn')}</button>
        </div>
        {error && <p className="cta-error mono">{error}</p>}
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <img className="footer-logo" src="/bvcc_w.png" alt="BVCC Wallet" width={64} height={64} />
            <p className="footer-tag">
              {t('marketing.footerTagline')}
            </p>
          </div>
          <nav className="footer-col">
            <span className="footer-h">{t('marketing.footerProduct')}</span>
            <button className="footer-link" onClick={onCreate}>{t('marketing.footerCreateWallet')}</button>
            <button className="footer-link" onClick={onAccess}>{t('marketing.footerAccess')}</button>
            <button className="footer-link" onClick={onRecover}>{t('marketing.footerRecover')}</button>
          </nav>
          <nav className="footer-col">
            <span className="footer-h">{t('marketing.footerBvcc')}</span>
            <a className="footer-link" href="https://blockventurechaincapital.com" target="_blank" rel="noreferrer">{t('marketing.footerMainSite')}</a>
            <a className="footer-link" href="https://analytics.blockventurechaincapital.com" target="_blank" rel="noreferrer">{t('marketing.footerAnalytics')}</a>
            <a className="footer-link" href="https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent" target="_blank" rel="noreferrer">GitHub ↗</a>
          </nav>
          <nav className="footer-col">
            <span className="footer-h">{t('marketing.footerStandards')}</span>
            <span className="footer-static mono">ERC-4337</span>
            <span className="footer-static mono">ERC-7821</span>
            <span className="footer-static mono">WebAuthn P256</span>
          </nav>
        </div>
        <div className="footer-legal">
          <span className="footer-legal-h">{t('legal.footerHeading')}</span>
          <Link className="footer-link" href="/legal/terms">{t('legal.nav.terms')}</Link>
          <Link className="footer-link" href="/legal/risk-disclosure">{t('legal.nav.risk')}</Link>
          <Link className="footer-link" href="/legal/non-custodial">{t('legal.nav.nonCustodial')}</Link>
          <Link className="footer-link" href="/legal/agent-wallet">{t('legal.nav.agent')}</Link>
          <Link className="footer-link" href="/legal/swap-fast">{t('legal.nav.swap')}</Link>
          <Link className="footer-link" href="/legal/fees">{t('legal.nav.fees')}</Link>
          <Link className="footer-link" href="/legal/privacy">{t('legal.nav.privacy')}</Link>
        </div>
        <div className="footer-base">
          <span className="mono">© {new Date().getFullYear()} BlockVenture Chain Capital</span>
          <span className="mono">{t('marketing.footerEthereum')}</span>
        </div>
      </footer>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Styles — brand: deep black + antique gold
   ──────────────────────────────────────────────────────────────────────────── */
const styles = `
.bvcc-mk {
  --bg:#06080f; --surface:#0d1117; --surface-2:#0b0e16;
  --line:rgba(255,255,255,.07); --line-hi:rgba(212,175,55,.22);
  --text:#f0f4f8; --dim:#8892a4; --muted:#4a5568;
  --gold:#d4af37; --gold-hi:#ecc84a; --gold-soft:#f5d76e;
  --gold-dim:rgba(212,175,55,.12); --gold-glow:rgba(212,175,55,.28);
  --green:#22c55e;
  --maxw:1200px; --ease:cubic-bezier(.22,1,.36,1);
  --grad-gold:linear-gradient(115deg,#f5d76e,#d4af37 55%,#ecc84a);
  background:var(--bg); color:var(--text);
  font-family:var(--font-inter), system-ui, -apple-system, sans-serif;
  min-height:100vh; width:100%; -webkit-font-smoothing:antialiased;
  letter-spacing:-0.011em; overflow-x:hidden;
  zoom:1.1;
}
.bvcc-mk *, .bvcc-mk *::before, .bvcc-mk *::after { box-sizing:border-box; }
.bvcc-mk button { font-family:inherit; cursor:pointer; }
.bvcc-mk img { display:block; }
.bvcc-mk .mono { font-family:var(--font-plex-mono),monospace; }
.bvcc-mk .gold-text {
  background:var(--grad-gold); -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent;
}

/* ── motion ── */
@keyframes mkRise { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:none;} }
.bvcc-mk .load { opacity:0; animation:mkRise .9s var(--ease) forwards; }
.bvcc-mk [data-reveal]{ opacity:0; transform:translateY(24px); transition:opacity .8s var(--ease), transform .8s var(--ease); }
.bvcc-mk [data-reveal].is-in{ opacity:1; transform:none; }
@media (prefers-reduced-motion:reduce){
  .bvcc-mk .load,.bvcc-mk [data-reveal]{ animation:none!important; opacity:1!important; transform:none!important; transition:none!important; }
  .bvcc-mk .ticker-track{ animation:none!important; }
}

/* ── buttons ── */
.bvcc-mk .btn-gold {
  background:var(--grad-gold); color:#1a1505; border:none;
  padding:11px 20px; border-radius:10px; font-size:14px; font-weight:700;
  display:inline-flex; align-items:center; gap:9px; letter-spacing:-0.01em;
  box-shadow:0 6px 22px -8px var(--gold-glow); position:relative;
  transition:transform .3s var(--ease), box-shadow .3s var(--ease), filter .3s;
}
.bvcc-mk .btn-gold:hover { transform:translateY(-2px); box-shadow:0 12px 34px -8px var(--gold-glow); filter:brightness(1.06); }
.bvcc-mk .btn-gold:disabled { opacity:.6; cursor:wait; transform:none; box-shadow:none; }
.bvcc-mk .btn-quiet {
  background:rgba(255,255,255,.02); color:var(--text); border:1px solid var(--line);
  padding:11px 20px; border-radius:10px; font-size:14px; font-weight:500;
  transition:border-color .3s, background .3s, color .3s;
}
.bvcc-mk .btn-quiet:hover { border-color:var(--line-hi); color:#fff; background:rgba(212,175,55,.05); }
.bvcc-mk .lg { padding:14px 26px; font-size:15px; }
.bvcc-mk .btn-arrow { transition:transform .3s var(--ease); }
.bvcc-mk .btn-gold:hover .btn-arrow { transform:translateX(4px); }
.bvcc-mk .link-btn { background:none; border:none; color:var(--dim); font-size:14px; font-weight:500; padding:6px 4px; transition:color .2s; }
.bvcc-mk .link-btn:hover { color:var(--text); }
.bvcc-mk .underline-btn { background:none; border:none; color:var(--gold); font:inherit; padding:0; text-decoration:underline; text-underline-offset:3px; }
.bvcc-mk .underline-btn:hover { color:var(--gold-hi); }

/* ── brand mark ── */
.bvcc-mk .brand { display:flex; align-items:center; text-decoration:none; }
.bvcc-mk .nav-logo { height:120px; width:auto; object-fit:contain; display:block; margin:-22px 0; }
.bvcc-mk .footer-logo { height:120px; width:auto; object-fit:contain; display:block; margin-bottom:14px; }

/* ── nav ── */
.bvcc-mk .nav { position:sticky; top:0; z-index:50; background:rgba(6,8,15,.72); backdrop-filter:saturate(150%) blur(16px); border-bottom:1px solid var(--line); }
.bvcc-mk .nav-inner { max-width:var(--maxw); margin:0 auto; padding:4px 40px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
.bvcc-mk .nav-links { display:flex; gap:30px; }
.bvcc-mk .nav-links a { color:var(--dim); text-decoration:none; font-size:14px; font-weight:500; position:relative; transition:color .2s; }
.bvcc-mk .nav-links a::after { content:''; position:absolute; left:0; bottom:-6px; width:0; height:1px; background:var(--gold); transition:width .3s var(--ease); }
.bvcc-mk .nav-links a:hover { color:var(--text); }
.bvcc-mk .nav-links a:hover::after { width:100%; }
.bvcc-mk .nav-cta { display:flex; align-items:center; gap:14px; }
.bvcc-mk .nav-lang { margin-right:2px; }

/* ── hero ── */
.bvcc-mk .hero { position:relative; max-width:var(--maxw); margin:0 auto; padding:88px 40px 64px; }
.bvcc-mk .hero-glow { position:absolute; inset:-120px 0 auto 0; height:560px; pointer-events:none;
  background:radial-gradient(ellipse 120% 60% at 50% 0%, rgba(212,175,55,.16), rgba(212,175,55,.04) 38%, transparent 66%); }
.bvcc-mk .hero-grid-tex { position:absolute; inset:0; opacity:.04; pointer-events:none;
  background-image:linear-gradient(rgba(212,175,55,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,.7) 1px,transparent 1px);
  background-size:46px 46px; mask-image:radial-gradient(ellipse 80% 70% at 30% 30%, #000, transparent 75%); }
.bvcc-mk .hero-grid { position:relative; display:grid; grid-template-columns:1.18fr .82fr; gap:56px; align-items:center; }
.bvcc-mk .eyebrow { display:inline-flex; align-items:center; gap:10px; font-family:var(--font-plex-mono),monospace; font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 26px; }
.bvcc-mk .eyebrow-dot { width:7px; height:7px; border-radius:50%; background:var(--gold); box-shadow:0 0 0 4px rgba(212,175,55,.14),0 0 14px var(--gold-glow); }
.bvcc-mk .display { font-size:clamp(40px,6.2vw,82px); font-weight:800; line-height:1.02; letter-spacing:-0.035em; margin:0 0 26px; }
.bvcc-mk .display span { display:block; }
.bvcc-mk .display .gold-text { display:inline; }
.bvcc-mk .lede { font-size:clamp(15.5px,1.4vw,18px); line-height:1.62; color:var(--dim); max-width:38ch; margin:0 0 34px; }
.bvcc-mk .hero-actions { display:flex; flex-wrap:wrap; gap:14px; margin-bottom:20px; }
.bvcc-mk .recover-line { font-size:13.5px; color:var(--muted); margin:0; }

/* ── account card ── */
.bvcc-mk .hero-aside { position:relative; display:flex; justify-content:center; }
.bvcc-mk .card-glow { position:absolute; inset:-10%; background:radial-gradient(circle at 50% 40%, var(--gold-glow), transparent 62%); filter:blur(40px); opacity:.5; pointer-events:none; }
.bvcc-mk .acct {
  position:relative; width:100%; max-width:380px;
  background:linear-gradient(165deg,#11151f,#0a0d15); border:1px solid var(--line-hi);
  border-radius:20px; padding:26px 26px 22px;
  box-shadow:0 40px 80px -40px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.05);
  transition:transform .6s var(--ease);
}
.bvcc-mk .acct:hover { transform:translateY(-5px); }
.bvcc-mk .acct-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.bvcc-mk .acct-logo { width:120px; height:120px; border-radius:13px; border:1px solid var(--line-hi); background:#000; object-fit:cover; }
.bvcc-mk .acct-chip { font-family:var(--font-plex-mono),monospace; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--gold); padding:6px 11px; border:1px solid var(--line-hi); border-radius:999px; background:var(--gold-dim); }
.bvcc-mk .acct-kicker { font-family:var(--font-plex-mono),monospace; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; }
.bvcc-mk .acct-addr { font-size:21px; font-weight:500; color:var(--text); margin:0 0 18px; letter-spacing:0.02em; }
.bvcc-mk .acct-rule { height:1px; background:linear-gradient(90deg,var(--line-hi),transparent); margin-bottom:16px; }
.bvcc-mk .acct-rows { margin:0 0 20px; display:flex; flex-direction:column; gap:11px; }
.bvcc-mk .acct-rows div { display:flex; justify-content:space-between; align-items:baseline; gap:14px; }
.bvcc-mk .acct-rows dt { font-size:12.5px; color:var(--dim); }
.bvcc-mk .acct-rows dd { margin:0; font-size:12.5px; color:var(--text); }
.bvcc-mk .acct-seal { display:flex; align-items:center; gap:13px; justify-content:flex-start; padding-top:16px; border-top:1px solid var(--line); }
.bvcc-mk .seal-ring { width:44px; height:44px; border-radius:50%; border:1.5px solid var(--gold); display:grid; place-items:center; color:var(--gold); position:relative; box-shadow:0 0 18px -4px var(--gold-glow); }
.bvcc-mk .seal-ring::after { content:''; position:absolute; inset:4px; border-radius:50%; border:1px dashed var(--line-hi); }
.bvcc-mk .seal-glyph { font-size:19px; }
.bvcc-mk .seal-text { font-family:var(--font-plex-mono),monospace; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); line-height:1.4; }
.bvcc-mk .perm-budget { margin-bottom:18px; }
.bvcc-mk .perm-budget-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px; }
.bvcc-mk .perm-budget-head span:first-child { font-size:12.5px; color:var(--dim); }
.bvcc-mk .perm-budget-head .mono { font-size:12.5px; color:var(--text); }
.bvcc-mk .perm-bar { height:7px; border-radius:99px; background:rgba(255,255,255,.06); overflow:hidden; }
.bvcc-mk .perm-bar span { display:block; height:100%; border-radius:99px; background:var(--grad-gold); box-shadow:0 0 12px -2px var(--gold-glow); }
.bvcc-mk .perm-live { color:var(--green); font-size:12.5px; }

/* ── ticker ── */
.bvcc-mk .ticker { border-top:1px solid var(--line); border-bottom:1px solid var(--line); overflow:hidden; padding:15px 0; background:var(--surface-2); }
.bvcc-mk .ticker-track { display:flex; white-space:nowrap; width:max-content; animation:mkScroll 36s linear infinite; }
.bvcc-mk .ticker-item { font-size:15px; font-weight:600; color:var(--dim); padding:0 24px; display:inline-flex; gap:24px; letter-spacing:.02em; }
.bvcc-mk .ticker-dot { color:var(--gold); font-size:9px; align-self:center; }
@keyframes mkScroll { from{transform:translateX(0);} to{transform:translateX(-33.33%);} }

/* ── section index ── */
.bvcc-mk .section-index { font-family:var(--font-plex-mono),monospace; font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--gold); margin:0 0 22px; }

/* ── h2 ── */
.bvcc-mk .h2 { font-size:clamp(27px,3.4vw,44px); font-weight:800; line-height:1.1; letter-spacing:-0.03em; margin:0; max-width:20ch; }
.bvcc-mk .h2 .gold-text { display:inline; }

/* ── manifesto ── */
.bvcc-mk .manifesto { max-width:1000px; margin:0 auto; padding:118px 40px 108px; text-align:center; }
.bvcc-mk .quote { font-size:clamp(25px,3.7vw,44px); font-weight:700; line-height:1.24; letter-spacing:-0.028em; margin:0 auto 24px; max-width:22ch; color:var(--text); }
.bvcc-mk .quote-by { font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }

/* ── capabilities ── */
.bvcc-mk .caps { max-width:var(--maxw); margin:0 auto; padding:0 40px 110px; }
.bvcc-mk .caps-head { max-width:780px; margin-bottom:56px; }
.bvcc-mk .caps-head .section-index { margin-bottom:18px; }
.bvcc-mk .caps-list { list-style:none; margin:0; padding:0; }
.bvcc-mk .cap { display:grid; grid-template-columns:110px 1fr; gap:30px; padding:38px 0; border-top:1px solid var(--line); transition:border-color .3s; }
.bvcc-mk .cap:last-child { border-bottom:1px solid var(--line); }
.bvcc-mk .cap:hover { border-top-color:var(--line-hi); }
.bvcc-mk .cap-n { font-size:50px; font-weight:800; line-height:.9; letter-spacing:-0.04em;
  background:var(--grad-gold); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.bvcc-mk .cap-body { max-width:64ch; }
.bvcc-mk .cap-title { font-size:23px; font-weight:700; margin:0 0 11px; letter-spacing:-0.02em; color:var(--text); }
.bvcc-mk .cap-text { font-size:15.5px; line-height:1.62; color:var(--dim); margin:0 0 16px; }
.bvcc-mk .cap-tag { font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--gold); padding:5px 12px; border:1px solid var(--line-hi); border-radius:999px; display:inline-block; background:var(--gold-dim); }

/* ── how ── */
.bvcc-mk .how { background:var(--surface-2); border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:90px 40px; }
.bvcc-mk .how-inner { max-width:1160px; margin:0 auto; }
.bvcc-mk .how-inner .section-index { margin-bottom:44px; }
.bvcc-mk .how-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
.bvcc-mk .step { padding:0 28px; border-left:1px solid var(--line); }
.bvcc-mk .step:first-child { padding-left:0; border-left:0; }
.bvcc-mk .step-k { font-size:13px; color:var(--gold); display:block; margin-bottom:16px; letter-spacing:.1em; }
.bvcc-mk .step-t { font-size:18px; font-weight:700; margin:0 0 9px; color:var(--text); letter-spacing:-0.02em; }
.bvcc-mk .step-d { font-size:14px; line-height:1.55; color:var(--muted); margin:0; }

/* ── security ── */
.bvcc-mk .security { position:relative; border-bottom:1px solid var(--line); padding:106px 40px; overflow:hidden; }
.bvcc-mk .sec-glow { position:absolute; inset:auto -10% -40% auto; width:60%; height:120%; background:radial-gradient(ellipse 50% 50% at 80% 100%, rgba(212,175,55,.08), transparent 70%); pointer-events:none; }
.bvcc-mk .sec-inner { position:relative; max-width:1160px; margin:0 auto; display:grid; grid-template-columns:1.05fr .95fr; gap:60px; align-items:start; }
.bvcc-mk .sec-lede { font-size:16px; line-height:1.64; color:var(--dim); margin:24px 0 0; max-width:44ch; }
.bvcc-mk .sec-stats { margin:0; display:grid; grid-template-columns:1fr 1fr; gap:22px; }
.bvcc-mk .sec-stat { display:flex; gap:13px; padding:20px 18px; background:var(--surface); border:1px solid var(--line); border-radius:14px; transition:border-color .3s, transform .3s var(--ease); }
.bvcc-mk .sec-stat:hover { border-color:var(--line-hi); transform:translateY(-3px); }
.bvcc-mk .sec-check { color:var(--green); font-size:14px; font-weight:700; margin-top:1px; }
.bvcc-mk .sec-stat dt { font-size:13.5px; color:var(--gold); margin-bottom:7px; letter-spacing:.02em; }
.bvcc-mk .sec-stat dd { margin:0; font-size:13.5px; line-height:1.5; color:var(--dim); }

/* ── agents ── */
.bvcc-mk .agents { max-width:var(--maxw); margin:0 auto; padding:108px 40px; }
.bvcc-mk .agents-grid { display:grid; grid-template-columns:.92fr 1.08fr; gap:60px; align-items:center; }
.bvcc-mk .agents-lede { font-size:16px; line-height:1.62; color:var(--dim); margin:22px 0 28px; max-width:40ch; }
.bvcc-mk .agents-list { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.bvcc-mk .agents-list li { background:var(--surface); padding:24px 22px; display:flex; gap:13px; transition:background .3s; }
.bvcc-mk .agents-list li:hover { background:#11151f; }
.bvcc-mk .agent-tick { color:var(--gold); font-size:14px; line-height:1.5; }
.bvcc-mk .agents-list h4 { font-size:16px; font-weight:700; margin:0 0 6px; color:var(--text); letter-spacing:-0.01em; }
.bvcc-mk .agents-list p { font-size:13px; line-height:1.5; color:var(--muted); margin:0; }

/* ── open source ── */
.bvcc-mk .oss { max-width:var(--maxw); margin:0 auto; padding:6px 40px 108px; }
.bvcc-mk .oss-grid { display:grid; grid-template-columns:1fr 1.05fr; gap:56px; align-items:center; }
.bvcc-mk .oss-lede { font-size:16px; line-height:1.64; color:var(--dim); margin:22px 0 28px; max-width:46ch; }
.bvcc-mk .oss-term { background:#0a0d15; border:1px solid var(--line-hi); border-radius:16px; overflow:hidden; box-shadow:0 34px 74px -42px rgba(0,0,0,.9); }
.bvcc-mk .term-head { display:flex; align-items:center; gap:7px; padding:13px 16px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.02); }
.bvcc-mk .term-dot { width:11px; height:11px; border-radius:50%; background:rgba(255,255,255,.13); }
.bvcc-mk .term-dot:first-child { background:rgba(212,175,55,.75); }
.bvcc-mk .term-title { margin-left:8px; font-size:11.5px; color:var(--muted); letter-spacing:.03em; }
.bvcc-mk .term-body { padding:20px 18px; font-size:12px; line-height:1.95; overflow:hidden; }
.bvcc-mk .t-line { margin:0; color:var(--dim); white-space:pre-wrap; word-break:break-word; padding-left:16px; text-indent:-16px; }
.bvcc-mk .t-prompt { color:var(--gold); margin-right:7px; }
.bvcc-mk .t-ok { color:var(--green); }

/* ── ledger ── */
.bvcc-mk .ledger { background:var(--surface-2); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.bvcc-mk .ledger-grid { max-width:1160px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; }
.bvcc-mk .fees { padding:88px 56px 88px 0; }
.bvcc-mk .nets { padding:88px 0 88px 56px; border-left:1px solid var(--line); }
.bvcc-mk .fee-row { display:flex; align-items:center; gap:20px; padding:18px 0; border-bottom:1px solid var(--line); }
.bvcc-mk .fee-pct { font-size:48px; font-weight:800; letter-spacing:-0.04em; line-height:1; min-width:140px; }
.bvcc-mk .fee-label { display:flex; flex-direction:column; gap:3px; }
.bvcc-mk .fee-label strong { font-size:15.5px; font-weight:700; color:var(--text); letter-spacing:-0.01em; }
.bvcc-mk .fee-label span { font-size:13px; color:var(--muted); }
.bvcc-mk .fees-note { font-size:14.5px; line-height:1.6; color:var(--dim); margin:24px 0 0; max-width:38ch; }
.bvcc-mk .net-list { list-style:none; margin:0 0 20px; padding:0; }
.bvcc-mk .net-list li { font-size:24px; font-weight:700; padding:13px 0; border-bottom:1px solid var(--line); display:flex; align-items:baseline; gap:18px; color:var(--text); letter-spacing:-0.02em; }
.bvcc-mk .net-n { font-size:12px; font-weight:500; color:var(--gold); }
.bvcc-mk .net-testnet { font-size:12px; letter-spacing:.06em; color:var(--green); }

/* ── cta ── */
.bvcc-mk .cta { position:relative; text-align:center; padding:124px 40px; overflow:hidden; }
.bvcc-mk .cta-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 80% 70% at 50% 100%, rgba(212,175,55,.14), transparent 62%); }
.bvcc-mk .cta-logo { position:relative; width:120px; height:120px; border-radius:17px; border:1px solid var(--line-hi); background:#000; margin:0 auto 30px; object-fit:cover; box-shadow:0 0 40px -8px var(--gold-glow); }
.bvcc-mk .cta-title { position:relative; font-size:clamp(32px,5vw,62px); font-weight:800; line-height:1.06; letter-spacing:-0.035em; margin:0 0 38px; }
.bvcc-mk .cta-title .gold-text { display:inline; }
.bvcc-mk .cta-actions { position:relative; display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.bvcc-mk .cta-error { position:relative; color:#fc8181; font-size:13px; margin:22px 0 0; }

/* ── footer ── */
.bvcc-mk .footer { background:var(--surface-2); padding:66px 40px 34px; border-top:1px solid var(--line); }
.bvcc-mk .footer-grid { max-width:1160px; margin:0 auto; display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:40px; padding-bottom:46px; border-bottom:1px solid var(--line); }
.bvcc-mk .footer-brand .brand { margin-bottom:16px; }
.bvcc-mk .footer-tag { font-size:13.5px; line-height:1.6; color:var(--muted); margin:0; max-width:34ch; }
.bvcc-mk .footer-col { display:flex; flex-direction:column; gap:12px; align-items:flex-start; }
.bvcc-mk .footer-h { font-family:var(--font-plex-mono),monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gold); margin-bottom:4px; }
.bvcc-mk .footer-link { background:none; border:none; color:var(--dim); font-size:14px; text-decoration:none; padding:0; text-align:left; transition:color .2s; }
.bvcc-mk .footer-link:hover { color:var(--text); }
.bvcc-mk .footer-static { font-size:13px; color:var(--muted); }
.bvcc-mk .footer-legal { max-width:1160px; margin:22px auto 0; display:flex; flex-wrap:wrap; align-items:center; gap:10px 20px; }
.bvcc-mk .footer-legal-h { font-family:var(--font-plex-mono),monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gold); margin-right:4px; }
.bvcc-mk .footer-legal .footer-link { font-size:13px; }
.bvcc-mk .footer-base { max-width:1160px; margin:24px auto 0; display:flex; justify-content:space-between; gap:16px; }
.bvcc-mk .footer-base span { font-size:11px; letter-spacing:.04em; color:var(--muted); }

/* ── responsive ── */
@media (max-width:1000px){
  .bvcc-mk .hero-grid{ grid-template-columns:1fr; gap:48px; }
  .bvcc-mk .hero-aside{ justify-content:flex-start; }
  .bvcc-mk .sec-inner,.bvcc-mk .agents-grid,.bvcc-mk .oss-grid{ grid-template-columns:1fr; gap:40px; }
  .bvcc-mk .how-grid{ grid-template-columns:1fr 1fr; gap:36px 0; }
  .bvcc-mk .step{ padding:0 24px; }
  .bvcc-mk .step:nth-child(odd){ padding-left:0; border-left:0; }
}
@media (max-width:720px){
  .bvcc-mk .nav-links{ display:none; }
  .bvcc-mk .nav-cta .gh{ display:none; }
  .bvcc-mk .oss{ padding-left:20px; padding-right:20px; }
  .bvcc-mk .term-body{ font-size:11px; }
  .bvcc-mk .nav-inner{ padding:13px 20px; }
  .bvcc-mk .hero{ padding:56px 20px 48px; }
  .bvcc-mk .manifesto{ padding:78px 20px; }
  .bvcc-mk .caps,.bvcc-mk .agents,.bvcc-mk .how,.bvcc-mk .security,.bvcc-mk .cta{ padding-left:20px; padding-right:20px; }
  .bvcc-mk .cap{ grid-template-columns:1fr; gap:12px; }
  .bvcc-mk .cap-n{ font-size:38px; }
  .bvcc-mk .how-grid{ grid-template-columns:1fr; }
  .bvcc-mk .step{ padding:22px 0 0; border-left:0; border-top:1px solid var(--line); }
  .bvcc-mk .step:first-child{ border-top:0; padding-top:0; }
  .bvcc-mk .sec-stats{ grid-template-columns:1fr; }
  .bvcc-mk .agents-list{ grid-template-columns:1fr; }
  .bvcc-mk .ledger-grid{ grid-template-columns:1fr; }
  .bvcc-mk .fees{ padding:56px 0 36px; }
  .bvcc-mk .nets{ padding:36px 0 56px; border-left:0; border-top:1px solid var(--line); }
  .bvcc-mk .footer-grid{ grid-template-columns:1fr 1fr; gap:30px; }
  .bvcc-mk .footer-base{ flex-direction:column; gap:8px; }
}
`
