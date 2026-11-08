'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/I18nContext'
import { compareVersions, type SourceTag } from '@/lib/sourceTag'
import { AGENT_TOOL_RELEASES, releaseUrl, changesSince, type ToolRelease } from '@/lib/agentToolReleases'

/**
 * One line on an agent card: which SDK/MCP version the agent's last operation used,
 * and a notice when a newer one is out. Hidden while loading, on error and when the
 * agent has not operated on this wallet recently.
 */

type Result =
  | { status: 'tagged'; tag: SourceTag }
  | { status: 'untagged' }
  | { status: 'none' }
  | { error: string }

const C = {
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.08)',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  muted: '#8892a4',
  subtle: '#4a5568',
  success: '#68d391',
}

const CACHE_MS = 60_000
const DISMISS_KEY = 'bvcc_tool_notice_dismissed'

// The agent cards are re-created on every render of the agents page, so keep the
// answer here instead of in component state to avoid asking the server again.
const cache = new Map<string, { at: number; p: Promise<Result> }>()

function fetchResult(chainId: number, wallet: string, agent: string): Promise<Result> {
  const key = `${chainId}:${wallet.toLowerCase()}:${agent.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.p
  const p = fetch(`/api/agent-version?chainId=${chainId}&wallet=${wallet}&agent=${agent}`)
    .then(r => r.json() as Promise<Result>)
    .catch(() => ({ error: 'NETWORK' }) as Result)
  cache.set(key, { at: Date.now(), p })
  return p
}

function readDismissed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') } catch { return {} }
}

export function AgentToolVersion({ chainId, wallet, agent }: { chainId: number; wallet: string; agent: string }) {
  const { t, lang } = useI18n()
  const [result, setResult] = useState<Result | null>(null)
  const [dismissed, setDismissed] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const dismissKey = `${chainId}:${wallet.toLowerCase()}:${agent.toLowerCase()}`

  useEffect(() => {
    let alive = true
    // localStorage only exists in the browser, so it is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed())
    if (wallet && agent) fetchResult(chainId, wallet, agent).then(r => { if (alive) setResult(r) })
    return () => { alive = false }
  }, [chainId, wallet, agent])

  if (!result || 'error' in result || result.status === 'none') return null

  function dismiss(version: string) {
    const next = { ...readDismissed(), [dismissKey]: version }
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    setDismissed(next)
  }

  const box = { marginBottom: '16px', fontSize: '12px', lineHeight: 1.5 } as const
  const linkBtn = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    fontSize: '12px', color: C.subtle, textDecoration: 'underline',
  } as const

  // Untagged = sent before the tag existed (0.2.2 or older), so the tool is unknown:
  // show the notice with both commands.
  let title: string
  let releases: ToolRelease[]
  let dismissVersion: string
  let since: string
  if (result.status === 'untagged') {
    const { sdk, mcp } = AGENT_TOOL_RELEASES
    title = t('agents.toolVersion.untagged', { latest: mcp.version })
    releases = [mcp, sdk]
    dismissVersion = `${sdk.version}/${mcp.version}`
    since = '0.2.2'
  } else {
    const { tag } = result
    if (tag.tool === 'unknown') return null
    const name = tag.tool === 'sdk' ? 'SDK' : 'MCP'
    const release = AGENT_TOOL_RELEASES[tag.tool]
    if (compareVersions(tag.version, release.version) >= 0) {
      return (
        <div style={{ ...box, color: C.subtle }}>
          <span style={{ color: C.success }}>✓</span> {t('agents.toolVersion.upToDate', { tool: name, version: tag.version })}
        </div>
      )
    }
    title = t('agents.toolVersion.outdated', { tool: name, version: tag.version, latest: release.version })
    releases = [release]
    dismissVersion = release.version
    since = tag.version
  }

  if (dismissed[dismissKey] === dismissVersion) return null

  async function copy(command: string) {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(command)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard blocked: the command is still on screen */ }
  }

  const main = releases[0]
  const changes = changesSince(main, since)

  return (
    <div style={{
      ...box, padding: '12px 14px', borderRadius: '8px',
      backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`,
    }}>
      <div style={{ color: C.gold, fontWeight: 600, marginBottom: '4px' }}>{title}</div>
      <div style={{ color: C.muted }}>{t('agents.toolVersion.choice')}</div>

      {open && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ color: C.text, fontWeight: 600, marginBottom: '4px' }}>
            {t('agents.toolVersion.changesTitle', { version: since })}
          </div>
          {changes.map(v => (
            <div key={v.version}>
              <div style={{ color: C.gold, fontSize: '11px', fontWeight: 600, marginTop: '6px' }}>{v.version}</div>
              <ul style={{ margin: '2px 0 8px', paddingLeft: '18px', color: C.muted }}>
                {(lang === 'es' ? v.es : v.en).map(n => <li key={n}>{n}</li>)}
              </ul>
            </div>
          ))}
          <div style={{ color: C.muted, marginBottom: '4px' }}>{t('agents.toolVersion.howTo')}</div>
          {releases.map(r => (
            <div key={r.command} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
              <code style={{
                fontFamily: 'monospace', fontSize: '12px', color: C.text, padding: '4px 8px',
                borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {r.command}
              </code>
              <button onClick={() => copy(r.command)} style={{ ...linkBtn, color: C.gold }}>
                {copied === r.command ? t('agents.toolVersion.copied') : t('agents.toolVersion.copy')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(v => !v)} style={{ ...linkBtn, color: C.gold }}>
          {open ? t('agents.toolVersion.hideChanges') : t('agents.toolVersion.showChanges')}
        </button>
        <a href={releaseUrl(main)} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, color: C.gold }}>
          {t('agents.toolVersion.releaseNotes')}
        </a>
        <button onClick={() => dismiss(dismissVersion)} style={linkBtn}>{t('agents.toolVersion.dismiss')}</button>
      </div>
    </div>
  )
}
