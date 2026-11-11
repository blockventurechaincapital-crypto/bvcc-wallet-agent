'use client'
import { useMemo, useState } from 'react'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, formatUnits, getAddress, isAddress, type Address, type Hex } from 'viem'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { BATCH_MODE, ENTRYPOINT_ADDRESS } from '@/lib/entrypoint'
import {
  executeWithFaceId, type ExecCall,
  USEROP_VERIFICATION_GAS, USEROP_PREVERIFICATION_GAS,
} from '@/lib/executeUserOp'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useTokens, type WalletToken } from '@/lib/useTokens'
import { useWalletType } from '@/lib/useWalletType'
import { feeNumerator, feeRateLabel, feeOf, maxTokenAmount } from '@/lib/fees'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { suggestGasFees } from '@/lib/gasFees'
import { rpcTransport } from '@/lib/rpc'
import { failureSummary } from '@/lib/txFailure'
import { txUrl } from '@/lib/waitForUserOp'
import { useI18n } from '@/lib/i18n/I18nContext'

/**
 * Sends every selected token of an outdated wallet to one address, in a single operation
 * signed once with the passkey. Meant for emptying the old wallet after creating the new one.
 *
 * Before the passkey is asked, the batch is run as a call from the EntryPoint: that both
 * sizes the gas and catches a token that would make the whole operation revert. The native
 * coin goes last and keeps back what the operation itself may cost.
 */

const GOLD = '#D4AF37'
const ERC20_TRANSFER_ABI = [{
  name: 'transfer', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
}] as const

type Phase = 'select' | 'checking' | 'review' | 'signing' | 'done' | 'error'
type Plan = { calls: ExecCall[]; callGas: bigint; nativeAmount: bigint; reserve: bigint }

function tokenCall(token: WalletToken, to: Address, amount: bigint): ExecCall {
  if (token.isNative) return { target: to, value: amount }
  return {
    target: token.address as Address,
    callData: encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: 'transfer', args: [to, amount] }),
  }
}

function batchData(calls: ExecCall[]): Hex {
  const executionData = encodeAbiParameters(
    [{ type: 'tuple[]', components: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ] }],
    [calls.map(c => ({ target: c.target, value: c.value ?? 0n, callData: (c.callData ?? '0x') as Hex }))],
  )
  return encodeFunctionData({ abi: BVCC_WALLET_ABI, functionName: 'execute', args: [BATCH_MODE, executionData] })
}

function fmt(v: bigint, decimals: number) {
  const s = formatUnits(v, decimals)
  const [i, d = ''] = s.split('.')
  return d ? `${i}.${d.slice(0, 6).replace(/0+$/, '') || '0'}` : i
}

export default function SendAllModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { address: walletAddress, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const { walletType } = useWalletType()
  const submitUserOp = useSubmitUserOp()
  const feeNum = feeNumerator(walletType)

  const { data, isLoading } = useTokens(walletAddress ?? null, network)
  const tokens = useMemo(
    () => (data?.tokens ?? []).filter(tk => tk.network.chainId === network.chainId && tk.balance > 0n),
    [data, network.chainId],
  )

  // Unticked = the user's choice. Suspicious tokens start unticked: spam tokens are often
  // made to revert, and one revert stops the whole batch.
  const [unticked, setUnticked] = useState<Set<string> | null>(null)
  const off = unticked ?? new Set(tokens.filter(tk => tk.suspicious).map(tk => tk.key))
  const selected = tokens.filter(tk => !off.has(tk.key))
  const toggle = (key: string) => {
    const next = new Set(off)
    if (next.has(key)) next.delete(key); else next.add(key)
    setUnticked(next)
    setPhase('select'); setPlan(null); setError('')
  }

  const [to, setTo] = useState('')
  const [phase, setPhase] = useState<Phase>('select')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [txHash, setTxHash] = useState('')

  const toValid = isAddress(to.trim())
  const toSelf = toValid && walletAddress && to.trim().toLowerCase() === walletAddress.toLowerCase()
  const toError = to.trim() && (!toValid ? t('wallet.sendAllBadAddress') : toSelf ? t('wallet.sendAllSelf') : '')

  async function prepare() {
    if (!walletAddress || !toValid || toSelf || !selected.length) return
    setError(''); setPlan(null); setPhase('checking')
    const dest = getAddress(to.trim())
    const client = createPublicClient({ chain: network.viemChain, transport: rpcTransport(network) })
    const native = selected.find(tk => tk.isNative)
    const erc20 = selected.filter(tk => !tk.isNative)

    // Every ERC-20 sends the most that leaves room for its fee, which the contract adds on top.
    const tokenCalls = erc20.map(tk => tokenCall(tk, dest, maxTokenAmount(tk.balance, feeNum)))
    // The native amount only changes the value, not the gas, so half the balance stands in for it.
    const probe = native ? [...tokenCalls, tokenCall(native, dest, native.balance / 2n)] : tokenCalls

    const estimate = (calls: ExecCall[]) =>
      client.estimateGas({ account: ENTRYPOINT_ADDRESS, to: walletAddress as Address, data: batchData(calls) })

    let gas: bigint
    try {
      gas = await estimate(probe)
    } catch {
      // Find which tokens fail on their own and untick them, so the rest can still go.
      const bad = new Set<string>()
      const list = native ? [...erc20, native] : erc20
      for (let i = 0; i < list.length; i++) {
        try { await estimate([probe[i]]) } catch { bad.add(list[i].key) }
      }
      setBlocked(bad)
      if (bad.size) {
        const next = new Set(off); bad.forEach(k => next.add(k)); setUnticked(next)
        setError(t('wallet.sendAllBlocked'))
      } else {
        setError(t('wallet.sendAllCheckFailed'))
      }
      setPhase('select')
      return
    }

    const callGas = (gas * 13n) / 10n + 50_000n
    let nativeAmount = 0n
    let reserve = 0n
    try {
      const { maxFeePerGas } = await suggestGasFees(client, network.chainId)
      // The EntryPoint takes the prefund from the wallet before running the batch, so the
      // native send must leave it there. 1.5x covers fees moving before the signature.
      reserve = ((USEROP_VERIFICATION_GAS + callGas + USEROP_PREVERIFICATION_GAS) * maxFeePerGas * 3n) / 2n
      if (native) nativeAmount = native.balance > reserve ? native.balance - reserve : 0n
    } catch (e) {
      setError(failureSummary(e)); setPhase('select'); return
    }
    if (native && nativeAmount === 0n && !tokenCalls.length) {
      setError(t('wallet.sendAllNoGas')); setPhase('select'); return
    }
    const calls = nativeAmount > 0n && native ? [...tokenCalls, tokenCall(native, dest, nativeAmount)] : tokenCalls
    setPlan({ calls, callGas, nativeAmount, reserve })
    setPhase('review')
  }

  async function send() {
    // No stored credential (wallet opened without confirming the passkey) is fine: the
    // passkey is then picked when signing, as on the send page.
    if (!plan || !walletAddress) return
    setError(''); setPhase('signing')
    try {
      const hash = await executeWithFaceId({
        network, walletAddress: walletAddress as Address, credentialId,
        calls: plan.calls, submitUserOp, callGasLimit: plan.callGas,
      })
      setTxHash(hash); setPhase('done')
    } catch (e) {
      setError(failureSummary(e)); setPhase('error')
    }
  }

  // What arrives for each ticked token, shown in the list and on review.
  function arrives(tk: WalletToken): string {
    if (tk.isNative) {
      if (!plan) return t('wallet.sendAllNativeLater')
      if (plan.nativeAmount === 0n) return t('wallet.sendAllNativeKept')
      return `${fmt(plan.nativeAmount - feeOf(plan.nativeAmount, feeNum), tk.decimals)} ${tk.symbol}`
    }
    return `${fmt(maxTokenAmount(tk.balance, feeNum), tk.decimals)} ${tk.symbol}`
  }

  const btn = (primary: boolean, disabled = false) => ({
    flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    color: primary ? '#06080f' : '#8892a4', backgroundColor: primary ? GOLD : 'transparent',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.12)',
  }) as const

  const busy = phase === 'checking' || phase === 'signing'
  const native = tokens.find(tk => tk.isNative)

  return (
    <div
      onClick={() => { if (!busy) onClose() }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 210,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '480px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto',
          backgroundColor: '#0d1117', border: '1px solid rgba(212,175,55,0.35)',
          borderRadius: '10px', color: '#f0f4f8', fontSize: '13px',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: GOLD }}>{t('wallet.sendAllTitle')}</h2>
        <p style={{ margin: '0 0 14px', lineHeight: 1.55, color: '#c3cbd8' }}>
          {t('wallet.sendAllBody', { rate: feeRateLabel(feeNum) })}
        </p>

        {phase === 'done' ? (
          <>
            <p style={{ color: '#68d391', margin: '0 0 12px' }}>{t('wallet.sendAllDone')}</p>
            <a href={txUrl(network, txHash)} target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>
              {t('wallet.sendAllViewTx')}
            </a>
            <div style={{ marginTop: '16px' }}>
              <button onClick={onClose} style={btn(true)}>{t('wallet.sendAllClose')}</button>
            </div>
          </>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '12px', color: '#8892a4', marginBottom: '4px' }}>
              {t('wallet.sendAllTo')}
            </label>
            <input
              value={to}
              disabled={busy || phase === 'review'}
              onChange={e => { setTo(e.target.value); setPlan(null); setPhase('select') }}
              placeholder="0x…"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 10px', fontFamily: 'monospace', fontSize: '12.5px',
                backgroundColor: 'rgba(0,0,0,0.35)', color: '#f0f4f8', borderRadius: '6px',
                border: `1px solid ${toError ? '#fc8181' : 'rgba(255,255,255,0.12)'}`,
              }}
            />
            {toError && <div style={{ color: '#fc8181', fontSize: '12px', marginTop: '4px' }}>{toError}</div>}

            <div style={{ margin: '14px 0 6px', fontSize: '12px', color: '#8892a4' }}>{t('wallet.sendAllTokens')}</div>
            {isLoading && <div style={{ color: '#8892a4' }}>{t('wallet.sendAllLoading')}</div>}
            {!isLoading && !tokens.length && <div style={{ color: '#8892a4' }}>{t('wallet.sendAllEmpty')}</div>}
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
              {tokens.map(tk => (
                <label key={tk.key} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: busy || phase === 'review' ? 'default' : 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={!off.has(tk.key)}
                    disabled={busy || phase === 'review'}
                    onChange={() => toggle(tk.key)}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{tk.symbol}</b>{' '}
                    <span style={{ color: '#8892a4' }}>{fmt(tk.balance, tk.decimals)}</span>
                    {tk.suspicious && <span style={{ color: '#e6b800', fontSize: '11px' }}> · {t('wallet.sendAllSuspicious')}</span>}
                    {blocked.has(tk.key) && <span style={{ color: '#fc8181', fontSize: '11px' }}> · {t('wallet.sendAllTokenFails')}</span>}
                  </span>
                  {!off.has(tk.key) && (
                    <span style={{ fontSize: '11.5px', color: '#c3cbd8', whiteSpace: 'nowrap' }}>→ {arrives(tk)}</span>
                  )}
                </label>
              ))}
            </div>

            <p style={{ margin: '12px 0 0', fontSize: '12px', lineHeight: 1.5, color: '#8892a4' }}>
              {t('wallet.sendAllPositions')}
            </p>

            {phase === 'review' && plan && (
              <div style={{
                marginTop: '14px', padding: '12px', borderRadius: '6px',
                backgroundColor: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
              }}>
                <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '4px' }}>{t('wallet.sendAllCheckAddress')}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12.5px', wordBreak: 'break-all', color: '#f0f4f8' }}>
                  {getAddress(to.trim())}
                </div>
                {native && !off.has(native.key) && (
                  <div style={{ fontSize: '12px', color: '#8892a4', marginTop: '8px' }}>
                    {t('wallet.sendAllReserve', { amount: fmt(plan.reserve > native.balance ? native.balance : plan.reserve, native.decimals), symbol: native.symbol })}
                  </div>
                )}
              </div>
            )}

            {error && <div style={{ color: '#fc8181', fontSize: '12px', marginTop: '12px', lineHeight: 1.5 }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              {phase === 'review' ? (
                <>
                  <button onClick={send} disabled={busy} style={btn(true, busy)}>{t('wallet.sendAllConfirm')}</button>
                  <button onClick={() => { setPlan(null); setPhase('select') }} style={btn(false)}>{t('wallet.sendAllBack')}</button>
                </>
              ) : (
                <>
                  <button
                    onClick={prepare}
                    disabled={busy || !toValid || !!toSelf || !selected.length}
                    style={btn(true, busy || !toValid || !!toSelf || !selected.length)}
                  >
                    {phase === 'checking' ? t('wallet.sendAllChecking')
                      : phase === 'signing' ? t('wallet.sendAllSigning')
                      : t('wallet.sendAllReview', { n: selected.length })}
                  </button>
                  <button onClick={onClose} disabled={busy} style={btn(false, busy)}>{t('wallet.sendAllCancel')}</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
