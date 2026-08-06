'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/I18nContext'
import { dict } from '@/lib/i18n/translations'
import LanguageSwitcher from '@/components/LanguageSwitcher'

/* ────────────────────────────────────────────────────────────────────────────
   /press — press kit.
   Same brand system as the marketing landing (deep black + antique gold), but
   laid out as a reference document rather than a pitch: a journalist should be
   able to skim it, copy what they need, and leave.
   ──────────────────────────────────────────────────────────────────────────── */

type Stat = { n: string; l: string; s: string }
type Boiler = { label: string; meta: string; text: string }
type Cap = { h: string; b: string; n: string }

interface PressContent {
  whatBody: string[]
  problemBody: string[]
  diffBody: string[]
  caps: Cap[]
  stats: Stat[]
  boilerplates: Boiler[]
  secRows: string[][]
  proofRows: string[][]
  avoidRows: string[][]
  factsRows: string[][]
  links: string[][]
}

/* Brand palette, transcribed from MarketingLanding.tsx (.bvcc-mk scope). */
const PALETTE = [
  { hex: '#06080f', name: 'Ink', use: 'Page background' },
  { hex: '#0d1117', name: 'Surface', use: 'Cards, panels' },
  { hex: '#d4af37', name: 'Gold', use: 'Accent, links' },
  { hex: '#ecc84a', name: 'Gold light', use: 'Gradient end, numbers' },
  { hex: '#f0f4f8', name: 'Text', use: 'Body copy' },
  { hex: '#8892a4', name: 'Dim', use: 'Secondary copy' },
  { hex: '#22c55e', name: 'Green', use: 'Active, success' },
]

/* Screenshots. Files live in public/press/shots/.
   Captions must describe what the image actually shows — a press kit that
   mislabels its own screenshots has no business asking anyone to trust it. */
const SHOTS = [
  { f: 'agents.png', en: 'An authorized agent, with its limits and what it has spent', es: 'Un agente autorizado, con sus límites y lo que lleva gastado' },
  { f: 'authorize-agent.png', en: 'Authorizing an agent — capabilities, not raw addresses', es: 'Autorizar un agente: capacidades, no direcciones sueltas' },
  { f: 'authorize-agent-capabilities.png', en: 'Aave and liquidity capabilities, and the contracts they resolve to', es: 'Capacidades de Aave y liquidez, y los contratos a los que se traducen' },
  { f: 'overview.png', en: 'Wallet overview on Arbitrum', es: 'Resumen de la wallet en Arbitrum' },
  { f: 'positions.png', en: 'Uniswap v3 and v4 liquidity positions', es: 'Posiciones de liquidez en Uniswap v3 y v4' },
  { f: 'approvals.png', en: 'Token approvals, revocable with a passkey', es: 'Aprobaciones de token, revocables con la passkey' },
]

/* Diagrams, also in public/press/diagrams/. */
const DIAGRAMS = [
  {
    f: 'three-approaches',
    en: 'Three ways to let an AI agent spend money',
    es: 'Tres formas de dejar que un agente de IA gaste',
  },
  {
    f: 'permission-flow',
    en: 'What happens when an agent tries to spend',
    es: 'Qué pasa cuando un agente intenta gastar',
  },
]

function CopyBtn({ text, label, done }: { text: string; label: string; done: string }) {
  const [hit, setHit] = useState(false)
  return (
    <button
      className="copy"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setHit(true)
        setTimeout(() => setHit(false), 1600)
      }}
    >
      {hit ? done : label}
    </button>
  )
}

export default function PressPage() {
  const { lang, t } = useI18n()
  const P = (dict[lang] as Record<string, unknown>).press as unknown as PressContent

  const shotLabel = (s: (typeof SHOTS)[number]) => (lang === 'es' ? s.es : s.en)

  return (
    <div className="bvcc-press">
      <style>{styles}</style>

      <div className="wrap">
        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="topbar">
          <Link href="/" className="back">
            {t('press.back')}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* ── Hero ────────────────────────────────────────── */}
        <header className="hero">
          <img src="/bvcc_w.png" alt="BVCC" className="hero-logo" />
          <div className="kicker">{t('press.kicker')}</div>
          <h1>{t('press.title')}</h1>
          <p className="lede">{t('press.lede')}</p>

          <div className="cta-row">
            <a className="btn gold" href="/press/BVCC-Agent-Wallet-Media-Kit.pdf" download>
              {t('press.dlMediaKit')}
            </a>
            <a className="btn" href="/press/BVCC-Agent-Wallet-Media-Kit-ES.pdf" download>
              {t('press.dlMediaKitEs')}
            </a>
            <a className="btn" href="/press/bvcc-press-kit.zip" download>
              {t('press.dlAssets')}
            </a>
            <a
              className="btn"
              href="https://www.youtube.com/watch?v=dWUTaWBk68A"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('press.watchDemo')}
            </a>
          </div>
          <div className="updated">{t('press.updated')}</div>
        </header>

        {/* ── Numbers ─────────────────────────────────────── */}
        <section>
          <h2>{t('press.statsHeading')}</h2>
          <div className="stats">
            {P.stats.map(s => (
              <div className="stat" key={s.n + s.l}>
                <div className="stat-n">{s.n}</div>
                <div className="stat-l">{s.l}</div>
                <div className="stat-s">{s.s}</div>
              </div>
            ))}
          </div>
          <p className="note">{t('press.statsNote')}</p>
        </section>

        {/* ── The story ───────────────────────────────────── */}
        <section>
          <h2>{t('press.whatHeading')}</h2>
          {P.whatBody.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2>{t('press.problemHeading')}</h2>
          {P.problemBody.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section>
          <h2>{t('press.diffHeading')}</h2>
          {P.diffBody.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {/* ── What an agent can do ────────────────────────── */}
        <section>
          <h2>{t('press.capsHeading')}</h2>
          <p>{t('press.capsNote')}</p>
          <div className="caps">
            {P.caps.map(c => (
              <div className="cap" key={c.h}>
                <div className="cap-head">
                  <span className="cap-h">{c.h}</span>
                  <span className="cap-n">{c.n}</span>
                </div>
                <p className="cap-b">{c.b}</p>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 16 }}>{t('press.capsProof')}</p>
        </section>

        {/* ── Try it ──────────────────────────────────────── */}
        <section>
          <h2>{t('press.tryHeading')}</h2>
          <p>{t('press.tryNote')}</p>
          <div className="term">
            <div className="term-head">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <CopyBtn text={t('press.tryCmd')} label={t('press.copy')} done={t('press.copied')} />
            </div>
            <div className="term-body">
              <div>
                <span className="prompt">$ </span>
                <span className="cmd">{t('press.tryCmd')}</span>
              </div>
              <div className="out">
                ▸ <span className="ok">{t('press.tryOut1')}</span>
              </div>
              <div className="out">▸ {t('press.tryOut2')}</div>
            </div>
          </div>
          <p>{t('press.tryAfter')}</p>
        </section>

        {/* ── Boilerplate ─────────────────────────────────── */}
        <section>
          <h2>{t('press.boilerHeading')}</h2>
          <p>{t('press.boilerNote')}</p>
          <div className="boilers">
            {P.boilerplates.map(b => (
              <div className="boiler" key={b.label}>
                <div className="boiler-head">
                  <span className="boiler-label">{b.label}</span>
                  {b.meta && <span className="boiler-meta">{b.meta}</span>}
                  <CopyBtn text={b.text} label={t('press.copy')} done={t('press.copied')} />
                </div>
                <p className="boiler-text">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quote ───────────────────────────────────────── */}
        <section>
          <h2>{t('press.quoteHeading')}</h2>
          <blockquote>
            <p>{t('press.quote')}</p>
            <cite>{t('press.quoteAttr')}</cite>
            <CopyBtn text={t('press.quote')} label={t('press.copy')} done={t('press.copied')} />
          </blockquote>
        </section>

        {/* ── Screenshots ─────────────────────────────────── */}
        <section>
          <h2>{lang === 'es' ? 'Capturas' : 'Screenshots'}</h2>
          <div className="shots">
            {SHOTS.map(s => (
              <a className="shot" key={s.f} href={`/press/shots/${s.f}`} download>
                <img src={`/press/shots/${s.f}`} alt={shotLabel(s)} loading="lazy" />
                <span className="shot-cap">
                  {shotLabel(s)} <em>{t('press.download')}</em>
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* ── Diagrams ────────────────────────────────────── */}
        <section>
          <h2>{lang === 'es' ? 'Diagramas' : 'Diagrams'}</h2>
          <p>
            {lang === 'es'
              ? 'Libres de usar en artículos y vídeos, con atribución. SVG y PNG a 2x en el kit descargable.'
              : 'Free to use in articles and videos with attribution. SVG and 2x PNG are both in the downloadable kit.'}
          </p>
          <div className="diagrams">
            {DIAGRAMS.map(d => (
              <figure className="diagram" key={d.f}>
                <img src={`/press/diagrams/${d.f}.png`} alt={lang === 'es' ? d.es : d.en} loading="lazy" />
                <figcaption>
                  <span>{lang === 'es' ? d.es : d.en}</span>
                  <span className="dl-pair">
                    <a href={`/press/diagrams/${d.f}.svg`} download>
                      SVG
                    </a>
                    <a href={`/press/diagrams/${d.f}.png`} download>
                      PNG
                    </a>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Security ────────────────────────────────────── */}
        <section>
          <h2>{t('press.secHeading')}</h2>
          <p>{t('press.secIntro')}</p>
          <div className="sec">
            <table>
              <tbody>
                {P.secRows.map(r => (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td className="num">{r[1]}</td>
                    <td className={r[2].includes('open') || r[2].includes('abierto') ? 'open' : 'dim'}>
                      {r[2]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="callout">
            <div className="callout-h">{t('press.secOpenHeading')}</div>
            <p>{t('press.secOpenBody')}</p>
            <p>{t('press.secUpgradeBody')}</p>
          </div>
          <div className="inline-links">
            <a href="/audits/BVCC-Agent-Wallet-Security-Report.pdf" target="_blank" rel="noopener noreferrer">
              {t('press.secLinkEn')} ↗
            </a>
            <a href="/audits/BVCC-Agent-Wallet-Informe-Seguridad.pdf" target="_blank" rel="noopener noreferrer">
              {t('press.secLinkEs')} ↗
            </a>
          </div>
        </section>

        {/* ── Proof ───────────────────────────────────────── */}
        <section>
          <h2>{t('press.proofHeading')}</h2>
          <p>{t('press.proofNote')}</p>
          <div className="rows">
            {P.proofRows.map(r => (
              <div className="row" key={r[0]}>
                <span className="row-k">{r[0]}</span>
                <span className="row-v">{r[1]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Brand ───────────────────────────────────────── */}
        <section>
          <h2>{t('press.brandHeading')}</h2>

          <h3>{t('press.brandLogoHeading')}</h3>
          <div className="logos">
            <div className="logo-card">
              <img src="/bvcc_w.png" alt="BVCC mark" />
              <div className="logo-meta">
                <span>bvcc_w.png · 1254×1254</span>
                <a href="/bvcc_w.png" download>
                  {t('press.download')}
                </a>
              </div>
            </div>
            <div className="logo-card">
              <img src="/bvcc_wallet.png" alt="BVCC wallet mark" />
              <div className="logo-meta">
                <span>bvcc_wallet.png · 1254×1254</span>
                <a href="/bvcc_wallet.png" download>
                  {t('press.download')}
                </a>
              </div>
            </div>
          </div>
          <p className="note">{t('press.brandLogoNote')}</p>

          <h3>{t('press.brandColorHeading')}</h3>
          <div className="swatches">
            {PALETTE.map(c => (
              <div className="swatch" key={c.hex}>
                <div className="chip" style={{ background: c.hex }} />
                <div className="swatch-name">{c.name}</div>
                <code>{c.hex}</code>
                <div className="swatch-use">{c.use}</div>
              </div>
            ))}
          </div>

          <h3>{t('press.brandTypeHeading')}</h3>
          <div className="type-demo">
            <div className="type-a">Inter</div>
            <div className="type-b">IBM Plex Mono</div>
          </div>
          <p>{t('press.brandTypeBody')}</p>

          <h3>{t('press.brandNameHeading')}</h3>
          <p>{t('press.brandNameBody')}</p>
        </section>

        {/* ── Words to avoid ──────────────────────────────── */}
        <section>
          <h2>{t('press.avoidHeading')}</h2>
          <p>{t('press.avoidNote')}</p>
          <div className="rows">
            {P.avoidRows.map(r => (
              <div className="row" key={r[0]}>
                <span className="row-k strike">{r[0]}</span>
                <span className="row-v">{r[1]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Fact sheet ──────────────────────────────────── */}
        <section>
          <h2>{t('press.factsHeading')}</h2>
          <div className="rows">
            {P.factsRows.map(r => (
              <div className="row" key={r[0]}>
                <span className="row-k">{r[0]}</span>
                <span className={r[1].startsWith('0x') ? 'row-v mono' : 'row-v'}>{r[1]}</span>
              </div>
            ))}
          </div>
          <p className="note">{t('press.factsAddrNote')}</p>
        </section>

        {/* ── Links ───────────────────────────────────────── */}
        <section>
          <h2>{t('press.linksHeading')}</h2>
          <div className="rows">
            {P.links.map(l => (
              <div className="row" key={l[1]}>
                <span className="row-k">{l[0]}</span>
                <a className="row-v link" href={l[1]} target="_blank" rel="noopener noreferrer">
                  {l[1].replace(/^https?:\/\//, '')}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────── */}
        <section className="contact">
          <h2>{t('press.contactHeading')}</h2>
          <p>{t('press.contactBody')}</p>
          <a className="btn gold" href={`mailto:${t('press.contactEmail')}`}>
            {t('press.contactEmail')}
          </a>
          <div className="inline-links">
            <a
              href="https://www.linkedin.com/company/blockventure-chain-capital/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('press.contactLinkedIn')} ↗
            </a>
            <a
              href="https://github.com/blockventurechaincapital-crypto"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('press.contactGitHub')} ↗
            </a>
          </div>
        </section>

        <footer className="foot">
          BlockVenture Chain Capital is a Web3 brand and project. Not an incorporated company, bank,
          broker, exchange, custodian, or regulated financial institution. BVCC Agent Wallet is
          experimental public beta software and has not been externally audited.
        </footer>
      </div>
    </div>
  )
}

const styles = `
.bvcc-press{
  --bg:#06080f; --surface:#0d1117; --surface-2:#0b0e16;
  --line:rgba(255,255,255,.07); --line-hi:rgba(212,175,55,.22);
  --text:#f0f4f8; --dim:#8892a4; --muted:#4a5568;
  --gold:#d4af37; --gold-hi:#ecc84a; --gold-soft:#f5d76e;
  --green:#22c55e; --red:#fc8181;
  --grad-gold:linear-gradient(115deg,#f5d76e,#d4af37 55%,#ecc84a);
  background:
    radial-gradient(ellipse 90% 46% at 50% -6%, rgba(212,175,55,.13), transparent 62%),
    var(--bg);
  color:var(--text); min-height:100vh;
  font-family:var(--font-inter),system-ui,sans-serif;
  letter-spacing:-.011em;
}
.bvcc-press .wrap{ max-width:860px; margin:0 auto; padding:28px 22px 90px; }
.bvcc-press .mono, .bvcc-press code{ font-family:var(--font-plex-mono),monospace; }

.bvcc-press .topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:40px; }
.bvcc-press .back{ color:var(--dim); font-size:13px; text-decoration:none; font-weight:500; }
.bvcc-press .back:hover{ color:var(--gold); }

/* Hero */
.bvcc-press .hero{ padding-bottom:44px; border-bottom:1px solid var(--line-hi); margin-bottom:44px; }
.bvcc-press .hero-logo{ height:132px; width:auto; object-fit:contain; display:block; margin-bottom:20px; }
.bvcc-press .kicker{
  font-family:var(--font-plex-mono),monospace; font-size:11px; letter-spacing:.15em;
  text-transform:uppercase; color:var(--gold); margin-bottom:14px;
}
.bvcc-press h1{ font-size:clamp(30px,5vw,44px); font-weight:800; letter-spacing:-.032em; line-height:1.06; margin:0 0 18px; }
.bvcc-press .lede{ font-size:17px; line-height:1.6; color:#c9d2e0; max-width:62ch; margin:0 0 26px; }
.bvcc-press .updated{ font-family:var(--font-plex-mono),monospace; font-size:11.5px; color:var(--muted); margin-top:18px; }

.bvcc-press .cta-row{ display:flex; flex-wrap:wrap; gap:10px; }
.bvcc-press .btn{
  display:inline-block; padding:11px 18px; border-radius:10px; font-size:13.5px; font-weight:600;
  text-decoration:none; border:1px solid var(--line-hi); color:var(--text); background:var(--surface);
  transition:border-color .18s, transform .18s;
}
.bvcc-press .btn:hover{ border-color:var(--gold); transform:translateY(-1px); }
.bvcc-press .btn.gold{
  background:var(--grad-gold); color:#1a1505; border-color:transparent;
  box-shadow:0 6px 22px -8px rgba(212,175,55,.4);
}

/* Sections */
.bvcc-press section{ margin-bottom:52px; }
.bvcc-press h2{
  font-family:var(--font-plex-mono),monospace; font-size:11px; letter-spacing:.16em;
  text-transform:uppercase; color:var(--gold); font-weight:500; margin:0 0 18px;
}
.bvcc-press h3{ font-size:15px; font-weight:700; margin:30px 0 14px; letter-spacing:-.015em; }
.bvcc-press p{ font-size:15px; line-height:1.68; color:#c9d2e0; margin:0 0 14px; max-width:68ch; }
.bvcc-press p:last-child{ margin-bottom:0; }
.bvcc-press .note{ font-size:13px; color:var(--muted); line-height:1.6; }

/* Stats */
.bvcc-press .stats{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(178px,1fr));
  gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden;
  margin-bottom:16px;
}
.bvcc-press .stat{ background:var(--surface); padding:18px 16px; }
.bvcc-press .stat-n{
  font-size:30px; font-weight:800; letter-spacing:-.04em; line-height:1;
  background:var(--grad-gold); -webkit-background-clip:text; background-clip:text; color:transparent;
}
.bvcc-press .stat-l{ font-size:13px; color:var(--text); margin-top:9px; line-height:1.35; }
.bvcc-press .stat-s{ font-size:11.5px; color:var(--muted); margin-top:4px; line-height:1.35; }

/* Capabilities */
.bvcc-press .caps{ display:grid; grid-template-columns:repeat(auto-fit,minmax(268px,1fr)); gap:12px; margin-top:18px; }
.bvcc-press .cap{ border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:16px 18px; }
.bvcc-press .cap-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:9px; }
.bvcc-press .cap-h{ font-size:14.5px; font-weight:700; color:var(--gold-soft); }
.bvcc-press .cap-n{ font-family:var(--font-plex-mono),monospace; font-size:10.5px; letter-spacing:.06em; color:var(--muted); white-space:nowrap; }
.bvcc-press .cap-b{ font-size:13.5px; line-height:1.6; color:var(--dim); margin:0; max-width:none; }

/* Terminal */
.bvcc-press .term{
  border:1px solid var(--line-hi); border-radius:12px; overflow:hidden;
  background:#080b12; margin:18px 0;
}
.bvcc-press .term-head{
  display:flex; align-items:center; gap:6px; padding:10px 14px;
  border-bottom:1px solid var(--line); background:var(--surface-2);
}
.bvcc-press .dot{ width:9px; height:9px; border-radius:50%; background:var(--muted); opacity:.5; }
.bvcc-press .term-head .copy{ margin-left:auto; }
.bvcc-press .term-body{
  padding:16px 18px; font-family:var(--font-plex-mono),monospace;
  font-size:13px; line-height:1.85; overflow-x:auto;
}
.bvcc-press .prompt{ color:var(--muted); }
.bvcc-press .cmd{ color:var(--gold-soft); }
.bvcc-press .out{ color:var(--dim); }
.bvcc-press .ok{ color:var(--green); }

/* Copy button */
.bvcc-press .copy{
  font-family:var(--font-plex-mono),monospace; font-size:10.5px; letter-spacing:.08em;
  text-transform:uppercase; padding:5px 11px; border-radius:6px; cursor:pointer;
  background:transparent; border:1px solid var(--line-hi); color:var(--gold);
  transition:background .18s;
}
.bvcc-press .copy:hover{ background:rgba(212,175,55,.1); }

/* Boilerplate */
.bvcc-press .boilers{ display:flex; flex-direction:column; gap:12px; margin-top:18px; }
.bvcc-press .boiler{ border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:16px 18px; }
.bvcc-press .boiler-head{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.bvcc-press .boiler-label{ font-size:13px; font-weight:700; color:var(--text); }
.bvcc-press .boiler-meta{ font-family:var(--font-plex-mono),monospace; font-size:11px; color:var(--muted); }
.bvcc-press .boiler-head .copy{ margin-left:auto; }
.bvcc-press .boiler-text{ font-size:14px; line-height:1.65; color:#c9d2e0; margin:0; max-width:none; }

/* Quote */
.bvcc-press blockquote{
  margin:0; padding:22px 24px; border-left:2px solid var(--gold);
  background:var(--surface); border-radius:0 12px 12px 0;
}
.bvcc-press blockquote p{ font-size:16px; line-height:1.65; color:var(--text); font-style:italic; margin:0 0 14px; }
.bvcc-press cite{ font-style:normal; font-size:12.5px; color:var(--dim); display:block; margin-bottom:14px; }

/* Screenshots */
.bvcc-press .shots{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:14px; }
.bvcc-press .shot{ text-decoration:none; display:block; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:var(--surface); transition:border-color .18s; }
.bvcc-press .shot:hover{ border-color:var(--gold); }
.bvcc-press .shot img{ width:100%; height:auto; display:block; }
.bvcc-press .shot-cap{ display:flex; justify-content:space-between; align-items:center; gap:8px; padding:11px 14px; font-size:12.5px; color:var(--text); border-top:1px solid var(--line); }
.bvcc-press .shot-cap em{ font-style:normal; font-family:var(--font-plex-mono),monospace; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--gold); }

/* Diagrams */
.bvcc-press .diagrams{ display:flex; flex-direction:column; gap:16px; margin-top:18px; }
.bvcc-press .diagram{ margin:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:var(--surface); }
.bvcc-press .diagram img{ width:100%; height:auto; display:block; }
.bvcc-press .diagram figcaption{ display:flex; justify-content:space-between; align-items:center; gap:10px; padding:11px 16px; border-top:1px solid var(--line); font-size:13px; color:var(--text); }
.bvcc-press .dl-pair{ display:flex; gap:12px; }
.bvcc-press .dl-pair a{ font-family:var(--font-plex-mono),monospace; font-size:10.5px; letter-spacing:.08em; color:var(--gold); text-decoration:none; }
.bvcc-press .dl-pair a:hover{ text-decoration:underline; }

/* Security table */
.bvcc-press .sec{ border:1px solid var(--line); border-radius:12px; background:var(--surface-2); padding:6px 18px; margin:18px 0; }
.bvcc-press .sec table{ width:100%; border-collapse:collapse; font-size:14px; }
.bvcc-press .sec tr{ border-bottom:1px solid var(--line); }
.bvcc-press .sec tr:last-child{ border-bottom:0; }
.bvcc-press .sec td{ padding:11px 0; color:var(--text); }
.bvcc-press .sec td.num{ font-family:var(--font-plex-mono),monospace; text-align:right; width:50px; color:var(--gold); }
.bvcc-press .sec td.dim{ color:var(--dim); text-align:right; font-size:13px; }
.bvcc-press .sec td.open{ color:var(--red); text-align:right; font-size:13px; }

.bvcc-press .callout{ border:1px solid rgba(252,129,129,.28); border-radius:12px; background:rgba(252,129,129,.045); padding:18px 20px; margin:18px 0; }
.bvcc-press .callout-h{ font-family:var(--font-plex-mono),monospace; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--red); margin-bottom:11px; }
.bvcc-press .callout p{ font-size:14px; }

.bvcc-press .inline-links{ display:flex; flex-wrap:wrap; gap:10px 22px; margin-top:16px; }
.bvcc-press .inline-links a{ color:var(--gold); font-size:13.5px; text-decoration:none; font-weight:500; }
.bvcc-press .inline-links a:hover{ text-decoration:underline; }

/* Key/value rows */
.bvcc-press .rows{ border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-top:16px; }
.bvcc-press .row{ display:flex; gap:18px; padding:12px 18px; border-bottom:1px solid var(--line); background:var(--surface); font-size:14px; }
.bvcc-press .row:last-child{ border-bottom:0; }
.bvcc-press .row-k{ width:150px; flex-shrink:0; color:var(--dim); }
.bvcc-press .row-k.strike{ color:var(--red); }
.bvcc-press .row-v{ color:#c9d2e0; line-height:1.55; word-break:break-word; min-width:0; }
.bvcc-press .row-v.mono{ font-family:var(--font-plex-mono),monospace; font-size:12.5px; color:var(--gold-soft); }
.bvcc-press .row-v.link{ color:var(--gold); text-decoration:none; }
.bvcc-press .row-v.link:hover{ text-decoration:underline; }

/* Brand */
.bvcc-press .logos{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; }
.bvcc-press .logo-card{ border:1px solid var(--line); border-radius:12px; background:var(--surface); overflow:hidden; }
.bvcc-press .logo-card img{ display:block; width:100%; max-width:150px; height:auto; margin:26px auto; }
.bvcc-press .logo-meta{ display:flex; justify-content:space-between; align-items:center; gap:8px; padding:11px 14px; border-top:1px solid var(--line); font-family:var(--font-plex-mono),monospace; font-size:11px; color:var(--muted); }
.bvcc-press .logo-meta a{ color:var(--gold); text-decoration:none; text-transform:uppercase; letter-spacing:.08em; }

.bvcc-press .swatches{ display:grid; grid-template-columns:repeat(auto-fit,minmax(124px,1fr)); gap:12px; }
.bvcc-press .swatch{ }
.bvcc-press .chip{ height:56px; border-radius:9px; border:1px solid var(--line); margin-bottom:9px; }
.bvcc-press .swatch-name{ font-size:12.5px; font-weight:600; color:var(--text); }
.bvcc-press .swatch code{ font-size:11.5px; color:var(--gold); display:block; margin:2px 0 3px; }
.bvcc-press .swatch-use{ font-size:11px; color:var(--muted); line-height:1.35; }

.bvcc-press .type-demo{ display:flex; flex-wrap:wrap; gap:14px; margin-bottom:16px; }
.bvcc-press .type-a, .bvcc-press .type-b{ flex:1; min-width:180px; border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:22px; font-size:26px; font-weight:700; letter-spacing:-.02em; }
.bvcc-press .type-b{ font-family:var(--font-plex-mono),monospace; font-weight:500; font-size:22px; color:var(--gold-soft); }

/* Contact */
.bvcc-press .contact .btn{ margin-top:6px; }
.bvcc-press .foot{ margin-top:60px; padding-top:26px; border-top:1px solid var(--line); font-size:12px; line-height:1.6; color:var(--muted); }

@media (max-width:620px){
  .bvcc-press .row{ flex-direction:column; gap:4px; }
  .bvcc-press .row-k{ width:auto; font-size:12px; }
}
`
