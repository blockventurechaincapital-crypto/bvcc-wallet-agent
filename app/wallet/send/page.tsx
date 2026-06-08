'use client'
import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isAddress, createPublicClient, http, encodeAbiParameters, encodeFunctionData, parseGwei, parseUnits, formatUnits, type Address, type Hex } from 'viem'
import { parseEthAmount } from '@/lib/send'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useTokenBalance } from '@/lib/useTokenBalance'
import { addressBook, type AddressEntry } from '@/lib/addressBook'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

type SendStatus = 'idle' | 'building' | 'signing' | 'sending' | 'success' | 'error'
type Token = 'ETH' | 'USDC'

// Reserva de gas al pulsar MAX en ETH (el wallet paga el gas del UserOp)
const ETH_GAS_RESERVE = 300_000_000_000_000n // 0.0003 ETH

function fmtBal(wei: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(wei, decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals === 6 ? 2 : 6 })
}

const ERC20_TRANSFER_ABI = [{
  type: 'function',
  name: 'transfer',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
  stateMutability: 'nonpayable',
}] as const

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

function SendPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address: walletAddress, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()

  const USDC_ADDRESS = network.tokens.usdc as Address | undefined

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [token, setToken] = useState<Token>('ETH')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<SendStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AddressEntry[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const toInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const tk = searchParams.get('token')
    if (tk === 'USDC') setToken('USDC')
    else setToken('ETH')

    const prefilledTo = searchParams.get('to')
    if (prefilledTo) setTo(prefilledTo)
  }, [searchParams])

  const handleToChange = (value: string) => {
    setTo(value)
    if (value.trim().length > 0) {
      const results = addressBook.search(value)
      setSuggestions(results)
      setShowSuggestions(results.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (entry: AddressEntry) => {
    setTo(entry.address)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const decimals = token === 'ETH' ? 18 : 6
  const { data: balance } = useTokenBalance(
    walletAddress ?? null,
    network,
    token === 'ETH' ? { isNative: true } : { isNative: false, address: USDC_ADDRESS ?? null },
  )

  const setMax = () => {
    if (balance === undefined) return
    if (token === 'ETH') {
      const usable = balance > ETH_GAS_RESERVE ? balance - ETH_GAS_RESERVE : 0n
      setAmount(formatUnits(usable, 18))
    } else {
      setAmount(formatUnits(balance, 6))
    }
  }

  const amountWei = token === 'ETH' ? parseEthAmount(amount) : (() => {
    try { return amount ? parseUnits(amount, 6) : 0n } catch { return 0n }
  })()

  const toValid = isAddress(to)
  const amountValid = amountWei > 0n
  const isBusy = status === 'building' || status === 'signing' || status === 'sending'
  const canSubmit = toValid && amountValid && !isBusy

  // Fee only applies to ETH (contract handles ERC-20 fee differently, but preview for ETH)
  const fee = token === 'ETH' && amountValid ? (amountWei * 500n) / 1_000_000n : 0n
  const amountAfterFee = token === 'ETH' && amountValid ? amountWei - fee : amountWei

  const handleSend = async () => {
    if (!canSubmit) return
    setStatus('building')
    setErrorMsg('')

    try {
      if (!walletAddress) throw new Error('No hay wallet activa. Vuelve al inicio.')

      // ── 1. Nonce ────────────────────────────────────────────────────────────
      const nonce = await publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'getNonce',
        args: [],
      })

      // ── 2. Build execution based on token ───────────────────────────────────
      let execTarget: Address
      let execValue: bigint
      let execCallData: Hex

      if (token === 'ETH') {
        execTarget = to as Address
        execValue = amountWei
        execCallData = '0x'
      } else {
        // USDC: call transfer(to, amount) on the USDC contract
        if (!USDC_ADDRESS) throw new Error('USDC no disponible en esta red')
        execTarget = USDC_ADDRESS
        execValue = 0n
        execCallData = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [to as Address, amountWei],
        })
      }

      const executionData = encodeAbiParameters(
        [{ type: 'tuple[]', components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ]}],
        [[{ target: execTarget, value: execValue, callData: execCallData }]]
      )
      const callData = encodeFunctionData({
        abi: BVCC_WALLET_ABI,
        functionName: 'execute',
        args: [BATCH_MODE, executionData],
      })

      // ── 3. Gas prices ───────────────────────────────────────────────────────
      const feeData = await publicClient.estimateFeesPerGas()
      const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('2')
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')

      // ── 4. UserOp ───────────────────────────────────────────────────────────
      const userOp = {
        sender: walletAddress as Address,
        nonce,
        initCode: '0x' as Hex,
        callData,
        accountGasLimits: packBytes32(400_000n, 400_000n),
        preVerificationGas: 80_000n,
        gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
        paymasterAndData: '0x' as Hex,
        signature: '0x' as Hex,
      }

      // ── 5. userOpHash ───────────────────────────────────────────────────────
      const userOpHash = await publicClient.readContract({
        address: ENTRYPOINT_ADDRESS,
        abi: ENTRYPOINT_ABI,
        functionName: 'getUserOpHash',
        args: [userOp],
      }) as Hex

      // ── 6. Face ID ──────────────────────────────────────────────────────────
      setStatus('signing')
      const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
        await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))

      // ── 7. WebAuthn signature ───────────────────────────────────────────────
      const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataHex))
      const challengeIndex = BigInt(clientDataStr.indexOf('"challenge":'))
      const typeIndex = BigInt(clientDataStr.indexOf('"type":'))

      const signature = encodeAbiParameters(
        [
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
          { name: 'challengeIndex', type: 'uint256' },
          { name: 'typeIndex', type: 'uint256' },
          { name: 'authenticatorData', type: 'bytes' },
          { name: 'clientDataJSON', type: 'string' },
        ],
        [
          `0x${r.toString(16).padStart(64, '0')}` as Hex,
          `0x${s.toString(16).padStart(64, '0')}` as Hex,
          challengeIndex,
          typeIndex,
          authenticatorData,
          clientDataStr,
        ]
      )

      // ── 8. Submit via server bundler ────────────────────────────────────────
      setStatus('sending')
      const { txHash } = await submitUserOp({
        chainId: network.chainId,
        userOp: {
          ...userOp,
          nonce: nonce.toString(),
          preVerificationGas: userOp.preVerificationGas.toString(),
          signature,
        },
      })

      setTxHash(txHash)
      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const statusLabel = () => {
    if (status === 'building') return t('send.statusBuilding')
    if (status === 'signing') return t('send.statusSigning')
    if (status === 'sending') return t('send.statusSending')
    return t('send.confirmFaceId')
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#06080f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(212,175,55,0.15)', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '24px' }}>
          ✓
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f0f4f8', marginBottom: '8px' }}>{t('send.successTitle')}</h2>
        <p style={{ fontSize: '13px', color: '#8892a4', marginBottom: '8px', textAlign: 'center' }}>
          {amount} {token} → {to.slice(0, 6)}...{to.slice(-4)}
        </p>
        {txHash && (
          <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#4a5568', marginBottom: '28px' }}>
            TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
        )}
        <button
          onClick={() => router.back()}
          style={{ width: '100%', maxWidth: '360px', padding: '14px', backgroundColor: '#D4AF37', border: 'none', borderRadius: '6px', color: '#000', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          {t('common.back')}
        </button>
      </main>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#06080f', padding: '24px 16px', maxWidth: '400px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ fontSize: '13px', color: '#8892a4', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
        {t('send.backBtn')}
      </button>

      {/* Token selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['ETH', 'USDC'] as Token[]).map(tk => (
          <button
            key={tk}
            onClick={() => { setToken(tk); setAmount('') }}
            style={{
              padding: '7px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              border: token === tk ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
              backgroundColor: token === tk ? 'rgba(212,175,55,0.12)' : 'transparent',
              color: token === tk ? '#D4AF37' : '#8892a4',
            }}
          >
            {tk}
          </button>
        ))}
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f0f4f8', marginBottom: '24px' }}>
        {t('common.send')} {token}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Destination */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            {t('send.destinationLabel')}
          </label>
          <input
            ref={toInputRef}
            type="text"
            value={to}
            onChange={e => handleToChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            placeholder={t('send.destinationPlaceholder')}
            style={{
              width: '100%', padding: '11px 14px', backgroundColor: '#0d1117', boxSizing: 'border-box',
              border: `1px solid ${to.length > 0 ? (toValid ? 'rgba(104,211,145,0.35)' : 'rgba(252,129,129,0.35)') : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '6px', color: '#f0f4f8', fontSize: '13px', fontFamily: 'monospace', outline: 'none',
            }}
          />
          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              zIndex: 50, marginTop: '4px',
              backgroundColor: '#1a1f2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {suggestions.map(entry => (
                <button
                  key={entry.address}
                  onMouseDown={() => selectSuggestion(entry)}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '10px 14px', backgroundColor: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f0f4f8', marginBottom: '2px' }}>
                    {entry.name}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8892a4' }}>
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('common.amount')} ({token})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8892a4', fontFamily: 'monospace' }}>
                {t('common.balance')}: {balance !== undefined ? fmtBal(balance, decimals) : '—'} {token}
              </span>
              <button
                type="button"
                onClick={setMax}
                disabled={balance === undefined || balance === 0n}
                style={{
                  padding: '2px 8px', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em',
                  color: '#D4AF37', backgroundColor: 'rgba(212,175,55,0.1)',
                  border: '1px solid rgba(212,175,55,0.25)', borderRadius: '4px',
                  cursor: balance ? 'pointer' : 'not-allowed', opacity: balance ? 1 : 0.4,
                  textTransform: 'uppercase',
                }}
              >
                {t('common.max')}
              </button>
            </div>
          </div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={token === 'USDC' ? '0.00' : '0.000'}
            min="0"
            step="any"
            style={{
              width: '100%', padding: '11px 14px', backgroundColor: '#0d1117', boxSizing: 'border-box',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px', color: '#f0f4f8', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Fee breakdown — ETH only */}
        {token === 'ETH' && amountValid && (
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8892a4' }}>{t('send.willReceive')}</span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f0f4f8' }}>
                {(Number(amountAfterFee) / 1e18).toFixed(8)} ETH
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#4a5568' }}>{t('send.feeBvcc')}</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#D4AF37' }}>
                {(Number(fee) / 1e18).toFixed(8)} ETH
              </span>
            </div>
          </div>
        )}

        {/* USDC info */}
        {token === 'USDC' && amountValid && (
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#8892a4' }}>{t('send.willSend')}</span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f0f4f8' }}>
                {parseFloat(amount).toFixed(2)} USDC
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && errorMsg && (
          <div style={{ padding: '10px 14px', backgroundColor: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.25)', borderRadius: '6px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#fc8181', wordBreak: 'break-word' }}>{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSend}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: isBusy ? 'rgba(212,175,55,0.6)' : '#D4AF37',
            border: 'none', borderRadius: '6px', color: '#000',
            fontSize: '14px', fontWeight: '600',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: (toValid && amountValid) ? 1 : 0.45,
          }}
        >
          {statusLabel()}
        </button>
      </div>
    </main>
  )
}

export default function SendPage() {
  return (
    <Suspense>
      <SendPageInner />
    </Suspense>
  )
}
