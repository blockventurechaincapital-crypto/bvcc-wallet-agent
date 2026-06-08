'use client'
import { useRouter } from 'next/navigation'
import { useAgentsSummary, type AgentSummary } from '@/lib/useAgentsSummary'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'

function fmtEth(wei: bigint): string {
  if (wei === 0n) return '0'
  const eth = Number(wei) / 1e18
  if (eth >= 1) return eth.toFixed(4).replace(/\.?0+$/, '')
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function AgentRow({ agent, kindLabel, unlimitedLabel }: { agent: AgentSummary; kindLabel: (k: string) => string; unlimitedLabel: string }) {
  const pct = agent.limitWei > 0n ? Math.min(100, Number((agent.remainingWei * 100n) / agent.limitWei)) : 100
  const barColor = !agent.active ? '#fc8181' : pct > 25 ? '#48bb78' : '#f6ad55'
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: agent.active ? '#48bb78' : '#fc8181', flexShrink: 0 }} />
          <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#f0f4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: agent.alias ? 'inherit' : 'IBM Plex Mono, monospace' }}>
            {agent.alias || shortAddr(agent.address)}
          </span>
        </div>
        <span style={{ fontSize: '11.5px', color: '#8892a4', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>
          {agent.kind === 'unlimited' ? unlimitedLabel : `${fmtEth(agent.remainingWei)} ETH`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          {agent.kind !== 'unlimited' && (
            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '2px', transition: 'width 0.3s' }} />
          )}
        </div>
        <span style={{ fontSize: '9.5px', color: '#4a5568', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
          {agent.kind === 'unlimited' ? '' : kindLabel(agent.kind)}
        </span>
      </div>
    </div>
  )
}

export default function AgentsCard({ address }: { address: string }) {
  const router = useRouter()
  const { network } = useNetwork()
  const { t } = useI18n()
  const { data, isLoading } = useAgentsSummary(address || null, network)

  if (!address) return null

  const kindLabel = (k: string) =>
    k === 'period' ? t('dashboard.agentPeriod') : k === 'daily' ? t('dashboard.agentDaily') : t('dashboard.agentTotal')

  return (
    <div className="fade-in" style={{
      backgroundColor: '#0d1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '8px',
      padding: '16px 20px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#8892a4' }}>{t('dashboard.agentsTitle')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {data?.paused && (
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#f6ad55', padding: '1px 6px', borderRadius: '4px', background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.25)' }}>
              {t('dashboard.agentsPaused')}
            </span>
          )}
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#D4AF37', fontFamily: 'IBM Plex Mono, monospace' }}>
            {isLoading ? '…' : data?.total ?? 0}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: '6px' }} />
      ) : (data && data.agents.length > 0) ? (
        <>
          {data.agents.map(a => (
            <AgentRow key={a.address} agent={a} kindLabel={kindLabel} unlimitedLabel={t('dashboard.agentUnlimited')} />
          ))}
          <button
            onClick={() => router.push('/wallet/agents')}
            style={{ marginTop: '12px', width: '100%', padding: '8px 0', background: 'transparent', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '6px', color: '#D4AF37', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
          >
            {t('dashboard.agentsManage')}
          </button>
        </>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#4a5568' }}>{t('dashboard.agentsEmpty')}</p>
          <button
            onClick={() => router.push('/wallet/agents')}
            style={{ width: '100%', padding: '8px 0', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '6px', color: '#D4AF37', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
          >
            {t('dashboard.agentsAuthorize')}
          </button>
        </div>
      )}
    </div>
  )
}
