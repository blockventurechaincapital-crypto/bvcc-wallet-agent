'use client'
import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isAddress, createPublicClient, http, encodeAbiParameters, encodeFunctionData, parseGwei, parseUnits, formatUnits, type Address, type Hex } from 'viem'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useTokens, type WalletToken } from '@/lib/useTokens'
import { useWalletType } from '@/lib/useWalletType'
import { feeNumerator, feeRateLabel, previewSend, maxTokenAmount } from '@/lib/fees'
import { addressBook, type AddressEntry } from '@/lib/addressBook'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

type SendStatus = 'idle' | 'building' | 'signing' | 'sending' | 'success' | 'error'

// Reserva de gas al pulsar MAX en el token nativo (el wallet paga el gas del UserOp)
const NATIVE_GAS_RESERVE = 300_000_000_000_000n // 0.0003 ETH

function fmtBal(wei: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(wei, decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: Math.min(decimals, 6) })
}

function TokenIcon({ token }: { token: WalletToken }) {
  const [err, setErr] = useState(false)
  const size = 24
  if (!token.logo || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 600, color: '#8892a4',
      }}>
        {token.symbol.slice(0, 3).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={token.logo} alt={token.symbol} width={size} height={size}
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  )
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
  const { walletType } = useWalletType()

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Lista de tokens con saldo en la red activa (nativo siempre presente).
  const { data: tokenData, isLoading: tokensLoading } = useTokens(walletAddress ?? null, network)
  const tokens = useMemo(() => tokenData?.tokens ?? [], [tokenData])

  const [tokenKey, setTokenKey] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<SendStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AddressEntry[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const toInputRef = useRef<HTMLInputElement>(null)

  // Token activo: lo que el usuario haya elegido, o lo que pida ?token=.
  // ?token= admite contrato 0x…, 'native', o un símbolo (ETH/BNB/USDC/WETH…):
  // los enlaces viejos mandan símbolo, así que se resuelve por ambos.
  const requestedToken = searchParams.get('token')
  const token: WalletToken | undefined = useMemo(() => {
    if (tokens.length === 0) return undefined
    const picked = tokenKey ? tokens.find(tk => tk.key === tokenKey) : undefined
    if (picked) return picked
    const q = requestedToken?.trim().toLowerCase()
    const match = !q
      ? undefined
      : q === 'native'
        ? tokens.find(tk => tk.isNative)
        : q.startsWith('0x')
          ? tokens.find(tk => tk.address?.toLowerCase() === q)
          : tokens.find(tk => tk.symbol.toLowerCase() === q)
    return match ?? tokens[0]
  }, [tokens, tokenKey, requestedToken])

  useEffect(() => {
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

  const decimals = token?.decimals ?? 18
  const symbol = token?.symbol ?? ''
  const isNative = token?.isNative ?? true
  const balance = token?.balance

  const feeNum = feeNumerator(walletType)
  const feeRate = feeRateLabel(feeNum)

  const setMax = () => {
    if (balance === undefined) return
    // Nativo: hay que dejar gas para el UserOp. ERC-20: hay que dejar sitio al
    // fee, que en el Caso 2 del contrato se cobra APARTE del importe enviado.
    const usable = isNative
      ? (balance > NATIVE_GAS_RESERVE ? balance - NATIVE_GAS_RESERVE : 0n)
      : maxTokenAmount(balance, feeNum)
    setAmount(formatUnits(usable, decimals))
  }

  const amountWei = (() => {
    try { return amount ? parseUnits(amount, decimals) : 0n } catch { return 0n }
  })()

  const { fee, recipientGets, walletPays } = previewSend(amountWei, feeNum, isNative)

  const toValid = isAddress(to)
  const amountValid = amountWei > 0n
  // El contrato revierte si el saldo no cubre importe + fee. Se corta antes.
  const overBalance = amountValid && balance !== undefined && walletPays > balance
  const isBusy = status === 'building' || status === 'signing' || status === 'sending'
  const canSubmit = toValid && amountValid && !overBalance && !!token && !isBusy

  const handleSend = async () => {
    if (!canSubmit) return
    setStatus('building')
    setErrorMsg('')

    try {
      if (!walletAddress) throw new Error(t('connect.errNoWallet'))
      if (!token) throw new Error(t('connect.errNoToken'))

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

      if (token.isNative) {
        // Caso 1 del contrato: value > 0 y sin calldata → el fee sale del importe.
        execTarget = to as Address
        execValue = amountWei
        execCallData = '0x'
      } else {
        // Caso 2: transfer(to, amount) sobre el contrato del token → fee aparte.
        if (!token.address) throw new Error(`${token.symbol} no disponible en esta red`)
        execTarget = token.address as Address
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
          {amount} {symbol} → {to.slice(0, 6)}...{to.slice(-4)}
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

      {/* Token selector — cualquier token con saldo en la red activa */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <label style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          {t('send.tokenPickerLabel')}
        </label>
        <button
          type="button"
          onClick={() => setPickerOpen(o => !o)}
          disabled={tokens.length === 0}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', boxSizing: 'border-box',
            backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '6px', cursor: tokens.length ? 'pointer' : 'not-allowed', textAlign: 'left',
          }}
        >
          {token ? (
            <>
              <TokenIcon token={token} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f0f4f8' }}>{token.symbol}</span>
              <span style={{ fontSize: '12px', color: '#8892a4', fontFamily: 'monospace', marginLeft: 'auto' }}>
                {fmtBal(token.balance, token.decimals)}
              </span>
              <span style={{ fontSize: '10px', color: '#4a5568' }}>{pickerOpen ? '▲' : '▼'}</span>
            </>
          ) : (
            <span style={{ fontSize: '13px', color: '#8892a4' }}>
              {tokensLoading ? t('send.loadingTokens') : t('send.noTokens')}
            </span>
          )}
        </button>

        {pickerOpen && tokens.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, marginTop: '4px',
            maxHeight: '260px', overflowY: 'auto',
            backgroundColor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {tokens.map(tk => (
              <button
                key={tk.key}
                onClick={() => { setTokenKey(tk.key); setAmount(''); setPickerOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', backgroundColor: tk.key === token?.key ? 'rgba(212,175,55,0.08)' : 'transparent',
                  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = tk.key === token?.key ? 'rgba(212,175,55,0.08)' : 'transparent')}
              >
                <TokenIcon token={tk} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f4f8' }}>{tk.symbol}</span>
                  <span style={{ fontSize: '11px', color: '#8892a4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.name}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#8892a4', fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0 }}>
                  {fmtBal(tk.balance, tk.decimals)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f0f4f8', marginBottom: '24px' }}>
        {t('common.send')} {symbol}
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
              {t('common.amount')} ({symbol})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8892a4', fontFamily: 'monospace' }}>
                {t('common.balance')}: {balance !== undefined ? fmtBal(balance, decimals) : '—'} {symbol}
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
            placeholder={decimals <= 6 ? '0.00' : '0.000'}
            min="0"
            step="any"
            style={{
              width: '100%', padding: '11px 14px', backgroundColor: '#0d1117', boxSizing: 'border-box',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px', color: '#f0f4f8', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Desglose del fee. Nativo: sale del importe. ERC-20: se suma encima. */}
        {amountValid && token && (
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8892a4' }}>
                {isNative ? t('send.willReceive') : t('send.recipientGets')}
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f0f4f8' }}>
                {fmtBal(recipientGets, decimals)} {symbol}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#4a5568' }}>
                {isNative ? t('send.feeBvcc', { rate: feeRate }) : t('send.feeExtra', { rate: feeRate })}
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#D4AF37' }}>
                {fmtBal(fee, decimals)} {symbol}
              </span>
            </div>
            {!isNative && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '12px', color: '#8892a4' }}>{t('send.totalDebited')}</span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f0f4f8' }}>
                  {fmtBal(walletPays, decimals)} {symbol}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Saldo insuficiente para importe + fee — el contrato revertiría */}
        {overBalance && balance !== undefined && (
          <div style={{ padding: '10px 14px', backgroundColor: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.25)', borderRadius: '6px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#fc8181' }}>
              {t('send.insufficientForFee', {
                token: symbol,
                amount: `${fmtBal(amountWei, decimals)} ${symbol}`,
                total: `${fmtBal(walletPays, decimals)} ${symbol}`,
                balance: `${fmtBal(balance, decimals)} ${symbol}`,
              })}
            </p>
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
            opacity: (toValid && amountValid && !overBalance) ? 1 : 0.45,
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
