'use client'
import { decodeFunctionData, parseAbi, type Hex } from 'viem'
import { addressBook } from './addressBook'
import { NETWORKS } from './networks'

// ───────────────────────────────────────────────────────────────────────────
// EIP-5792 — modo de firma del batch (atómico opt-in)
// ───────────────────────────────────────────────────────────────────────────
// Por defecto OFF: wallet_sendCalls se firma UNA A UNA (estilo Ledger). Si el
// usuario lo enciende en Settings, se firma todo en un solo userOp atómico.
const ATOMIC_KEY = 'bvcc_atomic_batch'

export function getAtomicBatchEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ATOMIC_KEY) === '1'
}
export function setAtomicBatchEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ATOMIC_KEY, on ? '1' : '0')
}

// ───────────────────────────────────────────────────────────────────────────
// Gas máximo por operación (cap del callGasLimit estimado)
// ───────────────────────────────────────────────────────────────────────────
// Default conservador por red: Ethereum L1 = 3M (el gas es caro y el prefund
// 4337 se reserva por adelantado); L2 = 8M (gas barato). El usuario puede fijar
// su propio tope en Settings (override global). NO afecta a un gas editado a mano
// en el panel Avanzado, que siempre tiene prioridad.
const MAX_GAS_KEY = 'bvcc_max_gas'

export function defaultMaxGas(chainId: number): bigint {
  return chainId === 1 ? 3_000_000n : 8_000_000n
}
export function getMaxGasOverride(): bigint | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(MAX_GAS_KEY)
  if (!v) return null
  try { const n = BigInt(v); return n > 0n ? n : null } catch { return null }
}
export function setMaxGasOverride(v: bigint | null): void {
  if (typeof window === 'undefined') return
  if (v && v > 0n) localStorage.setItem(MAX_GAS_KEY, v.toString())
  else localStorage.removeItem(MAX_GAS_KEY)
}
export function getMaxGas(chainId: number): bigint {
  return getMaxGasOverride() ?? defaultMaxGas(chainId)
}

// ───────────────────────────────────────────────────────────────────────────
// Store de batches (para wallet_getCallsStatus)
// ───────────────────────────────────────────────────────────────────────────
// El id que devolvemos a la dApp en wallet_sendCalls mapea a una o varias txs
// (varias en modo secuencial). getCallsStatus lo resuelve leyendo los receipts.
type BatchRecord = { chainId: number; txHashes: Hex[]; failed: boolean }
const batches = new Map<string, BatchRecord>()

export function newBatchId(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return ('0x' + Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')) as Hex
}
export function recordBatch(id: string, chainId: number, txHashes: Hex[], failed = false): void {
  batches.set(id, { chainId, txHashes, failed })
}
export function getBatch(id: string): BatchRecord | undefined {
  return batches.get(id)
}

// ───────────────────────────────────────────────────────────────────────────
// Direcciones conocidas (address book + contratos de red + infra canónica)
// ───────────────────────────────────────────────────────────────────────────
// Permit2 (misma address en todas las redes) — central en los swaps de Uniswap,
// así que su approve no debe marcarse como "destino desconocido".
const INFRA = ['0x000000000022d473030f116ddee9f6b43ac78ba3']

export function buildKnownSet(walletAddress?: string): Set<string> {
  const known = new Set<string>(INFRA)
  const add = (a?: string | null) => { if (a) known.add(a.toLowerCase()) }
  add(walletAddress)
  for (const n of NETWORKS) {
    const c = n.contracts as Record<string, unknown>
    for (const k of ['factory', 'agentFactory', 'entryPoint', 'usdc', 'weth', 'swapRouter', 'quoterV2']) {
      const v = c[k]
      if (typeof v === 'string') add(v)
    }
  }
  for (const e of addressBook.getAll()) add(e.address)
  return known
}

// ───────────────────────────────────────────────────────────────────────────
// Clasificador de riesgo de una llamada
// ───────────────────────────────────────────────────────────────────────────
export type RiskLevel = 'safe' | 'caution' | 'danger'
export type WcCall = { to?: string; target?: string; value?: string; data?: Hex }
export type CallRisk = {
  level: RiskLevel
  fn: string            // función legible
  target: string        // destino
  targetKnown: boolean
  warn?: string         // motivo si caution/danger
}

const ABI = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function increaseAllowance(address spender, uint256 addedValue)',
  'function setApprovalForAll(address operator, bool approved)',
  'function transfer(address to, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)', // Permit2
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)',
])
// Tratamos como "ilimitado" cualquier allowance gigantesca (>= 2^128).
const UNLIMITED_THRESHOLD = 1n << 128n

export function classifyCall(call: WcCall, known: Set<string>): CallRisk {
  const target = ((call.to ?? call.target) ?? '').toLowerCase()
  const targetKnown = known.has(target)
  const data = call.data
  const value = call.value ? BigInt(call.value) : 0n

  // Sin data → envío de ETH puro
  if (!data || data === '0x' || data.length < 10) {
    if (value > 0n) {
      return targetKnown
        ? { level: 'caution', fn: 'enviar ETH', target, targetKnown }
        : { level: 'danger', fn: 'enviar ETH', target, targetKnown, warn: 'Envío de ETH a dirección desconocida' }
    }
    return { level: 'safe', fn: 'llamada vacía', target, targetKnown }
  }

  try {
    const { functionName, args } = decodeFunctionData({ abi: ABI, data })
    switch (functionName) {
      case 'approve': {
        const isPermit2 = args.length === 4
        const spender = String(args[isPermit2 ? 1 : 0]).toLowerCase()
        const amount = args[isPermit2 ? 2 : 1] as bigint
        const spenderKnown = known.has(spender)
        const unlimited = amount >= UNLIMITED_THRESHOLD
        const fn = `approve · ${unlimited ? 'ILIMITADO' : amount.toString()}`
        if (!spenderKnown) return { level: 'danger', fn, target, targetKnown, warn: 'Aprobación a dirección DESCONOCIDA' }
        if (unlimited) return { level: 'caution', fn, target, targetKnown, warn: 'Aprobación ilimitada (a contrato conocido)' }
        return { level: 'safe', fn, target, targetKnown }
      }
      case 'increaseAllowance': {
        const spender = String(args[0]).toLowerCase()
        const spenderKnown = known.has(spender)
        return spenderKnown
          ? { level: 'caution', fn: 'increaseAllowance', target, targetKnown }
          : { level: 'danger', fn: 'increaseAllowance', target, targetKnown, warn: 'Aumenta allowance a dirección desconocida' }
      }
      case 'setApprovalForAll': {
        const approved = args[1] as boolean
        return approved
          ? { level: 'danger', fn: 'setApprovalForAll(true)', target, targetKnown, warn: 'Da control de TODOS tus NFTs de esta colección' }
          : { level: 'safe', fn: 'setApprovalForAll(false)', target, targetKnown }
      }
      case 'transfer': {
        const to = String(args[0]).toLowerCase()
        const toKnown = known.has(to)
        return toKnown
          ? { level: 'caution', fn: 'transfer', target, targetKnown }
          : { level: 'danger', fn: 'transfer', target, targetKnown, warn: 'Transfiere tokens a dirección desconocida' }
      }
      case 'transferFrom': {
        const to = String(args[1]).toLowerCase()
        const toKnown = known.has(to)
        return toKnown
          ? { level: 'caution', fn: 'transferFrom', target, targetKnown }
          : { level: 'danger', fn: 'transferFrom', target, targetKnown, warn: 'Mueve tokens a dirección desconocida' }
      }
      case 'supply':
      case 'withdraw':
      case 'borrow':
      case 'repay':
        return { level: 'safe', fn: functionName, target, targetKnown }
      default:
        return { level: 'caution', fn: functionName, target, targetKnown }
    }
  } catch {
    return { level: 'caution', fn: `acción no reconocida (${data.slice(0, 10)})`, target, targetKnown, warn: 'Acción no reconocida' }
  }
}
