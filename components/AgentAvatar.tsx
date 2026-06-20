'use client'
import { AGENT_AVATARS, avatarUrl, getAgentAvatars, setAgentAvatar } from '@/lib/agentAvatars'

const GOLD = '#D4AF37'

// Color determinista a partir de la address (avatar fallback sin imagen).
function hue(addr: string): number {
  let h = 0
  for (let i = 2; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) % 360
  return h
}

// Retrato del agente. Borde verde si activo / rojo si no. Clic → abre el selector.
export function AgentAvatar({ wallet, agent, active, onPick, size = 60 }: {
  wallet: string; agent: string; active: boolean; onPick: () => void; size?: number
}) {
  const url = avatarUrl(getAgentAvatars(wallet)[agent.toLowerCase()])
  const h = hue(agent)
  const ring = active ? '#48bb78' : '#fc8181'
  return (
    <button onClick={onPick} title="Cambiar imagen"
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: `2px solid ${ring}`, boxShadow: `0 0 0 1px ${ring}33`, cursor: 'pointer', padding: 0,
        background: url ? '#000' : `linear-gradient(135deg, hsl(${h},55%,45%), hsl(${(h + 40) % 360},55%,35%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.42 }}>🤖</span>}
    </button>
  )
}

// Grid de retratos disponibles (public/agents/ registrados en AGENT_AVATARS).
export function AgentAvatarPicker({ wallet, agent, onClose, onSaved }: {
  wallet: string; agent: string; onClose: () => void; onSaved: () => void
}) {
  return (
    <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: '#0a0d13', border: '1px solid rgba(255,255,255,0.08)' }}>
      {AGENT_AVATARS.length === 0 ? (
        <div style={{ fontSize: 10.5, color: '#8892a4' }}>Deja PNG 512×512 en <code style={{ color: GOLD }}>public/agents/</code> y regístralos en <code style={{ color: GOLD }}>lib/agentAvatars.ts</code>.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AGENT_AVATARS.map((f) => (
            <button key={f} onClick={() => { setAgentAvatar(wallet, agent, f); onSaved(); onClose() }}
              style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 0, background: '#000' }}>
              <img src={avatarUrl(f)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
