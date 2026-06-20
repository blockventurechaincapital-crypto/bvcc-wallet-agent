'use client'
import { useState } from 'react'
import { encodeFunctionData, formatUnits, type Address, type Hex } from 'viem'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { useAllowances, type Allowance } from '@/lib/useAllowances'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { spenderLabel } from '@/lib/defiContracts'
import { useI18n } from '@/lib/i18n/I18nContext'

const GOLD = '#D4AF37'
const trunc = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const REVOKE_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'bool' }], outputs: [] },
] as const

function amountLabel(a: Allowance, unlimitedTxt: string, nftTxt: string): string {
  if (a.kind === 'nft') return nftTxt
  if (a.unlimited) return unlimitedTxt
  return `${Number(formatUnits(a.amount, a.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${a.symbol}`
}

export default function AllowancesPage() {
  const { address, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const submitUserOp = useSubmitUserOp()
  const { t } = useI18n()
  const { items, loading, error, reload } = useAllowances(address)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  const revoke = async (a: Allowance) => {
    if (!address || !credentialId) return
    const key = `${a.token}-${a.spender}`
    setBusy(key)
    try {
      const callData = a.kind === 'nft'
        ? encodeFunctionData({ abi: REVOKE_ABI, functionName: 'setApprovalForAll', args: [a.spender, false] })
        : encodeFunctionData({ abi: REVOKE_ABI, functionName: 'approve', args: [a.spender, 0n] })
      await executeWithFaceId({
        network, walletAddress: address as Address, credentialId,
        calls: [{ target: a.token, callData: callData as Hex }], submitUserOp,
      })
      setDone((d) => ({ ...d, [key]: true }))
      setTimeout(reload, 1500)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f4f8', margin: 0 }}>{t('allowances.title')}</h1>
        <button onClick={reload} disabled={loading}
          style={{ padding: '7px 14px', borderRadius: '7px', border: `1px solid ${GOLD}55`, background: 'transparent', color: GOLD, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {t('allowances.refresh')}
        </button>
      </div>
      <p style={{ color: '#8892a4', fontSize: '13px', margin: '0 0 20px', maxWidth: '620px' }}>{t('allowances.subtitle')}</p>

      {!address && <div style={{ color: '#8892a4', fontSize: '13px' }}>{t('allowances.connectFirst')}</div>}
      {loading && <div style={{ color: '#8892a4', fontSize: '13px' }}>{t('allowances.loading')}</div>}
      {error && <div style={{ color: '#fc8181', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && address && items.length === 0 && (
        <div style={{ color: '#8892a4', fontSize: '13px' }}>{t('allowances.empty')}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((a) => {
          const key = `${a.token}-${a.spender}`
          const label = spenderLabel(a.spender)
          const isDone = done[key]
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', borderRadius: '10px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f4f8' }}>{a.symbol}</span>
                  {a.kind === 'nft' && <span style={{ fontSize: '10px', color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '1px 5px' }}>NFT</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#8892a4', marginTop: '3px' }}>
                  {t('allowances.colSpender')}: <span style={{ color: label ? GOLD : '#a9b2c3' }}>{label ?? t('allowances.unknownSpender')}</span>
                  <span style={{ color: '#4a5568', fontFamily: 'monospace' }}> · {trunc(a.spender)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: a.unlimited ? '#fc8181' : '#a9b2c3', whiteSpace: 'nowrap' }}>
                  {amountLabel(a, t('allowances.unlimited'), t('allowances.nftAll'))}
                </span>
                <button onClick={() => revoke(a)} disabled={busy === key || isDone}
                  style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid rgba(252,129,129,0.4)', background: isDone ? 'transparent' : 'rgba(252,129,129,0.08)', color: isDone ? '#48bb78' : '#fc8181', fontSize: '12px', cursor: busy === key || isDone ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {isDone ? t('allowances.revoked') : busy === key ? t('allowances.revoking') : t('allowances.revoke')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: '16px', fontSize: '11px', color: '#4a5568' }}>{t('allowances.faceIdHint')}</div>
      )}
    </div>
  )
}
