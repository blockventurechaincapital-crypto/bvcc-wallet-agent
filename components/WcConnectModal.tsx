'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  createPublicClient, http, encodeAbiParameters, encodeFunctionData, parseGwei,
  parseUnits, formatUnits, hashTypedData, hashMessage, type Address, type Hex,
} from 'viem'
import {
  classifyCall, buildKnownSet, getAtomicBatchEnabled, getMaxGas, newBatchId, recordBatch,
  getApproveInfo, encodeApproveAmount, MAX_UINT256,
  type WcCall, type CallRisk, type RiskLevel,
} from '@/lib/wcCalls'
import { hashMessage as hashMessage7739, wrapTypedDataSignature } from 'viem/experimental/erc7739'
import { erc7739TypedDataDigest } from '@/lib/erc7739'
import type { PendingRequestTypes } from '@walletconnect/types'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { useNetwork } from '@/lib/NetworkContext'
import { getNetwork } from '@/lib/networks'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

const ERC1271_ABI = [{
  name: 'isValidSignature',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'hash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }],
  outputs: [{ name: '', type: 'bytes4' }],
}] as const
const ERC1271_MAGIC = '0x1626ba7e'

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

interface WcConnectModalProps {
  request: PendingRequestTypes.Struct
  onApprove: (result: string) => void
  onReject: () => void
  walletAddress: string
  credentialId: string | null
}

function truncateHex(hex: string, maxLen = 32): string {
  if (!hex || hex.length <= maxLen) return hex
  return hex.slice(0, maxLen) + '…'
}

// Color por nivel de riesgo de una call.
const RISK_COLOR: Record<RiskLevel, string> = {
  safe: '#48bb78',     // verde
  caution: '#D4AF37',  // ámbar
  danger: '#fc8181',   // rojo
}
const RISK_DOT: Record<RiskLevel, string> = { safe: '🟢', caution: '🟡', danger: '🔴' }

// Parámetros de gas de un userOp (editables en el panel Avanzado).
type GasParams = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; callGasLimit: bigint }
const VERIF_GAS = 400_000n     // verificationGasLimit (firma WebAuthn) — fijo
const PREVERIF_GAS = 80_000n   // preVerificationGas — fijo
const fmtGwei = (wei: bigint) => (Number(wei) / 1e9).toString()

// Address completa, clickable, que abre el explorer en pestaña nueva.
function ExplorerAddress({ addr, explorerBase }: { addr: string; explorerBase?: string }) {
  const style: React.CSSProperties = { color: '#7c93b5', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }
  if (!explorerBase || !addr) return <span style={style}>{addr || '—'}</span>
  return (
    <a href={`${explorerBase}/address/${addr}`} target="_blank" rel="noopener noreferrer"
      title="Ver en el explorador" style={{ ...style, textDecoration: 'underline', textDecorationColor: 'rgba(124,147,181,0.4)', cursor: 'pointer' }}>
      {addr} ↗
    </a>
  )
}

// Una fila de call con su badge de riesgo (usada en tx única y en batch).
function CallRow({ index, risk, explorerBase }: { index?: number; risk: CallRisk; explorerBase?: string }) {
  return (
    <div style={{ borderTop: index && index > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined, paddingTop: index ? '8px' : 0, marginTop: index ? '8px' : 0 }}>
      {risk.summary && (
        <div style={{ color: '#e8edf4', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
          {RISK_DOT[risk.level]} {risk.summary}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#4a5568', minWidth: 0 }}>
          {index !== undefined ? `#${index + 1} ` : ''}→ <ExplorerAddress addr={risk.target} explorerBase={explorerBase} />{' '}
          <span style={{ color: risk.targetKnown ? '#48bb78' : '#fc8181', fontSize: '10px' }}>
            ({risk.targetKnown ? 'conocido' : 'desconocido'})
          </span>
        </span>
        <span style={{ color: RISK_COLOR[risk.level] }}>{risk.summary ? '' : RISK_DOT[risk.level] + ' '}{risk.fn}</span>
      </div>
      {risk.warn && (
        <div style={{ marginTop: '4px', color: RISK_COLOR[risk.level], fontSize: '10px' }}>⚠️ {risk.warn}</div>
      )}
    </div>
  )
}

// Campo editable del panel de gas (estilo MetaMask avanzado).
function GasInput({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#8892a4' }}>
      <span>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        style={{
          width: '120px', padding: '5px 8px', backgroundColor: '#06080f',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px',
          color: '#f0f4f8', fontSize: '12px', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'right',
        }}
      />
    </label>
  )
}

// Traduce reverts/errores crudos a algo legible para el usuario.
function friendlyError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('insufficient balance for fee') || m.includes('tokenfeefailed'))
    return 'Saldo insuficiente para cubrir el fee de la wallet (0.05% / 0.15%).'
  if (m.includes('prefund') || m.includes('aa21') || m.includes("didn't pay"))
    return 'La wallet no tiene suficiente ETH para pagar el gas de esta operación.'
  if (m.includes('aa23') || m.includes('aa40') || m.includes('out of gas') || m.includes('overflow'))
    return 'La operación necesitó más gas del estimado. Reinténtala.'
  if (m.includes('isvalidsignature') || m.includes('1626ba7e'))
    return raw // ya es específico (firma ERC-1271/7739)
  if (m.includes('user rejected') || m.includes('cancel') || m.includes('canceló') || m.includes('notallowed'))
    return 'Operación cancelada.'
  if (m.includes('unrecognized chain') || m.includes('4902'))
    return 'La dApp pidió una red que esta wallet no soporta.'
  return raw
}

function formatValue(value: string | undefined): string {
  if (!value) return '0'
  try {
    const wei = BigInt(value)
    const eth = Number(wei) / 1e18
    return eth.toFixed(6) + ' ETH'
  } catch {
    return value
  }
}

export default function WcConnectModal({
  request,
  onApprove,
  onReject,
  walletAddress,
  credentialId,
}: WcConnectModalProps) {
  const { network: currentNetwork } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  // Firma secuencial (modo una-a-una de wallet_sendCalls)
  const [seqIndex, setSeqIndex] = useState(0)
  const [ack, setAck] = useState(false) // checkbox de "asumo el riesgo" ante calls peligrosas
  const seqHashes = useRef<Hex[]>([])
  const atomicMode = useMemo(() => getAtomicBatchEnabled(), [])
  // Editor de gas (panel Avanzado, estilo MetaMask)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [gasEdited, setGasEdited] = useState(false)
  const [gasMaxFee, setGasMaxFee] = useState('')   // gwei
  const [gasPriority, setGasPriority] = useState('') // gwei
  const [gasLimit, setGasLimit] = useState('')      // unidades
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null)

  // La petición trae su propio chainId ('eip155:42161') — la sesión es multi-red,
  // así que NO asumimos la red activa del wallet: usamos la que pide la dApp.
  const network = useMemo(() => {
    const c = request.params.chainId
    const id = c?.startsWith('eip155:') ? parseInt(c.slice(7), 10) : NaN
    if (Number.isFinite(id)) {
      try { return getNetwork(id) } catch { /* red no soportada → red actual */ }
    }
    return currentNetwork
  }, [request.params.chainId, currentNetwork])

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const { method, params } = request.params.request
  const origin =
    (request as any).verifyContext?.verified?.origin ||
    request.params.chainId ||
    'dApp desconocida'

  const isTypedData = method === 'eth_signTypedData_v4' || method === 'eth_signTypedData'
  const txData = method === 'eth_sendTransaction' ? params[0] : null
  const signMessage = method === 'personal_sign' ? params[0] : null
  const typedData = isTypedData ? params[1] : null
  const sendCalls = method === 'wallet_sendCalls' ? (params[0] as { calls?: WcCall[] }) : null

  // ── Clasificación de riesgo de las llamadas ────────────────────────────────
  const known = useMemo(() => buildKnownSet(walletAddress), [walletAddress])
  const allCalls: WcCall[] = useMemo(() => {
    if (method === 'wallet_sendCalls') return sendCalls?.calls ?? []
    if (method === 'eth_sendTransaction' && txData) return [txData as WcCall]
    return []
  }, [method, sendCalls, txData])

  // Edición del límite de approve (estilo MetaMask): override del monto por índice
  // de call. `effectiveCalls` re-codifica la calldata con el nuevo monto antes de
  // clasificar/estimar/firmar. `approveInput` guarda el texto del editor por índice.
  const [approveOverrides, setApproveOverrides] = useState<Record<number, bigint>>({})
  const [approveInput, setApproveInput] = useState<Record<number, string>>({})
  const effectiveCalls: WcCall[] = useMemo(() => allCalls.map((c, i) => {
    const ov = approveOverrides[i]
    if (ov === undefined) return c
    try { return { ...c, data: encodeApproveAmount(c, ov) } } catch { return c }
  }), [allCalls, approveOverrides])

  const risks = useMemo(() => effectiveCalls.map((c) => classifyCall(c, known)), [effectiveCalls, known])

  // ¿Hay que marcar el checkbox de riesgo? En secuencial, según la call actual;
  // en atómico / tx única, si cualquiera es peligrosa.
  const seqMode = method === 'wallet_sendCalls' && !atomicMode
  const needsAck = seqMode
    ? risks[seqIndex]?.level === 'danger'
    : risks.some((r) => r.level === 'danger')

  const isTxMethod = method === 'eth_sendTransaction' || method === 'wallet_sendCalls'
  // Calls que cuentan para el gas sugerido (en secuencial, solo la call actual).
  const gasCalls = useMemo(
    () => (seqMode ? (effectiveCalls[seqIndex] ? [effectiveCalls[seqIndex]] : []) : effectiveCalls),
    [seqMode, effectiveCalls, seqIndex],
  )

  // Prerrellenar el editor de gas con la estimación + leer saldo del wallet.
  // No sobrescribe si el usuario ya editó a mano (gasEdited).
  useEffect(() => {
    if (!isTxMethod || gasCalls.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const bal = await publicClient.getBalance({ address: walletAddress as Address })
        if (!cancelled) setWalletBalance(bal)
      } catch { /* ignora */ }
      if (gasEdited) return
      try {
        const g = await suggestGasParams(toExec(gasCalls))
        if (!cancelled && !gasEdited) {
          setGasMaxFee(fmtGwei(g.maxFeePerGas))
          setGasPriority(fmtGwei(g.maxPriorityFeePerGas))
          setGasLimit(g.callGasLimit.toString())
        }
      } catch { /* ignora */ }
    })()
    return () => { cancelled = true }
  }, [gasCalls, isTxMethod]) // eslint-disable-line react-hooks/exhaustive-deps

  // Firma WebAuthn (Face ID) sobre un digest, codificada en el formato que
  // espera SignerWebAuthn (mismo tuple que la firma de UserOps).
  async function signDigestWithWebAuthn(digest: Hex): Promise<Hex> {
    const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
      await authenticateWebAuthn(credentialId, hexToBytes(digest))
    const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataHex))
    return encodeAbiParameters(
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
        BigInt(clientDataStr.indexOf('"challenge":')),
        BigInt(clientDataStr.indexOf('"type":')),
        authenticatorData,
        clientDataStr,
      ]
    )
  }

  // Domain EIP-712 del wallet (verifier) — leído on-chain, requerido por ERC-7739
  async function getVerifierDomain() {
    const { domain } = await publicClient.getEip712Domain({ address: walletAddress as Address })
    return {
      name: domain.name,
      version: domain.version,
      chainId: Number(domain.chainId),
      verifyingContract: domain.verifyingContract,
      salt: domain.salt,
    }
  }

  // Guard de runtime: antes de responder a la dApp, validar la firma contra el
  // propio wallet (ERC-1271). Si no valida on-chain, no la entregamos.
  async function assertValidOnChain(appHash: Hex, signature: Hex) {
    const magic = await publicClient.readContract({
      address: walletAddress as Address,
      abi: ERC1271_ABI,
      functionName: 'isValidSignature',
      args: [appHash, signature],
    })
    if (magic !== ERC1271_MAGIC) {
      throw new Error('La firma no valida on-chain (isValidSignature != 0x1626ba7e)')
    }
  }

  // calls → tuple[] de ejecución ERC-7821
  function toExec(calls: WcCall[]) {
    return calls.map((c) => ({
      target: ((c.to ?? c.target) ?? walletAddress) as Address,
      value: c.value ? BigInt(c.value) : 0n,
      callData: (c.data && c.data !== '0x') ? c.data as Hex : '0x' as Hex,
    }))
  }

  // Estima precio de gas + callGasLimit. callGasLimit = suma de estimaciones por
  // call (x2 margen por el fee snapshot); si alguna falla (approve+acción en
  // batch) → fallback generoso por nº de calls. Floor 500k, cap 8M.
  async function suggestGasParams(exec: ReturnType<typeof toExec>): Promise<GasParams> {
    const feeData = await publicClient.estimateFeesPerGas()
    const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('2')
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')
    let callGasLimit = 0n
    let estimated = true
    for (const c of exec) {
      try {
        callGasLimit += await publicClient.estimateGas({
          account: walletAddress as Address, to: c.target, value: c.value, data: c.callData,
        })
      } catch { estimated = false; break }
    }
    callGasLimit = estimated ? callGasLimit * 2n + 150_000n : 1_500_000n * BigInt(exec.length)
    const cap = getMaxGas(network.chainId)               // por red (L1 3M / L2 8M) o override del usuario
    if (callGasLimit < 500_000n) callGasLimit = 500_000n
    if (callGasLimit > cap) callGasLimit = cap >= 500_000n ? cap : 500_000n
    return { maxFeePerGas, maxPriorityFeePerGas, callGasLimit }
  }

  // Construye UN userOp con N llamadas (ERC-7821 batch), lo firma con Face ID y lo
  // envía. Sirve tanto para eth_sendTransaction (1 call) como para wallet_sendCalls.
  // `override` = valores de gas editados a mano por el usuario (panel Avanzado).
  async function buildAndSubmitBatch(calls: WcCall[], override?: GasParams): Promise<string> {
    if (!calls.length) throw new Error('No hay llamadas que ejecutar')

    const exec = toExec(calls)
    const executionData = encodeAbiParameters(
      [{ type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'callData', type: 'bytes' },
      ]}],
      [exec]
    )
    const callData = encodeFunctionData({
      abi: BVCC_WALLET_ABI,
      functionName: 'execute',
      args: [BATCH_MODE, executionData],
    })

    setLoadingMsg(t('connect.fetchingNonce'))
    const nonce = await publicClient.readContract({
      address: walletAddress as Address,
      abi: BVCC_WALLET_ABI,
      functionName: 'getNonce',
      args: [],
    })

    // Gas: el override manual del usuario tiene prioridad sobre la estimación.
    const { maxFeePerGas, maxPriorityFeePerGas, callGasLimit } = override ?? await suggestGasParams(exec)

    const userOp = {
      sender: walletAddress as Address,
      nonce,
      initCode: '0x' as Hex,
      callData,
      accountGasLimits: packBytes32(VERIF_GAS, callGasLimit),
      preVerificationGas: PREVERIF_GAS,
      gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
      paymasterAndData: '0x' as Hex,
      signature: '0x' as Hex,
    }

    // ── 6. userOpHash → Face ID → firma WebAuthn ────────────────────────────
    setLoadingMsg(t('connect.computingHash'))
    const userOpHash = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS,
      abi: ENTRYPOINT_ABI,
      functionName: 'getUserOpHash',
      args: [userOp],
    }) as Hex

    setLoadingMsg(t('connect.waitingFaceId'))
    const signature = await signDigestWithWebAuthn(userOpHash)

    // ── 7. Enviar (bundler o fallback wallet conectada) ─────────────────────
    setLoadingMsg(t('connect.sendingTx'))
    const { txHash } = await submitUserOp({
      chainId: network.chainId,
      userOp: {
        ...userOp,
        nonce: (nonce as bigint).toString(),
        preVerificationGas: userOp.preVerificationGas.toString(),
        signature,
      },
    })
    return txHash
  }

  // Override de gas si el usuario editó el panel Avanzado (lanza si es inválido).
  function gasOverrideFromFields(): GasParams | undefined {
    if (!gasEdited) return undefined
    let override: GasParams
    try {
      override = {
        maxFeePerGas: parseGwei(gasMaxFee),
        maxPriorityFeePerGas: parseGwei(gasPriority || '0'),
        callGasLimit: BigInt(gasLimit),
      }
    } catch { throw new Error('Valores de gas inválidos.') }
    if (override.callGasLimit < 21_000n) throw new Error('El gas limit es demasiado bajo.')
    if (override.maxFeePerGas <= 0n) throw new Error('El max fee debe ser mayor que 0.')
    return override
  }

  async function handleApprove() {
    setLoading(true)
    setErrorMsg('')
    try {
      const gasOverride = gasOverrideFromFields()

      if (method === 'eth_sendTransaction') {
        const txHash = await buildAndSubmitBatch([effectiveCalls[0]], gasOverride)
        onApprove(txHash)

      } else if (method === 'wallet_sendCalls') {
        const calls = effectiveCalls
        if (!calls.length) throw new Error('wallet_sendCalls sin llamadas')

        if (atomicMode) {
          // ── Modo ATÓMICO (opt-in): todas las calls en un userOp, una Face ID ──
          const txHash = await buildAndSubmitBatch(calls, gasOverride)
          const id = newBatchId()
          recordBatch(id, network.chainId, [txHash as Hex])
          onApprove(id)
        } else {
          // ── Modo SECUENCIAL (por defecto): firma la call actual, espera a que
          //    mine, avanza. Paramos en fallo. Cada call es su propia Face ID. ──
          const txHash = await buildAndSubmitBatch([calls[seqIndex]], gasOverride) as Hex
          setLoadingMsg(t('connect.sendingTx'))
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
          seqHashes.current = [...seqHashes.current, txHash]

          if (receipt.status === 'reverted') {
            throw new Error('La llamada revirtió on-chain. El lote se detuvo aquí.')
          }
          if (seqIndex + 1 >= calls.length) {
            const id = newBatchId()
            recordBatch(id, network.chainId, seqHashes.current)
            onApprove(id)
          } else {
            // Quedan calls: avanzar y dejar el modal abierto para la siguiente firma.
            // Reset de ack y gas para que la siguiente call se evalúe/estime de cero.
            setSeqIndex(seqIndex + 1)
            setAck(false)
            setGasEdited(false)
          }
        }

      } else if (method === 'personal_sign') {
        // ERC-7739 PersonalSign anidado: digest = typed data del domain del wallet
        // sobre PersonalSign(bytes prefixed). Firmado con Face ID. El verificador
        // (dApp/contrato) valida vía ERC-1271 isValidSignature.
        const msgHex = signMessage as Hex
        setLoadingMsg(t('connect.computingHash'))
        const verifierDomain = await getVerifierDomain()
        const digest = hashMessage7739({ message: { raw: msgHex }, verifierDomain })

        setLoadingMsg(t('connect.waitingFaceId'))
        const sig = await signDigestWithWebAuthn(digest)

        await assertValidOnChain(hashMessage({ raw: msgHex }), sig)
        onApprove(sig)

      } else if (isTypedData) {
        // ERC-7739 TypedDataSign anidado (p.ej. Permit2 de Uniswap): se firma el
        // digest anidado con Face ID y se envuelve la firma con el domain de la
        // dApp + contentsHash + descriptor, formato que decodifica el ERC7739 de OZ.
        const td = typeof typedData === 'string' ? JSON.parse(typedData) : typedData
        const { types, primaryType, message } = td
        // Normalizar el domain: viem (wrapTypedDataSignature / hashTypedData /
        // hashAppDomain) solo incluye chainId en el EIP712Domain si es number|bigint.
        // Algunos payloads WC lo mandan como string ("42161" / "0xa4b1") → quedaría
        // EXCLUIDO del appSeparator y la firma no validaría (ni para el wallet ni para
        // Permit2). Lo coercemos a number para que se incluya de forma consistente.
        const domain = { ...(td.domain ?? {}) }
        if (domain.chainId !== undefined && typeof domain.chainId !== 'bigint') {
          domain.chainId = Number(domain.chainId)
        }

        setLoadingMsg(t('connect.computingHash'))
        const verifierDomain = await getVerifierDomain()
        const digest = erc7739TypedDataDigest({ domain, types, primaryType, message, verifierDomain })

        setLoadingMsg(t('connect.waitingFaceId'))
        const webauthnSig = await signDigestWithWebAuthn(digest)
        const wrapped = wrapTypedDataSignature({ domain, types, primaryType, message, signature: webauthnSig })

        await assertValidOnChain(hashTypedData({ domain, types, primaryType, message }), wrapped)
        onApprove(wrapped)

      } else {
        throw new Error(`Método no soportado: ${method}`)
      }
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  // Editor del límite de un approve (estilo MetaMask). Solo se muestra si la call
  // de índice `i` es un approve. Re-codifica la calldata vía approveOverrides.
  function approveEditor(i: number) {
    const info = getApproveInfo(allCalls[i])
    if (!info) return null
    const ov = approveOverrides[i]
    const effective = ov ?? info.amount
    const effectiveLabel = effective >= (1n << 128n)
      ? 'Ilimitado'
      : `${formatUnits(effective, info.decimals)} ${info.symbol}`
    const applyCustom = () => {
      const raw = (approveInput[i] ?? '').trim().replace(',', '.')
      if (!raw) return
      try {
        setApproveOverrides({ ...approveOverrides, [i]: parseUnits(raw, info.decimals) })
        setErrorMsg('')
      } catch { setErrorMsg('Monto inválido') }
    }
    return (
      <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.18)' }}>
        <div style={{ fontSize: '11px', color: '#D4AF37', marginBottom: '6px' }}>
          Límite de gasto · {info.symbol} {ov !== undefined && <span style={{ color: '#8892a4' }}>(modificado)</span>}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input
            value={approveInput[i] ?? ''}
            onChange={(e) => setApproveInput({ ...approveInput, [i]: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCustom() }}
            placeholder={info.unlimited ? 'Ilimitado' : formatUnits(info.amount, info.decimals)}
            inputMode="decimal"
            style={{ flex: 1, minWidth: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: '#0d1017', color: '#f0f4f8', fontSize: '12px' }}
          />
          <button type="button" onClick={applyCustom}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.4)', background: 'transparent', color: '#D4AF37', fontSize: '11px', cursor: 'pointer' }}>
            Aplicar
          </button>
          <button type="button" onClick={() => { setApproveOverrides({ ...approveOverrides, [i]: MAX_UINT256 }); setApproveInput({ ...approveInput, [i]: '' }) }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8892a4', fontSize: '11px', cursor: 'pointer' }}>
            ∞
          </button>
        </div>
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#8892a4' }}>
          Aprobarás: <span style={{ color: '#f0f4f8' }}>{effectiveLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#0d1117',
        border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: '12px',
        padding: '28px 24px 24px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
            backgroundColor: 'rgba(71,101,241,0.1)',
            border: '1px solid rgba(71,101,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="11" viewBox="0 0 40 25" fill="none">
              <path d="M8.19 4.88C13.45 -0.38 22.05 -0.38 27.31 4.88L27.93 5.50C28.21 5.78 28.21 6.22 27.93 6.50L25.76 8.67C25.62 8.81 25.39 8.81 25.25 8.67L24.39 7.81C20.77 4.19 14.73 4.19 11.11 7.81L10.19 8.73C10.05 8.87 9.82 8.87 9.68 8.73L7.51 6.56C7.23 6.28 7.23 5.84 7.51 5.56L8.19 4.88ZM31.77 9.38L33.70 11.31C33.98 11.59 33.98 12.03 33.70 12.31L24.51 21.50C24.23 21.78 23.79 21.78 23.51 21.50L17.08 15.07C17.01 15.00 16.89 15.00 16.82 15.07L10.39 21.50C10.11 21.78 9.67 21.78 9.39 21.50L0.20 12.31C-0.08 12.03 -0.08 11.59 0.20 11.31L2.13 9.38C2.41 9.10 2.85 9.10 3.13 9.38L9.56 15.81C9.63 15.88 9.75 15.88 9.82 15.81L16.25 9.38C16.53 9.10 16.97 9.10 17.25 9.38L23.68 15.81C23.75 15.88 23.87 15.88 23.94 15.81L30.37 9.38C30.65 9.10 31.09 9.10 31.37 9.38H31.77Z" fill="rgba(71,101,241,0.8)" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#f0f4f8' }}>
              {t('connect.dappRequest')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4a5568', fontFamily: 'IBM Plex Mono, monospace' }}>
              {origin}
            </p>
          </div>
        </div>

        {/* Method badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 9px', marginBottom: '16px',
          backgroundColor: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '4px',
        }}>
          <span style={{ fontSize: '11px', color: '#D4AF37', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.03em' }}>
            {method}
          </span>
        </div>

        {/* Content */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: errorMsg ? '12px' : '20px',
          fontSize: '12px',
          fontFamily: 'IBM Plex Mono, monospace',
          color: '#8892a4',
          lineHeight: 1.7,
        }}>
          {txData && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#4a5568' }}>{t('connect.to')}</span>
                <ExplorerAddress addr={txData.to ?? ''} explorerBase={network.blockExplorer.url} />
              </div>
              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#4a5568' }}>{t('connect.value')}</span>
                <span style={{ color: '#f0f4f8' }}>{formatValue(txData.value)}</span>
              </div>
              {risks[0] && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />
                  <CallRow risk={risks[0]} explorerBase={network.blockExplorer.url} />
                  {approveEditor(0)}
                </>
              )}
            </>
          )}

          {sendCalls && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#4a5568' }}>
                  Batch · {atomicMode ? 'ATÓMICO' : 'SECUENCIAL'}
                </span>
                <span style={{ color: '#f0f4f8' }}>
                  {seqMode
                    ? `Paso ${seqIndex + 1} de ${allCalls.length}`
                    : `${allCalls.length} acción(es)`}
                </span>
              </div>
              {seqMode
                ? (risks[seqIndex] && <>{<CallRow risk={risks[seqIndex]} explorerBase={network.blockExplorer.url} />}{approveEditor(seqIndex)}</>)
                : risks.map((r, i) => <div key={i}><CallRow index={i} risk={r} explorerBase={network.blockExplorer.url} />{approveEditor(i)}</div>)}
            </>
          )}

          {signMessage && (
            <div style={{ wordBreak: 'break-all', color: '#f0f4f8' }}>
              {(() => {
                try {
                  if (signMessage.startsWith('0x')) {
                    const text = Buffer.from(signMessage.slice(2), 'hex').toString('utf8')
                    return text || signMessage
                  }
                  return signMessage
                } catch {
                  return signMessage
                }
              })()}
            </div>
          )}

          {typedData && !txData && !signMessage && (
            <div style={{ wordBreak: 'break-all', color: '#8892a4' }}>
              {truncateHex(typeof typedData === 'string' ? typedData : JSON.stringify(typedData), 120)}
            </div>
          )}
        </div>

        {/* Avanzado: editor de gas (estilo MetaMask) — solo en operaciones con tx */}
        {isTxMethod && (
          <div style={{ marginBottom: '14px' }}>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              disabled={loading}
              style={{
                background: 'none', border: 'none', color: '#8892a4', fontSize: '11px',
                cursor: loading ? 'not-allowed' : 'pointer', padding: '4px 0',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              {showAdvanced ? '▾' : '▸'} Avanzado (gas)
            </button>
            {showAdvanced && (
              <div style={{
                marginTop: '6px', padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <GasInput label="Max fee (gwei)" value={gasMaxFee} disabled={loading}
                  onChange={(v) => { setGasEdited(true); setGasMaxFee(v) }} />
                <GasInput label="Priority (gwei)" value={gasPriority} disabled={loading}
                  onChange={(v) => { setGasEdited(true); setGasPriority(v) }} />
                <GasInput label="Gas limit" value={gasLimit} disabled={loading}
                  onChange={(v) => { setGasEdited(true); setGasLimit(v) }} />
                {(() => {
                  let prefund: bigint | null = null
                  try { prefund = (VERIF_GAS + BigInt(gasLimit || '0') + PREVERIF_GAS) * parseGwei(gasMaxFee || '0') } catch { prefund = null }
                  const exceeds = prefund !== null && walletBalance !== null && prefund > walletBalance
                  return (
                    <div style={{ marginTop: '2px', fontSize: '10px', color: exceeds ? '#fc8181' : '#4a5568', lineHeight: 1.6 }}>
                      Prefund estimado: ~{prefund !== null ? (Number(prefund) / 1e18).toFixed(6) : '—'} ETH
                      {walletBalance !== null && <> · saldo: {(Number(walletBalance) / 1e18).toFixed(6)} ETH</>}
                      {exceeds && (
                        <div style={{ color: '#fc8181', marginTop: '3px' }}>
                          ⚠️ El prefund supera tu saldo: la operación fallará. Baja el gas limit o el max fee.
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: '8px 12px', marginBottom: '16px',
            backgroundColor: 'rgba(252,129,129,0.06)',
            border: '1px solid rgba(252,129,129,0.2)',
            borderRadius: '5px',
            fontSize: '11px', color: '#fc8181', fontFamily: 'IBM Plex Mono, monospace',
            wordBreak: 'break-word',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Gate de riesgo: si hay una call peligrosa, hay que marcar el checkbox */}
        {needsAck && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '10px 12px', marginBottom: '14px',
            backgroundColor: 'rgba(252,129,129,0.06)',
            border: '1px solid rgba(252,129,129,0.25)',
            borderRadius: '6px',
            fontSize: '11px', color: '#fc8181', lineHeight: 1.5, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#fc8181' }}
            />
            <span>
              ⚠️ Esta {seqMode ? 'llamada incluye' : 'operación incluye una o más acciones con'} permisos peligrosos
              (aprobación/transferencia a destino desconocido o ilimitada). Entiendo y asumo el riesgo.
            </span>
          </label>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onReject}
            disabled={loading}
            style={{
              flex: 1, padding: '11px 0',
              backgroundColor: 'transparent',
              border: '1px solid rgba(252,129,129,0.25)',
              borderRadius: '6px',
              color: '#fc8181',
              fontSize: '13px', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {t('connect.reject')}
          </button>

          <button
            onClick={handleApprove}
            disabled={loading || (needsAck && !ack)}
            style={{
              flex: 1, padding: '11px 0',
              backgroundColor: (loading || (needsAck && !ack)) ? 'rgba(212,175,55,0.4)' : '#D4AF37',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              fontSize: '13px', fontWeight: '600',
              cursor: (loading || (needsAck && !ack)) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {loadingMsg || t('connect.processing')}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {seqMode
                  ? `Firmar #${seqIndex + 1} con Face ID`
                  : t('connect.approveWithFaceId')}
              </>
            )}
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
