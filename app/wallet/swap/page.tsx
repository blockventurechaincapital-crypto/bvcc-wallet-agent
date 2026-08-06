'use client'
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createPublicClient, http, encodeAbiParameters, encodeFunctionData,
  parseGwei, parseUnits, formatUnits, type Address, type Hex,
} from 'viem'
import { parseEthAmount } from '@/lib/send'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import type { NetworkConfig } from '@/lib/networks'
import { useTokenBalance } from '@/lib/useTokenBalance'
import { useWalletType } from '@/lib/useWalletType'
import { feeNumerator, feeRateLabel, FEE_DENOMINATOR } from '@/lib/fees'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

// Reserva de gas al pulsar MAX en ETH (el wallet paga el gas del UserOp)
const ETH_GAS_RESERVE = 300_000_000_000_000n // 0.0003 ETH

function fmtBal(wei: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(wei, decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals === 6 ? 2 : 6 })
}

// ── ABIs ────────────────────────────────────────────────────────────────────
const SWAP_ROUTER_ABI = [{
  type: 'function',
  name: 'exactInputSingle',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn',           type: 'address' },
    { name: 'tokenOut',          type: 'address' },
    { name: 'fee',               type: 'uint24'  },
    { name: 'recipient',         type: 'address' },
    { name: 'amountIn',          type: 'uint256' },
    { name: 'amountOutMinimum',  type: 'uint256' },
    { name: 'sqrtPriceLimitX96', type: 'uint160' },
  ]}],
  outputs: [{ name: 'amountOut', type: 'uint256' }],
  stateMutability: 'payable',
}] as const

const QUOTER_ABI = [{
  type: 'function',
  name: 'quoteExactInputSingle',
  inputs: [{ name: 'params', type: 'tuple', components: [
    { name: 'tokenIn',           type: 'address' },
    { name: 'tokenOut',          type: 'address' },
    { name: 'amountIn',          type: 'uint256' },
    { name: 'fee',               type: 'uint24'  },
    { name: 'sqrtPriceLimitX96', type: 'uint160' },
  ]}],
  outputs: [
    { name: 'amountOut',                  type: 'uint256' },
    { name: 'sqrtPriceX96After',          type: 'uint160' },
    { name: 'initializedTicksCrossed',    type: 'uint32'  },
    { name: 'gasEstimate',                type: 'uint256' },
  ],
  stateMutability: 'nonpayable',
}] as const

const ERC20_ABI = [{
  type: 'function',
  name: 'approve',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ type: 'bool' }],
  stateMutability: 'nonpayable',
}] as const

// ── Types ────────────────────────────────────────────────────────────────────
type SwapDirection = 'ETH_TO_USDC' | 'USDC_TO_WETH'
type SwapStatus = 'idle' | 'quoting' | 'building' | 'signing' | 'sending' | 'success' | 'error'

// Una red admite swap solo si: el wallet está desplegable allí (factory) Y
// tiene Uniswap + USDC configurados. Cada red usa SUS propias direcciones.
function isSwapCapable(n: NetworkConfig): boolean {
  return !!(n.contracts.factory && n.uniswap && n.tokens.usdc)
}

// ── Selector de red dentro del swap ───────────────────────────────────────────
function SwapNetworkPicker({ onChange }: { onChange?: () => void }) {
  const { network, networks, setNetworkByChainId } = useNetwork()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {t('swap.networkLabel')}
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '11px 14px', backgroundColor: '#0d1117', boxSizing: 'border-box',
          border: `1px solid ${open ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: '20px', height: '20px', borderRadius: '5px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: network.color + '22' }}>
          <img src={network.logo} alt={network.shortName} width={20} height={20}
            style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }}
            onError={(e) => { const el = e.currentTarget; el.style.display = 'none'; el.parentElement!.style.backgroundColor = network.color }} />
        </span>
        <span style={{ flex: 1, fontSize: '13px', color: '#f0f4f8' }}>{network.name}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.45, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', boxShadow: '0 8px 40px rgba(0,0,0,0.7)', zIndex: 200, padding: '6px',
        }}>
          {networks.map(n => {
            const capable = isSwapCapable(n)
            const isActive = n.chainId === network.chainId
            const reason = !n.uniswap || !n.tokens.usdc
              ? t('swap.swapNotConfigured').replace('{network}', n.shortName)
              : t('components.networkSoon')
            return (
              <button
                key={n.chainId}
                type="button"
                onClick={() => { if (capable && !isActive) { setNetworkByChainId(n.chainId); onChange?.() } setOpen(false) }}
                disabled={!capable}
                title={!capable ? reason : undefined}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '8px 10px', borderRadius: '8px', border: 'none',
                  background: isActive ? 'rgba(212,175,55,0.09)' : 'transparent',
                  cursor: capable ? 'pointer' : 'not-allowed', opacity: capable ? 1 : 0.4, textAlign: 'left',
                }}
              >
                <span style={{ width: '20px', height: '20px', borderRadius: '5px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: n.color + '22' }}>
                  <img src={n.logo} alt={n.name} width={20} height={20}
                    style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }}
                    onError={(e) => { const el = e.currentTarget; el.style.display = 'none'; el.parentElement!.style.backgroundColor = n.color }} />
                </span>
                <span style={{ flex: 1, fontSize: '12.5px', color: '#e2e2e2', lineHeight: 1.2 }}>{n.name}</span>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {!capable && (
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {!n.uniswap || !n.tokens.usdc ? '—' : t('components.networkSoon')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

function SwapPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address: walletAddress, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Network-specific addresses (undefined when uniswap not configured on this chain)
  const SWAP_ROUTER  = (network.uniswap?.swapRouter  ?? undefined) as `0x${string}` | undefined
  const WETH_ADDRESS = network.tokens.weth           as `0x${string}`
  const USDC_ADDRESS = (network.tokens.usdc          ?? undefined) as `0x${string}` | undefined
  const QUOTER_V2    = (network.uniswap?.quoterV2    ?? undefined) as `0x${string}` | undefined
  const POOL_FEE     = network.uniswap?.poolFee ?? 3000
  // Tiers candidatos para elegir el mejor pool (estándar Uniswap v3).
  // useMemo evita recrear el array en cada render (si no, fetchQuote se recrea
  // y el debounce re-cotiza en bucle → parpadeo del quote).
  const FEE_TIERS    = useMemo(
    () => network.uniswap?.feeTiers ?? [100, 500, 3000, 10000],
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const swapAvailable = !!(SWAP_ROUTER && USDC_ADDRESS && QUOTER_V2)

  // Símbolos y decimales dependientes de la red
  // (en BNB Chain el nativo es BNB y el USDC Binance-Peg usa 18 decimales)
  const nativeSym    = network.nativeToken.symbol
  const wrappedSym   = `W${nativeSym}`
  const usdcDecimals = network.tokens.usdcDecimals

  // Fee del protocolo BVCC. Un swap es Caso 3 en el contrato: el fee NO se cobra
  // sobre lo que envías, sino sobre el incremento de balance del token que
  // recibes (BVCCWallet.sol _collectFeesOnIncrease). Y depende del tipo de wallet.
  const { walletType } = useWalletType()
  const bvccFeeNum   = feeNumerator(walletType)
  const bvccFeeRate  = feeRateLabel(bvccFeeNum)

  const [direction, setDirection] = useState<SwapDirection>('ETH_TO_USDC')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<string | null>(null)
  const [bestFee, setBestFee] = useState<number | null>(null) // mejor fee tier de la última cotización
  const [slippage, setSlippage] = useState(0.5) // tolerancia de slippage en %
  const [quoteError, setQuoteError] = useState(false)
  const [status, setStatus] = useState<SwapStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('direction') === 'USDC_TO_WETH') setDirection('USDC_TO_WETH')
  }, [searchParams])

  // Al cambiar de red, limpiar el formulario (cambian router, tokens y precios)
  const resetForm = useCallback(() => {
    setAmount(''); setQuote(null); setQuoteError(false); setStatus('idle'); setErrorMsg(''); setTxHash(null)
  }, [])

  // ── Quote ────────────────────────────────────────────────────────────────
  // Cotiza en todos los fee tiers y se queda con el que da más salida (mejor pool).
  const fetchQuote = useCallback(async (dir: SwapDirection, raw: string) => {
    if (!raw || parseFloat(raw) <= 0) { setQuote(null); setBestFee(null); return }
    if (!QUOTER_V2 || !USDC_ADDRESS || !SWAP_ROUTER) { setQuoteError(true); return }
    setStatus('quoting')
    setQuoteError(false)
    // Safe to use non-null after guard (TypeScript can't narrow across closures)
    const _quoter = QUOTER_V2 as `0x${string}`
    const _usdc   = USDC_ADDRESS as `0x${string}`
    try {
      let amountIn: bigint
      let tokenIn: `0x${string}`
      let tokenOut: `0x${string}`
      let outDecimals: number

      if (dir === 'ETH_TO_USDC') {
        amountIn = parseEthAmount(raw)
        tokenIn = WETH_ADDRESS
        tokenOut = _usdc
        outDecimals = usdcDecimals
      } else {
        amountIn = parseUnits(raw, usdcDecimals)
        tokenIn = _usdc
        tokenOut = WETH_ADDRESS
        outDecimals = 18
      }

      // Cotizar todos los tiers en paralelo; los pools inexistentes/sin liquidez revierten.
      const quotes = await Promise.allSettled(
        FEE_TIERS.map(fee =>
          publicClient.simulateContract({
            address: _quoter,
            abi: QUOTER_ABI,
            functionName: 'quoteExactInputSingle',
            args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
          }).then(r => ({ fee, amountOut: r.result[0] as bigint }))
        )
      )

      let best: { fee: number; amountOut: bigint } | null = null
      for (const q of quotes) {
        if (q.status === 'fulfilled' && (best === null || q.value.amountOut > best.amountOut)) {
          best = q.value
        }
      }

      if (!best || best.amountOut === 0n) {
        setQuote(null); setBestFee(null); setQuoteError(true); return
      }
      setBestFee(best.fee)
      setQuote(parseFloat(formatUnits(best.amountOut, outDecimals)).toFixed(dir === 'ETH_TO_USDC' ? 4 : 6))
    } catch {
      setQuote(null)
      setBestFee(null)
      setQuoteError(true)
    } finally {
      setStatus(s => (s === 'quoting' ? 'idle' : s))
    }
  }, [publicClient, QUOTER_V2, USDC_ADDRESS, SWAP_ROUTER, WETH_ADDRESS, usdcDecimals, FEE_TIERS]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce quote fetch
  useEffect(() => {
    const tk = setTimeout(() => fetchQuote(direction, amount), 600)
    return () => clearTimeout(tk)
  }, [amount, direction, fetchQuote])

  // Re-cotizar cada 10s para mantener el precio fresco (sin pisar un swap en curso)
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) return
    const id = setInterval(() => {
      const s = statusRef.current
      if (s === 'building' || s === 'signing' || s === 'sending' || s === 'success') return
      fetchQuote(direction, amount)
    }, 10_000)
    return () => clearInterval(id)
  }, [amount, direction, fetchQuote])

  const fromIsNative = direction === 'ETH_TO_USDC'
  const fromDecimals = fromIsNative ? 18 : usdcDecimals
  const { data: balance } = useTokenBalance(
    walletAddress ?? null,
    network,
    fromIsNative ? { isNative: true } : { isNative: false, address: USDC_ADDRESS ?? null },
  )

  const setMax = () => {
    if (balance === undefined) return
    if (fromIsNative) {
      const usable = balance > ETH_GAS_RESERVE ? balance - ETH_GAS_RESERVE : 0n
      setAmount(formatUnits(usable, 18))
    } else {
      setAmount(formatUnits(balance, usdcDecimals))
    }
  }

  const amountIn = direction === 'ETH_TO_USDC'
    ? parseEthAmount(amount)
    : (() => { try { return amount ? parseUnits(amount, usdcDecimals) : 0n } catch { return 0n } })()

  const amountValid = amountIn > 0n
  const isBusy = ['building', 'signing', 'sending'].includes(status)
  const canSubmit = amountValid && !isBusy && !quoteError

  // ── Send UserOp ──────────────────────────────────────────────────────────
  const handleSwap = async () => {
    if (!canSubmit) return
    setStatus('building')
    setErrorMsg('')

    try {
      if (!walletAddress) throw new Error(t('connect.errNoWallet'))
      if (!swapAvailable) throw new Error(t('connect.errSwapUnavailable'))
      const _router = SWAP_ROUTER as `0x${string}`
      const _usdc2  = USDC_ADDRESS as `0x${string}`

      // ── 1. Nonce ──────────────────────────────────────────────────────────
      const nonce = await publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'getNonce',
        args: [],
      })

      // ── 2. Elegir el mejor fee tier para este importe (pool con liquidez) ──
      const _quoter   = QUOTER_V2 as `0x${string}`
      const tokenInQ  = direction === 'ETH_TO_USDC' ? WETH_ADDRESS : _usdc2
      const tokenOutQ = direction === 'ETH_TO_USDC' ? _usdc2 : WETH_ADDRESS
      let swapFee = bestFee ?? POOL_FEE
      let amountOutMinimum = 0n
      {
        const qs = await Promise.allSettled(
          FEE_TIERS.map(fee =>
            publicClient.simulateContract({
              address: _quoter, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle',
              args: [{ tokenIn: tokenInQ, tokenOut: tokenOutQ, amountIn, fee, sqrtPriceLimitX96: 0n }],
            }).then(r => ({ fee, amountOut: r.result[0] as bigint }))
          )
        )
        let b: { fee: number; amountOut: bigint } | null = null
        for (const q of qs) {
          if (q.status === 'fulfilled' && (b === null || q.value.amountOut > b.amountOut)) b = q.value
        }
        if (!b || b.amountOut === 0n) throw new Error(t('connect.errNoPool'))
        swapFee = b.fee
        // amountOutMinimum = salida cotizada − slippage (protección de precio)
        const slippageBps = BigInt(Math.round(slippage * 100)) // 0.5% → 50 bps
        amountOutMinimum = (b.amountOut * (10_000n - slippageBps)) / 10_000n
      }

      // ── 3. Build executions ───────────────────────────────────────────────
      const swapCallData = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn:           direction === 'ETH_TO_USDC' ? WETH_ADDRESS : _usdc2,
          tokenOut:          direction === 'ETH_TO_USDC' ? _usdc2 : WETH_ADDRESS,
          fee:               swapFee,
          recipient:         walletAddress as Address,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        }],
      })

      type Execution = { target: Address; value: bigint; callData: Hex }
      let executions: Execution[]

      if (direction === 'ETH_TO_USDC') {
        // Single call: send ETH to router
        executions = [{ target: _router, value: amountIn, callData: swapCallData }]
      } else {
        // Batch: approve USDC → router, then swap
        const approveCallData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [_router, amountIn],
        })
        executions = [
          { target: _usdc2,  value: 0n, callData: approveCallData },
          { target: _router, value: 0n, callData: swapCallData    },
        ]
      }

      const executionData = encodeAbiParameters(
        [{ type: 'tuple[]', components: [
          { name: 'target',   type: 'address' },
          { name: 'value',    type: 'uint256' },
          { name: 'callData', type: 'bytes'   },
        ]}],
        [executions]
      )
      const callData = encodeFunctionData({
        abi: BVCC_WALLET_ABI,
        functionName: 'execute',
        args: [BATCH_MODE, executionData],
      })

      // ── 3. Gas ────────────────────────────────────────────────────────────
      const feeData = await publicClient.estimateFeesPerGas()
      const maxFeePerGas         = feeData.maxFeePerGas         ?? parseGwei('2')
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')

      // ── 4. UserOp ─────────────────────────────────────────────────────────
      const userOp = {
        sender:            walletAddress as Address,
        nonce,
        initCode:          '0x' as Hex,
        callData,
        accountGasLimits:  packBytes32(600_000n, 1_200_000n), // verificationGas | callGas
        preVerificationGas: 80_000n,
        gasFees:           packBytes32(maxPriorityFeePerGas, maxFeePerGas),
        paymasterAndData:  '0x' as Hex,
        signature:         '0x' as Hex,
      }

      // ── 5. userOpHash ─────────────────────────────────────────────────────
      const userOpHash = await publicClient.readContract({
        address: ENTRYPOINT_ADDRESS,
        abi: ENTRYPOINT_ABI,
        functionName: 'getUserOpHash',
        args: [userOp],
      }) as Hex

      // ── 6. Face ID ────────────────────────────────────────────────────────
      setStatus('signing')
      const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
        await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))

      // ── 7. Signature ──────────────────────────────────────────────────────
      const clientDataStr   = new TextDecoder().decode(hexToBytes(clientDataHex))
      const challengeIndex  = BigInt(clientDataStr.indexOf('"challenge":'))
      const typeIndex       = BigInt(clientDataStr.indexOf('"type":'))

      const signature = encodeAbiParameters(
        [
          { name: 'r',               type: 'bytes32' },
          { name: 's',               type: 'bytes32' },
          { name: 'challengeIndex',  type: 'uint256' },
          { name: 'typeIndex',       type: 'uint256' },
          { name: 'authenticatorData', type: 'bytes' },
          { name: 'clientDataJSON',  type: 'string'  },
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

      // ── 8. Bundler (o fallback wallet conectada) ──────────────────────────
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

  const fromLabel  = direction === 'ETH_TO_USDC' ? nativeSym : 'USDC'
  const toLabel    = direction === 'ETH_TO_USDC' ? 'USDC' : wrappedSym
  const placeholder = direction === 'ETH_TO_USDC' ? '0.000' : '0.00'

  const btnLabel = () => {
    if (status === 'quoting')  return t('swap.statusQuoting')
    if (status === 'building') return t('swap.statusBuilding')
    if (status === 'signing')  return t('swap.statusSigning')
    if (status === 'sending')  return t('swap.statusSending')
    return `${t('common.swap')} ${fromLabel} → ${toLabel}`
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#06080f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(212,175,55,0.15)', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '24px' }}>
          ✓
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f0f4f8', marginBottom: '8px' }}>{t('swap.successTitle')}</h2>
        <p style={{ fontSize: '13px', color: '#8892a4', marginBottom: '8px', textAlign: 'center' }}>
          {amount} {fromLabel} → {toLabel}
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

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#06080f', padding: '24px 16px', maxWidth: '400px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ fontSize: '13px', color: '#8892a4', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', padding: 0 }}>
        {t('swap.backBtn')}
      </button>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#f0f4f8', marginBottom: '24px' }}>{t('swap.title')}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Network picker */}
        <SwapNetworkPicker onChange={resetForm} />

        {/* Direction toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {([['ETH_TO_USDC', `${nativeSym} → USDC`], ['USDC_TO_WETH', `USDC → ${wrappedSym}`]] as [SwapDirection, string][]).map(([d, label]) => (
            <button
              key={d}
              onClick={() => { setDirection(d); setAmount(''); setQuote(null); setBestFee(null); setQuoteError(false) }}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                border: direction === d ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                backgroundColor: direction === d ? 'rgba(212,175,55,0.1)' : 'transparent',
                color: direction === d ? '#D4AF37' : '#8892a4',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('common.amount')} ({fromLabel})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#8892a4', fontFamily: 'monospace' }}>
                {t('common.balance')}: {balance !== undefined ? fmtBal(balance, fromDecimals) : '—'} {fromLabel}
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
            placeholder={placeholder}
            min="0"
            step="any"
            style={{
              width: '100%', padding: '11px 14px', backgroundColor: '#0d1117', boxSizing: 'border-box',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px', color: '#f0f4f8', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Slippage */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {t('swap.slippageLabel')}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[0.1, 0.5, 1].map(p => {
              const active = slippage === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSlippage(p)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    border: active ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: active ? 'rgba(212,175,55,0.1)' : 'transparent',
                    color: active ? '#D4AF37' : '#8892a4',
                  }}
                >
                  {p}%
                </button>
              )
            })}
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="number"
                value={[0.1, 0.5, 1].includes(slippage) ? '' : slippage}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  if (isNaN(v)) { setSlippage(0.5); return }
                  setSlippage(Math.min(50, Math.max(0, v)))
                }}
                placeholder={t('swap.slippageCustom')}
                min="0" max="50" step="0.1"
                style={{
                  width: '100%', padding: '8px 22px 8px 10px', backgroundColor: '#0d1117', boxSizing: 'border-box',
                  border: `1px solid ${[0.1, 0.5, 1].includes(slippage) ? 'rgba(255,255,255,0.1)' : '#D4AF37'}`,
                  borderRadius: '6px', color: '#f0f4f8', fontSize: '12px', outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#4a5568' }}>%</span>
            </div>
          </div>
          {slippage >= 5 && (
            <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#fc8181' }}>{t('swap.slippageHigh')}</p>
          )}
        </div>

        {/* Quote result */}
        {amountValid && (
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(212,175,55,0.06)', border: `1px solid ${quoteError ? 'rgba(252,129,129,0.25)' : 'rgba(212,175,55,0.15)'}`, borderRadius: '6px' }}>
            {quoteError ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#fc8181' }}>
                {t('swap.noPoolAvailable').replace('{network}', network.shortName)}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#8892a4' }}>{t('swap.youWillReceive')}</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#f0f4f8' }}>
                    {status === 'quoting' ? '...' : (quote ? `${quote} ${toLabel}` : '—')}
                  </span>
                </div>
                {quote && status !== 'quoting' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#4a5568' }}>{t('swap.minReceived').replace('{slippage}', String(slippage))}</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8892a4' }}>
                      {(parseFloat(quote) * (1 - slippage / 100)).toFixed(direction === 'ETH_TO_USDC' ? 4 : 6)} {toLabel}
                    </span>
                  </div>
                )}
                {quote && status !== 'quoting' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#4a5568' }}>
                      {t('swap.feeBvcc', { rate: bvccFeeRate })}
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#D4AF37' }}>
                      {(parseFloat(quote) * Number(bvccFeeNum) / Number(FEE_DENOMINATOR))
                        .toFixed(direction === 'ETH_TO_USDC' ? 6 : 8)} {toLabel}
                    </span>
                  </div>
                )}
                {direction === 'USDC_TO_WETH' && (
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#4a5568' }}>
                    {t('swap.wrappedEthNote').replace('{wrapped}', wrappedSym).replace('{native}', nativeSym)}
                  </p>
                )}
              </>
            )}
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
          onClick={handleSwap}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: isBusy ? 'rgba(212,175,55,0.6)' : '#D4AF37',
            border: 'none', borderRadius: '6px', color: '#000',
            fontSize: '14px', fontWeight: '600',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: amountValid && !quoteError ? 1 : 0.45,
          }}
        >
          {btnLabel()}
        </button>

        <p style={{ margin: 0, fontSize: '11px', color: '#4a5568', textAlign: 'center' }}>
          Uniswap v3 · {t('swap.poolFeeAuto').replace('{fee}', String((bestFee ?? POOL_FEE) / 10000))} · {network.shortName}
        </p>

        {/* Legal: BVCC no ejecuta el swap, lo hace Uniswap */}
        <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
          <p style={{ margin: 0, fontSize: '10.5px', lineHeight: 1.5, color: '#4a5568', textAlign: 'center' }}>
            {t('swap.poweredByUniswap')}{' '}
            <a href="/legal/swap-fast" target="_blank" rel="noopener noreferrer" style={{ color: '#8892a4', textDecoration: 'underline' }}>
              {t('swap.swapLegalLink')}
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function SwapPage() {
  return (
    <Suspense>
      <SwapPageInner />
    </Suspense>
  )
}
