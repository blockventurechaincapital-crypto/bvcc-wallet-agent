// Developer docs article renderer — sits inside app/docs/layout.tsx (sidebar shell).
// Canonical content lives in the monorepo's docs/*.md — keep lib/docs/* in sync.
import Link from 'next/link'
import DocsToc from '@/components/DocsToc'
import { DOC_FLAT, slugifyHeading, type DocSlug } from '@/lib/docs/nav'

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'warn' | 'info'; text: string }

export interface DocContent {
  title: string
  intro: string
  blocks: DocBlock[]
}

const C = {
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  gold: '#d4af37',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  dim: '#8892a4',
}

const MONO = 'var(--font-plex-mono), monospace'

// Render `inline code` spans inside plain text. nowrapCode keeps chips on one
// line (used in table cells, where the wrapper scrolls horizontally instead).
function Inline({ text, nowrapCode }: { text: string; nowrapCode?: boolean }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: '0.92em',
              color: C.gold,
              background: 'rgba(212,175,55,0.08)',
              border: `1px solid rgba(212,175,55,0.15)`,
              borderRadius: 4,
              padding: '1px 5px',
              ...(nowrapCode ? { whiteSpace: 'nowrap' as const } : { wordBreak: 'break-word' as const }),
            }}
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          id={slugifyHeading(block.text)}
          style={{
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: '38px 0 4px',
            paddingTop: 18,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <Inline text={block.text} />
        </h2>
      )
    case 'h3':
      return (
        <h3 style={{ fontSize: 16.5, fontWeight: 650, margin: '24px 0 2px' }}>
          <Inline text={block.text} />
        </h3>
      )
    case 'p':
      return (
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.text, margin: '12px 0' }}>
          <Inline text={block.text} />
        </p>
      )
    case 'list':
      return (
        <ul style={{ listStyle: 'none', margin: '12px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: C.gold, flexShrink: 0, marginTop: 2, fontSize: 12 }}>●</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.65, color: C.text }}>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      )
    case 'code':
      return (
        <div
          style={{
            margin: '16px 0',
            background: C.card,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '7px 14px',
              borderBottom: `1px solid ${C.border}`,
              fontFamily: MONO,
              fontSize: 10.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.gold,
            }}
          >
            {block.lang}
          </div>
          <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto' }}>
            <code style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, color: C.text }}>
              {block.code}
            </code>
          </pre>
        </div>
      )
    case 'table':
      return (
        <div style={{ margin: '16px 0', overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      background: C.card,
                      borderBottom: `1px solid ${C.goldBorder}`,
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: C.gold,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '9px 14px',
                        borderBottom: i < block.rows.length - 1 ? `1px solid ${C.border}` : 'none',
                        lineHeight: 1.55,
                        color: C.text,
                        verticalAlign: 'top',
                      }}
                    >
                      <Inline text={cell} nowrapCode />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'callout':
      return (
        <div
          style={{
            margin: '16px 0',
            padding: '13px 16px',
            background: block.tone === 'warn' ? 'rgba(212,175,55,0.07)' : C.card,
            border: `1px solid ${block.tone === 'warn' ? 'rgba(212,175,55,0.35)' : C.border}`,
            borderRadius: 10,
            fontSize: 14,
            lineHeight: 1.65,
            color: C.text,
          }}
        >
          <span style={{ color: C.gold, fontWeight: 700, marginRight: 8 }}>
            {block.tone === 'warn' ? '⚠' : 'ℹ'}
          </span>
          <Inline text={block.text} />
        </div>
      )
  }
}

function PrevNext({ slug }: { slug: DocSlug }) {
  const idx = DOC_FLAT.findIndex((p) => p.slug === slug)
  const prev = idx > 0 ? DOC_FLAT[idx - 1] : null
  const next = idx >= 0 && idx < DOC_FLAT.length - 1 ? DOC_FLAT[idx + 1] : null
  if (!prev && !next) return null

  const cardStyle: React.CSSProperties = {
    flex: 1,
    display: 'block',
    padding: '14px 18px',
    background: C.card,
    border: `1px solid ${C.goldBorder}`,
    borderRadius: 12,
    textDecoration: 'none',
    minWidth: 0,
  }
  const kickStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 10.5,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: C.dim,
    marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 44 }}>
      {prev ? (
        <Link href={prev.href} style={cardStyle}>
          <div style={kickStyle}>← Previous</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.gold }}>{prev.label}</div>
        </Link>
      ) : (
        <div style={{ flex: 1 }} />
      )}
      {next ? (
        <Link href={next.href} style={{ ...cardStyle, textAlign: 'right' }}>
          <div style={kickStyle}>Next →</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.gold }}>{next.label}</div>
        </Link>
      ) : (
        <div style={{ flex: 1 }} />
      )}
    </div>
  )
}

export default function DocsPage({ doc, slug }: { doc: DocContent; slug: DocSlug }) {
  const tocItems = doc.blocks
    .filter((b): b is { type: 'h2'; text: string } => b.type === 'h2')
    .map((b) => ({ id: slugifyHeading(b.text), text: b.text }))

  return (
    <>
      <article className="docs-article">
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
          {doc.title}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: C.dim, margin: '0 0 12px' }}>
          <Inline text={doc.intro} />
        </p>

        {doc.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}

        <PrevNext slug={slug} />
      </article>

      <DocsToc items={tocItems} />
    </>
  )
}
