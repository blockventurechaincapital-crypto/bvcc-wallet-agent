'use client'
import { decodeAbiParameters, decodeFunctionData, encodeFunctionData, formatUnits, parseAbi, parseAbiParameters, type Hex } from 'viem'
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
// Permit2 + contratos de protocolo canónicos (Uniswap NFPM / Universal Router,
// Aave V3 Pool, ENS) que aparecen como destino en operaciones legítimas.
// Listamos las variantes por red — basta con que la address coincida; no
// dependemos de la red activa. Si alguna no coincide, la operación se decodifica
// igual (resumen legible) pero el destino sale como "no reconocido" → precaución.
const INFRA = [
  '0x000000000022d473030f116ddee9f6b43ac78ba3', // Permit2 (todas las redes)
  // Uniswap V3 NonfungiblePositionManager
  '0xc36442b4a4522e871399cd717abdd847ab11fe88', // Ethereum / Arbitrum One
  '0x03a520b32c04bf3beef7beb72e919cf822ed34f1', // Base
  '0x7b8a01b39d58278b5de7e48c8449c9f4f5170613', // BNB Chain
  '0x6b2937bde17889edcf8fbd8de31c3c2a70bc4d65', // Arbitrum Sepolia
  // Uniswap V4 PositionManager
  '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e', // Ethereum
  '0xd88f38f930b7952f2db2432cb002e7abbf3dd869', // Arbitrum One
  '0x7c5f5a4bbd8fd63184577525326123b519429bdc', // Base
  '0x7a4a5c919ae2541aed11041a1aeee68f1287f95b', // BNB Chain
  // Uniswap Universal Router (swaps desde app.uniswap.org)
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af', // Ethereum (v4)
  '0x5e325eda8064b456f4781070c0738d849c824258', // Arbitrum One (v3-era)
  '0xa51afafe0263b40edaef0df8781ea9aa03e381a3', // Arbitrum One (v4, docs)
  '0x6ff5693b99212da76ad316178a184ab56d299b43', // Base (v4)
  '0x4dae2f939acf50408e13d58534ff8c2776d45265', // BNB Chain
  // Aave V3 Pool
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', // Ethereum
  '0x794a61358d6845594f94dc1db02a252b5b4814ad', // Arbitrum One
  '0xa238dd80c259a72e81d7e4664a9801593f98d1c5', // Base
  '0x6807dc923806fe8fd134338eabca509979a7e0cb', // BNB Chain
  // ENS ETHRegistrarController (mainnet)
  '0x253553366da8546fc250f225fe3d25d0c782303b',
  '0x283af0b28c62c092c9727f1ee09c02ca627eb7f5',
]

export function buildKnownSet(walletAddress?: string): Set<string> {
  const known = new Set<string>(INFRA)
  const add = (a?: string | null) => { if (a) known.add(a.toLowerCase()) }
  add(walletAddress)
  for (const n of NETWORKS) {
    add(n.contracts.factory); add(n.contracts.agentFactory); add(n.contracts.entryPoint)
    add(n.tokens.usdc); add(n.tokens.weth)
    if (n.uniswap) { add(n.uniswap.swapRouter); add(n.uniswap.quoterV2) }
  }
  for (const e of addressBook.getAll()) add(e.address)
  return known
}

// ───────────────────────────────────────────────────────────────────────────
// Símbolos/decimales de tokens conocidos (para montos legibles en el resumen)
// ───────────────────────────────────────────────────────────────────────────
const TOKEN_META = new Map<string, { symbol: string; decimals: number }>()
for (const n of NETWORKS) {
  if (n.tokens.usdc) TOKEN_META.set(n.tokens.usdc.toLowerCase(), { symbol: 'USDC', decimals: n.tokens.usdcDecimals })
  TOKEN_META.set(n.tokens.weth.toLowerCase(), { symbol: n.chainId === 56 ? 'WBNB' : 'WETH', decimals: 18 })
}

function trimNum(s: string): string {
  if (!s.includes('.')) return s
  const [i, f] = s.split('.')
  const ff = f.slice(0, 5).replace(/0+$/, '')
  return ff ? `${i}.${ff}` : i
}
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
// Formatea un monto crudo usando los decimales del token si lo conocemos (18 si no).
// La address cero = ETH nativo (convención de Uniswap v4).
function fmtAmt(raw: bigint, addr?: string): string {
  if (addr && addr.toLowerCase() === ZERO_ADDR) return `${trimNum(formatUnits(raw, 18))} ETH`
  const meta = addr ? TOKEN_META.get(addr.toLowerCase()) : undefined
  const num = trimNum(formatUnits(raw, meta?.decimals ?? 18))
  return meta?.symbol ? `${num} ${meta.symbol}` : num
}
function tokenSym(addr?: string): string {
  if (!addr) return ''
  return TOKEN_META.get(addr.toLowerCase())?.symbol ?? `${addr.slice(0, 6)}…`
}

// ───────────────────────────────────────────────────────────────────────────
// Clasificador de riesgo de una llamada
// ───────────────────────────────────────────────────────────────────────────
export type RiskLevel = 'safe' | 'caution' | 'danger'
export type WcCall = { to?: string; target?: string; value?: string; data?: Hex }
export type CallRisk = {
  level: RiskLevel
  fn: string            // función técnica (selector legible)
  summary?: string      // resumen en lenguaje humano ("Añadir liquidez · …")
  target: string        // destino
  targetKnown: boolean
  warn?: string         // motivo si caution/danger
}

const ABI = parseAbi([
  // ── ERC-20 / NFT ──
  'function approve(address spender, uint256 amount)',
  'function increaseAllowance(address spender, uint256 addedValue)',
  'function setApprovalForAll(address operator, bool approved)',
  'function transfer(address to, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)', // Permit2
  // ── WETH ──
  'function deposit()',
  'function withdraw(uint256 wad)',
  // ── Aave V3 Pool ──
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)',
  // ── Uniswap V3 NonfungiblePositionManager ──
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params)',
  'function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params)',
  'function burn(uint256 tokenId)',
  // ── Uniswap SwapRouter02 ──
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params)',
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum) params)',
  'function exactOutput((bytes path, address recipient, uint256 amountOut, uint256 amountInMaximum) params)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient)',
  'function refundETH()',
  // ── Uniswap Universal Router ──
  'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
  'function execute(bytes commands, bytes[] inputs)',
  // ── Uniswap V4 PositionManager ──
  'function modifyLiquidities(bytes unlockData, uint256 deadline)',
  'function modifyLiquiditiesWithoutUnlock(bytes actions, bytes[] params)',
  // ── multicall (NFPM / Router) ──
  'function multicall(bytes[] data)',
  'function multicall(uint256 deadline, bytes[] data)',
  // ── ENS ETHRegistrarController ──
  'function commit(bytes32 commitment)',
  'function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses)',
  'function renew(string name, uint256 duration)',
])
// Tratamos como "ilimitado" cualquier allowance gigantesca (>= 2^128).
const UNLIMITED_THRESHOLD = 1n << 128n
const YEAR = 365 * 24 * 3600

const RISK_ORDER: Record<RiskLevel, number> = { safe: 0, caution: 1, danger: 2 }
function worse(a: RiskLevel, b: RiskLevel): RiskLevel { return RISK_ORDER[b] > RISK_ORDER[a] ? b : a }

// ── Uniswap V4: las acciones van empaquetadas en `bytes` (un byte por acción) ──
// Decodificamos la lista para saber la operación principal (primer byte) y, si es
// crear/añadir posición, intentamos sacar los montos máximos.
const V4_LABEL: Record<number, string> = {
  0x00: 'Añadir liquidez a una posición (Uniswap v4)',
  0x01: 'Retirar liquidez de una posición (Uniswap v4)',
  0x02: 'Crear posición de liquidez (Uniswap v4)',
  0x03: 'Cerrar posición (Uniswap v4)',
  0x04: 'Añadir liquidez a una posición (Uniswap v4)',
  0x05: 'Crear posición de liquidez (Uniswap v4)',
}

function decodeV4(actions: Hex, params: readonly Hex[]): Decoded {
  const first = actions.length >= 4 ? parseInt(actions.slice(2, 4), 16) : -1
  let summary = V4_LABEL[first] ?? 'Gestionar liquidez (Uniswap v4)'
  try {
    if ((first === 0x02 || first === 0x05) && params[0]) {
      // MINT_POSITION: (PoolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, owner, hookData)
      const d = decodeAbiParameters(
        parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData'),
        params[0],
      )
      const pk = d[0] as { currency0: string; currency1: string }
      summary += ` · máx ${fmtAmt(d[4] as bigint, pk.currency0)} + ${fmtAmt(d[5] as bigint, pk.currency1)}`
    } else if ((first === 0x00 || first === 0x04) && params[0]) {
      // INCREASE_LIQUIDITY: (tokenId, liquidity, amount0Max, amount1Max, hookData)
      const d = decodeAbiParameters(parseAbiParameters('uint256 tokenId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, bytes hookData'), params[0])
      summary += ` a la posición #${d[0]}`
    } else if ((first === 0x01 || first === 0x03) && params[0]) {
      // DECREASE / BURN empiezan por tokenId (leemos solo el primer slot)
      const d = decodeAbiParameters(parseAbiParameters('uint256 tokenId'), params[0])
      summary += ` (posición #${d[0]})`
    }
  } catch { /* si el desglose falla, dejamos solo la etiqueta de la acción */ }
  return { fn: 'modifyLiquidities', summary, level: 'safe' }
}

// ── Uniswap Universal Router: execute(commands, inputs) — un byte por comando ──
// commands[i] empareja con inputs[i]. El bit alto es una flag; la acción está en
// los 6 bits bajos. Decodificamos swaps (v4/v3), wrap/unwrap y permit.
const POOLKEY = '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey'

function urV4Swap(input: Hex): string {
  const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes, bytes[]'), input)
  const acts = actions as Hex
  const a0 = acts.length >= 4 ? parseInt(acts.slice(2, 4), 16) : -1
  const p = (params as Hex[])[0]
  if (a0 === 0x06) { // SWAP_EXACT_IN_SINGLE
    const d = decodeAbiParameters(parseAbiParameters(`(${POOLKEY}, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData) p`), p)
    const x = d[0] as { poolKey: { currency0: string; currency1: string }; zeroForOne: boolean; amountIn: bigint; amountOutMinimum: bigint }
    const tin = x.zeroForOne ? x.poolKey.currency0 : x.poolKey.currency1
    const tout = x.zeroForOne ? x.poolKey.currency1 : x.poolKey.currency0
    return `Swap ${fmtAmt(x.amountIn, tin)} → ${tokenSym(tout)} (mín ${fmtAmt(x.amountOutMinimum, tout)})`
  }
  if (a0 === 0x08) { // SWAP_EXACT_OUT_SINGLE
    const d = decodeAbiParameters(parseAbiParameters(`(${POOLKEY}, bool zeroForOne, uint128 amountOut, uint128 amountInMaximum, bytes hookData) p`), p)
    const x = d[0] as { poolKey: { currency0: string; currency1: string }; zeroForOne: boolean; amountOut: bigint; amountInMaximum: bigint }
    const tin = x.zeroForOne ? x.poolKey.currency0 : x.poolKey.currency1
    const tout = x.zeroForOne ? x.poolKey.currency1 : x.poolKey.currency0
    return `Swap ${tokenSym(tin)} → ${fmtAmt(x.amountOut, tout)} (máx ${fmtAmt(x.amountInMaximum, tin)})`
  }
  return 'Swap en Uniswap v4'
}

function urV3Swap(input: Hex, exactIn: boolean): string {
  const d = decodeAbiParameters(parseAbiParameters('address recipient, uint256 amount, uint256 amountLimit, bytes path, bool payerIsUser'), input)
  const path = d[3] as Hex
  const a = ('0x' + path.slice(2, 42))                  // primer token del path
  const b = ('0x' + path.slice(path.length - 40))       // último token del path
  const amount = d[1] as bigint, limit = d[2] as bigint
  // exactOut codifica el path al revés (tokenOut primero)
  const tin = exactIn ? a : b, tout = exactIn ? b : a
  return exactIn
    ? `Swap ${fmtAmt(amount, tin)} → ${tokenSym(tout)} (mín ${fmtAmt(limit, tout)})`
    : `Swap ${tokenSym(tin)} → ${fmtAmt(amount, tout)} (máx ${fmtAmt(limit, tin)})`
}

function decodeUR(commands: Hex, inputs: readonly Hex[]): Decoded {
  const parts: string[] = []
  const n = Math.max(0, (commands.length - 2) / 2)
  for (let i = 0; i < n; i++) {
    const cmd = parseInt(commands.slice(2 + i * 2, 4 + i * 2), 16) & 0x3f
    const input = inputs[i]
    let s = ''
    try {
      switch (cmd) {
        case 0x10: s = urV4Swap(input); break          // V4_SWAP
        case 0x00: s = urV3Swap(input, true); break     // V3_SWAP_EXACT_IN
        case 0x01: s = urV3Swap(input, false); break    // V3_SWAP_EXACT_OUT
        case 0x08: case 0x09: s = 'Swap en Uniswap v2'; break // V2 (path es address[], no detallamos montos)
        case 0x0b: s = 'Envolver ETH → WETH'; break     // WRAP_ETH
        case 0x0c: s = 'Desenvolver WETH → ETH'; break  // UNWRAP_WETH
        case 0x0a: case 0x03: s = 'Permiso Permit2'; break
      }
    } catch { /* comando no decodificable → se omite */ }
    if (s) parts.push(s)
  }
  if (!parts.length) return { fn: 'execute', summary: 'Operación en Uniswap (Universal Router)', level: 'caution', warn: 'Comandos del Universal Router no detallados' }
  return { fn: 'execute', summary: parts.join(' + '), level: 'safe' }
}

type Decoded = { fn: string; summary?: string; level: RiskLevel; warn?: string }

// Interpreta la calldata de UNA llamada (sin tener en cuenta el destino, que se
// añade en classifyCall). `target` es el contrato llamado — en un multicall las
// sub-llamadas se ejecutan sobre el mismo contrato, así que se propaga.
function interpret(data: Hex, value: bigint, known: Set<string>, target?: string, depth = 0): Decoded {
  try {
    const decoded = decodeFunctionData({ abi: ABI, data })
    const functionName = decoded.functionName
    const args = decoded.args as readonly unknown[]
    const known_ = (a: unknown) => known.has(String(a).toLowerCase())

    switch (functionName) {
      // ── Aprobaciones ──
      case 'approve': {
        const isPermit2 = args.length === 4
        const token = isPermit2 ? String(args[0]) : target
        const spender = String(args[isPermit2 ? 1 : 0]).toLowerCase()
        const amount = args[isPermit2 ? 2 : 1] as bigint
        const spenderKnown = known.has(spender)
        const unlimited = amount >= UNLIMITED_THRESHOLD
        const sym = tokenSym(token)
        // Con monto: fmtAmt ya incluye el símbolo ("100 USDC"). Ilimitado: lo anteponemos.
        const amtStr = unlimited ? `${sym} ILIMITADO` : fmtAmt(amount, token)
        const fn = `approve · ${unlimited ? 'ILIMITADO' : amount.toString()}`
        const spenderLabel = spender === '0x000000000022d473030f116ddee9f6b43ac78ba3'
          ? 'Permit2 (Uniswap)'
          : spenderKnown ? 'un contrato conocido' : 'una dirección desconocida'
        const summary = `Aprobar ${amtStr} a ${spenderLabel}`
        if (!spenderKnown) return { fn, summary, level: 'danger', warn: 'Aprobación a dirección DESCONOCIDA' }
        if (unlimited) return { fn, summary, level: 'caution', warn: 'Aprobación ilimitada (a contrato conocido)' }
        return { fn, summary, level: 'safe' }
      }
      case 'increaseAllowance': {
        const spenderKnown = known_(args[0])
        return spenderKnown
          ? { fn: 'increaseAllowance', summary: 'Aumentar allowance a un contrato conocido', level: 'caution' }
          : { fn: 'increaseAllowance', summary: 'Aumentar allowance a dirección desconocida', level: 'danger', warn: 'Aumenta allowance a dirección desconocida' }
      }
      case 'setApprovalForAll': {
        const approved = args[1] as boolean
        return approved
          ? { fn: 'setApprovalForAll(true)', summary: 'Dar control de TODOS tus NFTs de esta colección', level: 'danger', warn: 'Da control de TODOS tus NFTs de esta colección' }
          : { fn: 'setApprovalForAll(false)', summary: 'Revocar control de los NFTs de esta colección', level: 'safe' }
      }
      case 'transfer': {
        const toKnown = known_(args[0])
        const s = `Enviar ${fmtAmt(args[1] as bigint, target)} → ${toKnown ? 'destino conocido' : 'destino desconocido'}`
        return toKnown
          ? { fn: 'transfer', summary: s, level: 'caution' }
          : { fn: 'transfer', summary: s, level: 'danger', warn: 'Transfiere tokens a dirección desconocida' }
      }
      case 'transferFrom': {
        const toKnown = known_(args[1])
        const s = `Mover ${fmtAmt(args[2] as bigint, target)} → ${toKnown ? 'destino conocido' : 'destino desconocido'}`
        return toKnown
          ? { fn: 'transferFrom', summary: s, level: 'caution' }
          : { fn: 'transferFrom', summary: s, level: 'danger', warn: 'Mueve tokens a dirección desconocida' }
      }
      // ── WETH ──
      case 'deposit':
        return { fn: 'deposit', summary: `Envolver ${fmtAmt(value)} ETH → WETH`, level: 'safe' }

      // ── Aave + WETH.withdraw (mismo nombre, distinto número de args) ──
      case 'withdraw': {
        if (args.length === 1) return { fn: 'withdraw', summary: `Desenvolver ${fmtAmt(args[0] as bigint)} WETH → ETH`, level: 'safe' }
        const asset = String(args[0])
        return { fn: 'Aave withdraw', summary: `Retirar ${fmtAmt(args[1] as bigint, asset)} de Aave`, level: 'safe' }
      }
      case 'supply': {
        const asset = String(args[0])
        return { fn: 'Aave supply', summary: `Depositar ${fmtAmt(args[1] as bigint, asset)} en Aave`, level: 'safe' }
      }
      case 'borrow': {
        const asset = String(args[0])
        return { fn: 'Aave borrow', summary: `Pedir prestado ${fmtAmt(args[1] as bigint, asset)} en Aave`, level: 'caution', warn: 'Genera deuda en Aave' }
      }
      case 'repay': {
        const asset = String(args[0])
        return { fn: 'Aave repay', summary: `Devolver ${fmtAmt(args[1] as bigint, asset)} a Aave`, level: 'safe' }
      }

      // ── Uniswap V3 — liquidez ──
      case 'mint': {
        const p = args[0] as { token0: string; token1: string; amount0Desired: bigint; amount1Desired: bigint }
        return { fn: 'mint', summary: `Añadir liquidez · ${fmtAmt(p.amount0Desired, p.token0)} + ${fmtAmt(p.amount1Desired, p.token1)}`, level: 'safe' }
      }
      case 'increaseLiquidity': {
        const p = args[0] as { tokenId: bigint }
        return { fn: 'increaseLiquidity', summary: `Añadir liquidez a la posición #${p.tokenId}`, level: 'safe' }
      }
      case 'decreaseLiquidity': {
        const p = args[0] as { tokenId: bigint }
        return { fn: 'decreaseLiquidity', summary: `Retirar liquidez de la posición #${p.tokenId}`, level: 'safe' }
      }
      case 'collect': {
        const p = args[0] as { tokenId: bigint }
        return { fn: 'collect', summary: `Cobrar comisiones de la posición #${p.tokenId}`, level: 'safe' }
      }
      case 'burn':
        return { fn: 'burn', summary: `Cerrar posición #${args[0]} (NFT de liquidez)`, level: 'safe' }

      // ── Uniswap V3 — swaps ──
      case 'exactInputSingle': {
        const p = args[0] as { tokenIn: string; tokenOut: string; amountIn: bigint; amountOutMinimum: bigint }
        return { fn: 'exactInputSingle', summary: `Swap ${fmtAmt(p.amountIn, p.tokenIn)} → ${tokenSym(p.tokenOut)} (mín ${fmtAmt(p.amountOutMinimum, p.tokenOut)})`, level: 'safe' }
      }
      case 'exactOutputSingle': {
        const p = args[0] as { tokenIn: string; tokenOut: string; amountOut: bigint; amountInMaximum: bigint }
        return { fn: 'exactOutputSingle', summary: `Swap ${tokenSym(p.tokenIn)} → ${fmtAmt(p.amountOut, p.tokenOut)} (máx ${fmtAmt(p.amountInMaximum, p.tokenIn)})`, level: 'safe' }
      }
      case 'exactInput': {
        const p = args[0] as { amountIn: bigint; amountOutMinimum: bigint }
        return { fn: 'exactInput', summary: `Swap (entrada ${fmtAmt(p.amountIn)}, salida mínima ${fmtAmt(p.amountOutMinimum)})`, level: 'safe' }
      }
      case 'exactOutput': {
        const p = args[0] as { amountOut: bigint; amountInMaximum: bigint }
        return { fn: 'exactOutput', summary: `Swap (salida ${fmtAmt(p.amountOut)}, entrada máx ${fmtAmt(p.amountInMaximum)})`, level: 'safe' }
      }
      case 'unwrapWETH9':
        return { fn: 'unwrapWETH9', summary: `Desenvolver WETH → ETH (mín ${fmtAmt(args[0] as bigint)})`, level: 'safe' }
      case 'refundETH':
        return { fn: 'refundETH', summary: 'Devolver el ETH sobrante', level: 'safe' }
      case 'execute':
        return decodeUR(args[0] as Hex, args[1] as Hex[])

      // ── Uniswap V4 ──
      case 'modifyLiquidities': {
        const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), args[0] as Hex)
        return decodeV4(actions as Hex, params as Hex[])
      }
      case 'modifyLiquiditiesWithoutUnlock':
        return decodeV4(args[0] as Hex, args[1] as Hex[])

      // ── multicall: desenrolla y agrega las sub-llamadas ──
      case 'multicall': {
        const inner = (args.length === 2 ? args[1] : args[0]) as Hex[]
        if (depth > 2) return { fn: `multicall (${inner.length})`, level: 'caution' }
        const subs = inner.map((d) => interpret(d, 0n, known, target, depth + 1))
        const summary = subs.map((s) => s.summary || s.fn).filter(Boolean).join(' + ')
        const level = subs.reduce<RiskLevel>((acc, s) => worse(acc, s.level), 'safe')
        const warn = subs.map((s) => s.warn).filter(Boolean).join(' · ') || undefined
        return { fn: `multicall (${inner.length})`, summary, level, warn }
      }

      // ── ENS ──
      case 'commit':
        return { fn: 'commit', summary: 'Reservar un nombre ENS (paso 1/2)', level: 'safe' }
      case 'register':
        return { fn: 'register', summary: `Registrar ${String(args[0])}.eth · ${(Number(args[2] as bigint) / YEAR).toFixed(1)} año(s)`, level: 'safe' }
      case 'renew':
        return { fn: 'renew', summary: `Renovar ${String(args[0])}.eth · ${(Number(args[1] as bigint) / YEAR).toFixed(1)} año(s)`, level: 'safe' }

      default:
        return { fn: functionName, level: 'caution' }
    }
  } catch {
    return { fn: `acción no reconocida (${data.slice(0, 10)})`, level: 'caution', warn: 'Acción no reconocida' }
  }
}

export function classifyCall(call: WcCall, known: Set<string>): CallRisk {
  const target = ((call.to ?? call.target) ?? '').toLowerCase()
  const targetKnown = known.has(target)
  const data = call.data
  const value = call.value ? BigInt(call.value) : 0n

  // Sin data → envío de ETH puro
  if (!data || data === '0x' || data.length < 10) {
    if (value > 0n) {
      return targetKnown
        ? { level: 'caution', fn: 'enviar ETH', summary: `Enviar ${fmtAmt(value)} ETH`, target, targetKnown }
        : { level: 'danger', fn: 'enviar ETH', summary: `Enviar ${fmtAmt(value)} ETH a dirección desconocida`, target, targetKnown, warn: 'Envío de ETH a dirección desconocida' }
    }
    return { level: 'safe', fn: 'llamada vacía', target, targetKnown }
  }

  const d = interpret(data, value, known, target)
  let level = d.level
  let warn = d.warn
  // Acción reconocida como segura pero hacia un contrato que no conocemos → precaución.
  if (level === 'safe' && !targetKnown) {
    level = 'caution'
    warn = warn ?? 'Interactúa con un contrato no reconocido'
  }
  return { level, fn: d.fn, summary: d.summary, target, targetKnown, warn }
}

// ───────────────────────────────────────────────────────────────────────────
// Edición del límite de un approve (estilo MetaMask)
// ───────────────────────────────────────────────────────────────────────────
export const MAX_UINT256 = (1n << 256n) - 1n
const MAX_UINT160 = (1n << 160n) - 1n

export type ApproveInfo = {
  kind: 'erc20' | 'permit2'
  token: string
  spender: string
  amount: bigint
  decimals: number
  symbol: string
  unlimited: boolean
}

// Si la call es un approve (ERC-20 o Permit2) devuelve sus datos; si no, null.
export function getApproveInfo(call: WcCall): ApproveInfo | null {
  const data = call.data
  if (!data || data.length < 10) return null
  try {
    const { functionName, args } = decodeFunctionData({ abi: ABI, data })
    if (functionName !== 'approve') return null
    const isPermit2 = args.length === 4
    const token = (isPermit2 ? String(args[0]) : (call.to ?? call.target ?? '')).toLowerCase()
    const spender = String(args[isPermit2 ? 1 : 0]).toLowerCase()
    const amount = args[isPermit2 ? 2 : 1] as bigint
    const meta = TOKEN_META.get(token)
    return {
      kind: isPermit2 ? 'permit2' : 'erc20',
      token, spender, amount,
      decimals: meta?.decimals ?? 18,
      symbol: meta?.symbol ?? tokenSym(token),
      unlimited: amount >= UNLIMITED_THRESHOLD,
    }
  } catch { return null }
}

// Re-codifica la calldata de un approve con un nuevo monto (preservando spender,
// token y expiración en Permit2). Lanza si la call no es un approve.
export function encodeApproveAmount(call: WcCall, newAmount: bigint): Hex {
  const { functionName, args } = decodeFunctionData({ abi: ABI, data: call.data as Hex })
  if (functionName !== 'approve') throw new Error('No es un approve')
  if (args.length === 4) {
    const capped = newAmount > MAX_UINT160 ? MAX_UINT160 : newAmount
    return encodeFunctionData({ abi: ABI, functionName: 'approve', args: [args[0], args[1], capped, args[3]] })
  }
  const capped = newAmount > MAX_UINT256 ? MAX_UINT256 : newAmount
  return encodeFunctionData({ abi: ABI, functionName: 'approve', args: [args[0], capped] })
}
