'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { encodeFunctionData, formatUnits, type Address, type Hex } from 'viem'
import { useAgentsSummary, type AgentSummary } from '@/lib/useAgentsSummary'
import { useNetwork } from '@/lib/NetworkContext'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { BVCC_AGENT_WALLET_ABI } from '@/lib/abis'
import { AgentAvatar, AgentAvatarPicker } from '@/components/AgentAvatar'
import { useI18n } from '@/lib/i18n/I18nContext'

const GOLD = '#D4AF37'

function fmtEth(wei: bigint): string {
  if (wei === 0n) return '0'
  const eth = Number(wei) / 1e18
  return eth >= 1 ? eth.toFixed(4).replace(/\.?0+$/, '') : eth.toFixed(6).replace(/\.?0+$/, '')
}
function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}` }
function timeAgo(ts?: number): string | null {
  if (!ts) return null
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function AgentCard({ wallet, agent, t }: { wallet: string; agent: AgentSummary; t: (k: string) => string }) {
  const [picking, setPicking] = useState(false)
  const [, force] = useState(0)
  const pct = agent.limitWei > 0n ? Math.min(100, Number((agent.remainingWei * 100n) / agent.limitWei)) : 100
  const barColor = !agent.active ? '#fc8181' : pct > 25 ? '#48bb78' : '#f6ad55'
  const last = timeAgo(agent.lastActivity)
  const kindLabel = agent.kind === 'period' ? t('dashboard.agentPeriod') : agent.kind === 'daily' ? t('dashboard.agentDaily') : agent.kind === 'total' ? t('dashboard.agentTotal') : ''

  return (
    <div style={{ padding: 12, borderRadius: 10, background: '#0a0d13', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <AgentAvatar wallet={wallet} agent={agent.address} active={agent.active} onPick={() => setPicking((v) => !v)} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: agent.active ? '#48bb78' : '#fc8181', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4f8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: agent.alias ? 'inherit' : 'IBM Plex Mono, monospace' }}>
              {agent.alias || shortAddr(agent.address)}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: '#4a5568', marginTop: 2 }}>
            {last ? `${t('dashboard.agentLastActivity')}: ${last}` : t('dashboard.agentNever')}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace' }}>
            {agent.kind === 'unlimited' ? t('dashboard.agentUnlimited') : `${fmtEth(agent.remainingWei)} ETH`}
          </div>
          {agent.remainingUsd !== undefined && agent.kind !== 'unlimited' && (
            <div style={{ fontSize: 10.5, color: '#8892a4' }}>≈ ${agent.remainingUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          )}
        </div>
      </div>

      {/* Barra de presupuesto ETH */}
      {agent.kind !== 'unlimited' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 9, color: '#4a5568', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{kindLabel}</span>
        </div>
      )}

      {/* Gasto por token */}
      {agent.tokens.length > 0 && (
        <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {agent.tokens.map((tk) => (
            <div key={tk.token} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8892a4' }}>
              <span>{tk.symbol}</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#a9b2c3' }}>
                {Number(formatUnits(tk.spent, tk.decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                {tk.limit > 0n ? ` / ${Number(formatUnits(tk.limit, tk.decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {picking && <AgentAvatarPicker wallet={wallet} agent={agent.address} onClose={() => setPicking(false)} onSaved={() => force((n) => n + 1)} />}
    </div>
  )
}

export default function AgentsCard({ address }: { address: string }) {
  const router = useRouter()
  const { network } = useNetwork()
  const { credentialId } = useWalletAddress()
  const submitUserOp = useSubmitUserOp()
  const { t } = useI18n()
  const { data, isLoading, refetch } = useAgentsSummary(address || null, network)
  const [pausing, setPausing] = useState(false)

  if (!address) return null

  const togglePause = async () => {
    if (!credentialId || !data) return
    setPausing(true)
    try {
      const fn = data.paused ? 'unpauseAgents' : 'pauseAgents'
      const callData = encodeFunctionData({ abi: BVCC_AGENT_WALLET_ABI, functionName: fn, args: [] }) as Hex
      await executeWithFaceId({ network, walletAddress: address as Address, credentialId, calls: [{ target: address as Address, callData }], submitUserOp })
      setTimeout(() => refetch(), 2000)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPausing(false)
    }
  }

  return (
    <div className="fade-in" style={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#8892a4' }}>{t('dashboard.agentsTitle')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && data.total > 0 && (
            <button onClick={togglePause} disabled={pausing}
              style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5, cursor: pausing ? 'default' : 'pointer',
                color: data.paused ? '#48bb78' : '#f6ad55',
                background: data.paused ? 'rgba(72,187,120,0.1)' : 'rgba(246,173,85,0.1)',
                border: `1px solid ${data.paused ? 'rgba(72,187,120,0.3)' : 'rgba(246,173,85,0.3)'}` }}>
              {pausing ? '…' : data.paused ? t('dashboard.agentResume') : t('dashboard.agentPause')}
            </button>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: GOLD, fontFamily: 'IBM Plex Mono, monospace' }}>{isLoading ? '…' : data?.total ?? 0}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ width: '100%', height: 60, borderRadius: 8 }} />
      ) : (data && data.agents.length > 0) ? (
        <>
          {data.agents.map((a) => <AgentCard key={a.address} wallet={address} agent={a} t={t} />)}
          <button onClick={() => router.push('/wallet/agents')}
            style={{ marginTop: 2, width: '100%', padding: '8px 0', background: 'transparent', border: `1px solid ${GOLD}40`, borderRadius: 6, color: GOLD, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {t('dashboard.agentsManage')}
          </button>
        </>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4a5568' }}>{t('dashboard.agentsEmpty')}</p>
          <button onClick={() => router.push('/wallet/agents')}
            style={{ width: '100%', padding: '8px 0', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, color: GOLD, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {t('dashboard.agentsAuthorize')}
          </button>
        </div>
      )}
    </div>
  )
}
