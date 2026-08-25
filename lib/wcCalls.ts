'use client'
import { decodeAbiParameters, decodeFunctionData, encodeFunctionData, formatUnits, parseAbi, parseAbiParameters, type Hex } from 'viem'
import { addressBook } from './addressBook'
import { NETWORKS } from './networks'
import { EXCESSIVE_BALANCE_MULTIPLE, isExcessive, isUnlimited } from './allowanceLimits'

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

// ───────────────────────────────────────────────────────────────────────────
// Quien paga el gas
// ───────────────────────────────────────────────────────────────────────────
// Por defecto lo adelanta el relayer de BVCC (el "bundler") y la wallet se lo
// reembolsa. Desactivandolo, el gas lo paga la wallet conectada (MetaMask), como
// al crear la wallet.
//
// Por que alguien querria desactivarlo: el relayer es UNA SOLA cuenta compartida
// por todos los usuarios de esa red. Si una de sus transacciones se queda sin
// minar, bloquea la cola hasta que alguien la reemplace. Pagando tu el gas vas
// por TU cuenta y eso no te afecta.
//
// Lo que NO cambia: la operacion la sigue firmando tu passkey. La wallet
// conectada solo retransmite y paga; no puede mover tus fondos.
const BUNDLER_KEY = 'bvcc_use_bundler'

export function getUseBundler(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(BUNDLER_KEY) !== '0'
}
export function setUseBundler(on: boolean): void {
  if (typeof window === 'undefined') return
  if (on) localStorage.removeItem(BUNDLER_KEY)
  else localStorage.setItem(BUNDLER_KEY, '0')
}

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
  // Uniswap Universal Router (swaps desde app.uniswap.org).
  //
  // ⚠️ Esta lista CADUCA: Uniswap despliega routers nuevos y la interfaz empieza a
  // usarlos sin avisar. Cuando eso pasa, el swap se decodifica bien pero el destino
  // sale "no reconocido" y la operación entera se pinta de amarillo. No se adivina:
  // `scripts/check-infra-routers.mjs` mide qué router recibe `execute()` de verdad
  // en cada red y avisa de los que falten aquí. Pásalo antes de dar por buena la lista.
  //
  // ⚠️ El criterio para entrar aquí es **estar en la documentación de Uniswap**, no
  // "recibe llamadas a execute()". Ese selector no es exclusivo suyo: PancakeSwap y
  // otros forks del Universal Router usan el mismo, y en BNB uno de ellos mueve más
  // tráfico que el propio Uniswap. Meterlos aquí sería declararlos de confianza.
  // Que un router que no es de Uniswap salga en amarillo es la respuesta correcta.
  //
  // Medido el 2026-08-13 (llamadas `execute()` reales por red):
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af', // Ethereum — 85 tx en 60 bloques
  '0x6ff5693b99212da76ad316178a184ab56d299b43', // Base — 118 tx en 300 bloques
  '0xa51afafe0263b40edaef0df8781ea9aa03e381a3', // Arbitrum One — 11 tx en 900 bloques
  '0x1906c1d672b88cd1b9ac7593301ca990f94eae07', // BNB Chain — 6 tx en 150 bloques
  '0x1095692a6237d83c6a72f3f5efedb9a670c49223', // Polygon — 2 tx en 150 bloques
  // "Universal Router 2.1.1", el que usa hoy app.uniswap.org. Va en tres direcciones
  // según la cadena, y ninguna estaba aquí: por eso un swap normal salía en amarillo.
  '0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca', // Ethereum — 56 de sus 141 swaps
  '0x8b844f885672f333bc0042cb669255f93a4c1e6b', // Arbitrum, BNB y Polygon
  '0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7', // Base (y Unichain, Zora, Monad)
  '0xefd1d4bd4cf1e86da286bb4cb1b8bced9c10ba47', // Arbitrum Sepolia (documentado y con código;
                                                // la testnet no da tráfico que medir)
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // UR 1.2 en Base. Salió midiendo firmas reales
                                                // (scripts/wc-signatures-real.mjs, 2026-08-13) y
                                                // está en el propio SDK de Uniswap para la 8453.
  '0x5e325eda8064b456f4781070c0738d849c824258', // Arbitrum One (v3; 1 tx en la medición)
  '0x4dae2f939acf50408e13d58534ff8c2776d45265', // BNB Chain (antiguo; 0 tx, se deja por si
                                                // alguien tiene una sesión vieja abierta)
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
  if (ff) return `${i}.${ff}`
  // No caben en cinco decimales, pero el número NO es cero. Escribir "0" sería
  // enseñar un importe distinto del que se firma: si los decimales del token no
  // se conocen, un permiso de 250 USDC se convierte en "0".
  if (i === '0' && /[1-9]/.test(f)) return '<0.00001'
  return i
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

/** Importe con decimales y símbolo que ya se conocen (los lee el modal on-chain
 *  para los tokens que no están en TOKEN_META). */
export function formatWithMeta(raw: bigint, decimals: number, symbol: string): string {
  return `${trimNum(formatUnits(raw, decimals))} ${symbol}`.trim()
}

/** Compartido con lib/wcSignatures.ts, que formatea los importes de un permiso
 *  con las mismas reglas que el decodificador usa para los de una transacción. */
export { fmtAmt as formatAmount, tokenSym as tokenSymbol }

// ───────────────────────────────────────────────────────────────────────────
// Clasificador de riesgo de una llamada
// ───────────────────────────────────────────────────────────────────────────
export type RiskLevel = 'safe' | 'caution' | 'danger'
export type WcCall = { to?: string; target?: string; value?: string; data?: Hex }

// This module has no React context, so the caller hands it the translator.
// Same signature as useI18n().t — see lib/i18n/ns/wcdecode.ts for the strings.
export type Tr = (key: string, vars?: Record<string, string | number>) => string
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
  'function unwrapWETH9(uint256 amountMinimum)',
  // sweepToken saca del router lo que quede: es la salida natural de un
  // exactInput con `recipient` = el propio router. Sin ella en el ABI, la
  // segunda mitad de ese patrón caía en "selector desconocido".
  'function sweepToken(address token, uint256 amountMinimum, address recipient)',
  'function sweepToken(address token, uint256 amountMinimum)',
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
const YEAR = 365 * 24 * 3600

const RISK_ORDER: Record<RiskLevel, number> = { safe: 0, caution: 1, danger: 2 }
function worse(a: RiskLevel, b: RiskLevel): RiskLevel { return RISK_ORDER[b] > RISK_ORDER[a] ? b : a }
/** El nivel más alto de dos. Una sola definición: dos escalas de riesgo que se
 *  combinaran de formas distintas serían dos criterios distintos. */
export { worse as worseRisk }

// ───────────────────────────────────────────────────────────────────────────
// ¿A dónde van los fondos?
// ───────────────────────────────────────────────────────────────────────────
// Casi todas las operaciones que mueven dinero llevan un campo de destino:
// `recipient` en los swaps, `to` en un retiro de Aave, `onBehalfOf` en un
// depósito, `owner` en una posición de liquidez. Se decodificaban para poder
// escribir el resumen y luego se tiraban, así que un swap idéntico al tuyo pero
// con el `recipient` cambiado salía en pantalla como "seguro".
//
// Por la ruta del propietario no hay call policies (`lib/callPolicies.ts` solo
// se aplica a `executeAsAgent`), así que esta comprobación es la única que hay.

/** Direcciones centinela: NO son destinatarios, son convenios de Uniswap.
 *    address(0) → `NonfungiblePositionManager.collect` lo lee como "este contrato"
 *    address(1) → MSG_SENDER  (Universal Router y SwapRouter02)
 *    address(2) → ADDRESS_THIS (los fondos se quedan para el siguiente paso) */
const SENTINELS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
])

function corta(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

/** ¿El destino soy yo, o un paso intermedio del propio contrato que llamo? */
function paraMi(dest: unknown, ctx: Ctx): boolean {
  const a = String(dest ?? '').toLowerCase()
  if (!a || !a.startsWith('0x')) return true          // campo ausente en esta variante
  if (SENTINELS.has(a)) return true
  // Sin saber cuál es mi wallet no se puede comparar. Se deja pasar a propósito:
  // marcar TODO como desviado sería peor que no mirar, porque el usuario
  // aprendería a ignorar el aviso. `self` lo pone siempre el modal.
  if (!ctx.self) return true
  if (a === ctx.self) return true
  return a === ctx.target                             // se queda en el router
}

/** Añade a una operación ya decodificada el veredicto sobre su destino.
 *  `severidad` baja a 'caution' en los casos en que el desvío no te cuesta
 *  dinero (pedir prestado a nombre de otro, p. ej.). */
function conDestino(d: Decoded, dest: unknown, ctx: Ctx, severidad: RiskLevel = 'danger'): Decoded {
  if (paraMi(dest, ctx)) return d
  const a = String(dest).toLowerCase()
  // Una dirección de tu agenda la has metido tú: se avisa, pero no es lo mismo
  // que una que aparece por primera vez dentro de la calldata.
  const nivel = ctx.known.has(a) ? 'caution' : severidad
  const warn = ctx.t(nivel === 'danger' ? 'wc.warnRecipient' : 'wc.warnRecipientKnown', { addr: corta(a) })
  return {
    ...d,
    summary: `${d.summary ?? d.fn} ${ctx.t('wc.toThirdParty', { addr: corta(a) })}`,
    level: worse(d.level, nivel),
    warn: [d.warn, warn].filter(Boolean).join(' · '),
  }
}

/** Lo que necesita el intérprete para clasificar una llamada. */
type Ctx = {
  known: Set<string>
  t: Tr
  /** Esta wallet, en minúsculas. Vacío = no se comprueban destinos. */
  self: string
  /** Contrato llamado, en minúsculas. En un multicall se propaga a las sub-llamadas. */
  target: string
  /** ¿Está `target` en `known`? Decide si un selector desconocido es danger o caution. */
  targetKnown: boolean
  /** Saldo del usuario en el token del approve, si se pudo leer. */
  saldoToken?: bigint
}

// ── Uniswap V4: las acciones van empaquetadas en `bytes` (un byte por acción) ──
// Decodificamos la lista para saber la operación principal (primer byte) y, si es
// crear/añadir posición, intentamos sacar los montos máximos.
const V4_LABEL: Record<number, string> = {
  0x00: 'wc.v4Add',
  0x01: 'wc.v4Remove',
  0x02: 'wc.v4Create',
  0x03: 'wc.v4Close',
  0x04: 'wc.v4Add',
  0x05: 'wc.v4Create',
}

function decodeV4(actions: Hex, params: readonly Hex[], ctx: Ctx): Decoded {
  const t = ctx.t
  const first = actions.length >= 4 ? parseInt(actions.slice(2, 4), 16) : -1
  let summary = t(V4_LABEL[first] ?? 'wc.v4Manage')
  let owner: unknown
  try {
    if ((first === 0x02 || first === 0x05) && params[0]) {
      // MINT_POSITION: (PoolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, owner, hookData)
      const d = decodeAbiParameters(
        parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData'),
        params[0],
      )
      const pk = d[0] as { currency0: string; currency1: string }
      owner = d[6]   // a nombre de quién queda la posición
      summary += t('wc.v4Max', { a: fmtAmt(d[4] as bigint, pk.currency0), b: fmtAmt(d[5] as bigint, pk.currency1) })
    } else if ((first === 0x00 || first === 0x04) && params[0]) {
      // INCREASE_LIQUIDITY: (tokenId, liquidity, amount0Max, amount1Max, hookData)
      const d = decodeAbiParameters(parseAbiParameters('uint256 tokenId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, bytes hookData'), params[0])
      summary += t('wc.v4ToPos', { id: String(d[0]) })
    } else if ((first === 0x01 || first === 0x03) && params[0]) {
      // DECREASE / BURN empiezan por tokenId (leemos solo el primer slot)
      const d = decodeAbiParameters(parseAbiParameters('uint256 tokenId'), params[0])
      summary += t('wc.v4Pos', { id: String(d[0]) })
    }
  } catch { /* si el desglose falla, dejamos solo la etiqueta de la acción */ }
  return conDestino({ fn: 'modifyLiquidities', summary, level: 'safe' }, owner, ctx)
}

// ── Uniswap Universal Router: execute(commands, inputs) — un byte por comando ──
// commands[i] empareja con inputs[i]. El bit alto es una flag; la acción está en
// los 6 bits bajos. Decodificamos swaps (v4/v3), wrap/unwrap y permit.
const POOLKEY = '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey'

// La comisión de la interfaz (PAY_PORTION / TAKE_PORTION) va a un tercero por
// diseño — Uniswap cobra 25 puntos básicos, 0,25 %. No es un desvío. Pero el
// campo admite hasta 10 000 bips, y a partir de cierto punto "comisión" es solo
// otro nombre para vaciar la operación.
const FEE_BIPS_NORMAL = 100n   // 1 %

function comision(d: Decoded, bips: bigint, dest: string, ctx: Ctx): Decoded {
  const pct = (Number(bips) / 100).toFixed(2)
  const summary = `${d.summary ?? d.fn} · ${ctx.t('wc.fee', { pct, addr: corta(dest) })}`
  if (bips <= FEE_BIPS_NORMAL) return { ...d, summary }
  return {
    ...d, summary,
    level: worse(d.level, 'danger'),
    warn: [d.warn, ctx.t('wc.warnFeeHuge', { pct })].filter(Boolean).join(' · '),
  }
}

// Dentro de un V4_SWAP la salida NO se entrega en la acción de swap: hay una
// acción TAKE aparte, con su propio `recipient`. Es el mismo campo de destino un
// nivel más abajo, así que se mira igual.
//
// Falla ABIERTO a propósito: si una acción no se decodifica no se inventa un
// aviso, solo se avisa de un tercero identificado con certeza. Al revés —
// convertir "no lo entiendo" en peligro aquí dentro— pintaría de rojo el swap
// más común que existe.
function v4Destinos(acts: Hex, params: readonly Hex[]): { takes: string[]; fees: { addr: string; bips: bigint }[] } {
  const takes: string[] = []
  const fees: { addr: string; bips: bigint }[] = []
  const n = Math.max(0, (acts.length - 2) / 2)
  for (let i = 0; i < n; i++) {
    const a = parseInt(acts.slice(2 + i * 2, 4 + i * 2), 16)
    const p = params[i]
    if (!p) continue
    try {
      if (a === 0x0f) {        // TAKE(currency, recipient, amount)
        takes.push(String(decodeAbiParameters(parseAbiParameters('address currency, address recipient, uint256 amount'), p)[1]))
      } else if (a === 0x15) { // SWEEP(currency, recipient)
        takes.push(String(decodeAbiParameters(parseAbiParameters('address currency, address recipient'), p)[1]))
      } else if (a === 0x12) { // TAKE_PAIR(currency0, currency1, recipient)
        takes.push(String(decodeAbiParameters(parseAbiParameters('address c0, address c1, address recipient'), p)[2]))
      } else if (a === 0x11) { // TAKE_PORTION(currency, recipient, bips)
        const d = decodeAbiParameters(parseAbiParameters('address currency, address recipient, uint256 bips'), p)
        fees.push({ addr: String(d[1]), bips: d[2] as bigint })
      }
    } catch { /* acción ilegible → no se inventa un aviso */ }
  }
  return { takes, fees }
}

function urV4Swap(input: Hex, ctx: Ctx): Decoded {
  const t = ctx.t
  const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes, bytes[]'), input)
  const acts = actions as Hex
  const ps = params as Hex[]
  const a0 = acts.length >= 4 ? parseInt(acts.slice(2, 4), 16) : -1
  const p = ps[0]
  let summary = t('wc.swapV4')
  if (a0 === 0x06) { // SWAP_EXACT_IN_SINGLE
    const d = decodeAbiParameters(parseAbiParameters(`(${POOLKEY}, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData) p`), p)
    const x = d[0] as { poolKey: { currency0: string; currency1: string }; zeroForOne: boolean; amountIn: bigint; amountOutMinimum: bigint }
    const tin = x.zeroForOne ? x.poolKey.currency0 : x.poolKey.currency1
    const tout = x.zeroForOne ? x.poolKey.currency1 : x.poolKey.currency0
    summary = t('wc.swapIn', { amt: fmtAmt(x.amountIn, tin), sym: tokenSym(tout), min: fmtAmt(x.amountOutMinimum, tout) })
  } else if (a0 === 0x08) { // SWAP_EXACT_OUT_SINGLE
    const d = decodeAbiParameters(parseAbiParameters(`(${POOLKEY}, bool zeroForOne, uint128 amountOut, uint128 amountInMaximum, bytes hookData) p`), p)
    const x = d[0] as { poolKey: { currency0: string; currency1: string }; zeroForOne: boolean; amountOut: bigint; amountInMaximum: bigint }
    const tin = x.zeroForOne ? x.poolKey.currency0 : x.poolKey.currency1
    const tout = x.zeroForOne ? x.poolKey.currency1 : x.poolKey.currency0
    summary = t('wc.swapOut', { sym: tokenSym(tin), amt: fmtAmt(x.amountOut, tout), max: fmtAmt(x.amountInMaximum, tin) })
  }
  let d: Decoded = { fn: 'V4_SWAP', summary, level: 'safe' }
  const { takes, fees } = v4Destinos(acts, ps)
  for (const dest of takes) d = conDestino(d, dest, ctx)
  for (const f of fees) d = comision(d, f.bips, f.addr, ctx)
  return d
}

function urV3Swap(input: Hex, exactIn: boolean, ctx: Ctx): Decoded {
  const t = ctx.t
  const d = decodeAbiParameters(parseAbiParameters('address recipient, uint256 amount, uint256 amountLimit, bytes path, bool payerIsUser'), input)
  const path = d[3] as Hex
  const a = ('0x' + path.slice(2, 42))                  // primer token del path
  const b = ('0x' + path.slice(path.length - 40))       // último token del path
  const amount = d[1] as bigint, limit = d[2] as bigint
  // exactOut codifica el path al revés (tokenOut primero)
  const tin = exactIn ? a : b, tout = exactIn ? b : a
  const summary = exactIn
    ? t('wc.swapIn', { amt: fmtAmt(amount, tin), sym: tokenSym(tout), min: fmtAmt(limit, tout) })
    : t('wc.swapOut', { sym: tokenSym(tin), amt: fmtAmt(amount, tout), max: fmtAmt(limit, tin) })
  return conDestino({ fn: 'V3_SWAP', summary, level: 'safe' }, d[0], ctx)
}

function urV2Swap(input: Hex, exactIn: boolean, ctx: Ctx): Decoded {
  const t = ctx.t
  const d = decodeAbiParameters(parseAbiParameters('address recipient, uint256 amount, uint256 amountLimit, address[] path, bool payerIsUser'), input)
  const path = d[3] as readonly string[]
  const tin = exactIn ? path[0] : path[path.length - 1]
  const tout = exactIn ? path[path.length - 1] : path[0]
  const amount = d[1] as bigint, limit = d[2] as bigint
  const summary = exactIn
    ? t('wc.swapIn', { amt: fmtAmt(amount, tin), sym: tokenSym(tout), min: fmtAmt(limit, tout) })
    : t('wc.swapOut', { sym: tokenSym(tin), amt: fmtAmt(amount, tout), max: fmtAmt(limit, tin) })
  return conDestino({ fn: 'V2_SWAP', summary, level: 'safe' }, d[0], ctx)
}

// Un comando del Universal Router. Devuelve null si NO lo sabemos leer — quien
// llama decide qué hacer con eso, y lo que hace es no fiarse.
function decodeURCommand(cmd: number, input: Hex, ctx: Ctx): Decoded | null {
  const t = ctx.t
  const tokenRecipiente = (spec: string, iTok: number, iDest: number, key: string): Decoded => {
    const d = decodeAbiParameters(parseAbiParameters(spec), input)
    const sum = t(key, { sym: tokenSym(String(d[iTok])) })
    return conDestino({ fn: key, summary: sum, level: 'safe' }, d[iDest], ctx)
  }
  switch (cmd) {
    case 0x10: return urV4Swap(input, ctx)                          // V4_SWAP
    case 0x00: return urV3Swap(input, true, ctx)                    // V3_SWAP_EXACT_IN
    case 0x01: return urV3Swap(input, false, ctx)                   // V3_SWAP_EXACT_OUT
    case 0x08: return urV2Swap(input, true, ctx)                    // V2_SWAP_EXACT_IN
    case 0x09: return urV2Swap(input, false, ctx)                   // V2_SWAP_EXACT_OUT
    case 0x02: return tokenRecipiente('address token, address recipient, uint160 amount', 0, 1, 'wc.urPermitTransfer')
    case 0x04: return tokenRecipiente('address token, address recipient, uint256 amountMin', 0, 1, 'wc.urSweep')
    case 0x05: return tokenRecipiente('address token, address recipient, uint256 value', 0, 1, 'wc.urTransfer')
    case 0x06: {                                                    // PAY_PORTION
      const d = decodeAbiParameters(parseAbiParameters('address token, address recipient, uint256 bips'), input)
      const base: Decoded = { fn: 'PAY_PORTION', summary: t('wc.urPayPortion', { sym: tokenSym(String(d[0])) }), level: 'safe' }
      return comision(base, d[2] as bigint, String(d[1]), ctx)
    }
    case 0x0b: {                                                    // WRAP_ETH(recipient, amount)
      const d = decodeAbiParameters(parseAbiParameters('address recipient, uint256 amount'), input)
      return conDestino({ fn: 'WRAP_ETH', summary: t('wc.wrapShort'), level: 'safe' }, d[0], ctx)
    }
    case 0x0c: {                                                    // UNWRAP_WETH(recipient, amountMin)
      const d = decodeAbiParameters(parseAbiParameters('address recipient, uint256 amountMin'), input)
      return conDestino({ fn: 'UNWRAP_WETH', summary: t('wc.unwrapShort'), level: 'safe' }, d[0], ctx)
    }
    case 0x0d: {                                                    // PERMIT2_TRANSFER_FROM_BATCH
      const [batch] = decodeAbiParameters(parseAbiParameters('(address from, address to, uint160 amount, address token)[] batch'), input)
      let d: Decoded = { fn: 'PERMIT2_TRANSFER_FROM_BATCH', summary: t('wc.urPermitTransferBatch', { n: (batch as unknown[]).length }), level: 'safe' }
      for (const it of batch as readonly { to: string }[]) d = conDestino(d, it.to, ctx)
      return d
    }
    case 0x0e: return { fn: 'BALANCE_CHECK_ERC20', summary: t('wc.urBalanceCheck'), level: 'safe' }
    case 0x0a: case 0x03: {   // PERMIT2_PERMIT / PERMIT2_PERMIT_BATCH
      // El `spender` de un permiso Permit2 decide quién puede mover tus tokens
      // a partir de ese momento: es exactamente el criterio de un `approve`, que
      // sí se comprobaba. Por esta ruta no se miraba a nadie.
      const generico: Decoded = { fn: 'PERMIT2_PERMIT', summary: t('wc.permit2'), level: 'safe' }
      const DETALLE = 'address token, uint160 amount, uint48 expiration, uint48 nonce'
      try {
        const spec = cmd === 0x0a
          ? `((${DETALLE}) details, address spender, uint256 sigDeadline) permit, bytes signature`
          : `((${DETALLE})[] details, address spender, uint256 sigDeadline) permit, bytes signature`
        const [permit] = decodeAbiParameters(parseAbiParameters(spec), input)
        const spender = String((permit as { spender: string }).spender).toLowerCase()
        if (ctx.known.has(spender)) return generico
        return {
          ...generico,
          summary: `${generico.summary} ${t('wc.toThirdParty', { addr: corta(spender) })}`,
          level: 'danger',
          warn: t('wc.warnPermit2Unknown', { addr: corta(spender) }),
        }
      } catch {
        // Falla abierto: no saber leer el detalle de un comando que SÍ conocemos
        // no puede convertirse en un peligro inventado (los permisos de Uniswap
        // son el paso previo de casi cada swap).
        return generico
      }
    }
    // Llamadas al gestor de posiciones: el router restringe qué se puede pedir,
    // pero el detalle va dentro y no se lee aquí.
    case 0x11: case 0x12: case 0x13: case 0x14:
      return { fn: 'POSITION_MANAGER', summary: t('wc.urPositionCall'), level: 'caution', warn: t('wc.warnUrPositionCall') }
    default: return null
  }
}

function decodeUR(commands: Hex, inputs: readonly Hex[], ctx: Ctx): Decoded {
  const t = ctx.t
  const parts: string[] = []
  const warns: string[] = []
  const sinLeer: string[] = []
  let level: RiskLevel = 'safe'
  const n = Math.max(0, (commands.length - 2) / 2)
  for (let i = 0; i < n; i++) {
    const raw = commands.slice(2 + i * 2, 4 + i * 2)
    const cmd = parseInt(raw, 16) & 0x3f   // el bit alto es la flag de "permitir revert"
    let d: Decoded | null = null
    try { d = decodeURCommand(cmd, inputs[i], ctx) } catch { d = null }
    if (!d) { sinLeer.push(`0x${raw}`); continue }
    parts.push(d.summary ?? d.fn)
    level = worse(level, d.level)
    if (d.warn) warns.push(d.warn)
  }
  // Antes, un comando que no estaba en la lista dejaba `s = ''` y `if (s)` lo
  // tiraba: con que UNO de los comandos se decodificara, el resultado salía
  // "seguro" con un resumen a medias. Un execute([swap_normal, TRANSFER]) se leía
  // como un swap normal. Un resumen incompleto no puede presentarse como completo.
  if (sinLeer.length) {
    return {
      fn: 'execute',
      summary: [...parts, t('wc.urUndecoded', { n: sinLeer.length, cmds: sinLeer.join(', ') })].join(' + '),
      level: 'danger',
      warn: [...warns, t('wc.warnUrUndecoded')].join(' · '),
    }
  }
  if (!parts.length) return { fn: 'execute', summary: t('wc.urGeneric'), level: 'caution', warn: t('wc.warnUrGeneric') }
  return { fn: 'execute', summary: parts.join(' + '), level, warn: warns.join(' · ') || undefined }
}

type Decoded = { fn: string; summary?: string; level: RiskLevel; warn?: string }

// Interpreta la calldata de UNA llamada (sin tener en cuenta el destino, que se
// añade en classifyCall). `target` es el contrato llamado — en un multicall las
// sub-llamadas se ejecutan sobre el mismo contrato, así que se propaga.
function interpret(data: Hex, value: bigint, ctx: Ctx, depth = 0): Decoded {
  const { known, t, target } = ctx
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
        const unlimited = isUnlimited(amount)
        // Aprobar 2^128 − 1 esquivaba el aviso de "ilimitado" por un wei. Ahora
        // además se compara con lo que tienes de verdad en ese token.
        const excesivo = !unlimited && isExcessive(amount, ctx.saldoToken)
        const sym = tokenSym(token)
        // Con monto: fmtAmt ya incluye el símbolo ("100 USDC"). Ilimitado: lo anteponemos.
        const amtStr = unlimited ? t('wc.unlimitedAmt', { sym }) : fmtAmt(amount, token)
        const fn = `approve · ${unlimited ? t('wc.unlimited') : amount.toString()}`
        const spenderLabel = spender === '0x000000000022d473030f116ddee9f6b43ac78ba3'
          ? t('wc.spenderPermit2')
          : t(spenderKnown ? 'wc.spenderKnown' : 'wc.spenderUnknown')
        const summary = t('wc.approve', { amt: amtStr, spender: spenderLabel })
        if (!spenderKnown) return { fn, summary, level: 'danger', warn: t('wc.warnApproveUnknown') }
        if (unlimited) return { fn, summary, level: 'caution', warn: t('wc.warnApproveUnlimited') }
        if (excesivo) return { fn, summary, level: 'caution', warn: t('wc.warnApproveExcessive', { n: EXCESSIVE_BALANCE_MULTIPLE.toString() }) }
        return { fn, summary, level: 'safe' }
      }
      case 'increaseAllowance': {
        const spenderKnown = known_(args[0])
        return spenderKnown
          ? { fn: 'increaseAllowance', summary: t('wc.incAllowKnown'), level: 'caution' }
          : { fn: 'increaseAllowance', summary: t('wc.incAllowUnknown'), level: 'danger', warn: t('wc.warnIncAllow') }
      }
      case 'setApprovalForAll': {
        const approved = args[1] as boolean
        return approved
          ? { fn: 'setApprovalForAll(true)', summary: t('wc.nftApproveAll'), level: 'danger', warn: t('wc.warnNftApproveAll') }
          : { fn: 'setApprovalForAll(false)', summary: t('wc.nftRevokeAll'), level: 'safe' }
      }
      case 'transfer': {
        const toKnown = known_(args[0])
        const s = t('wc.transfer', { amt: fmtAmt(args[1] as bigint, target), dest: t(toKnown ? 'wc.destKnown' : 'wc.destUnknown') })
        return toKnown
          ? { fn: 'transfer', summary: s, level: 'caution' }
          : { fn: 'transfer', summary: s, level: 'danger', warn: t('wc.warnTransferUnknown') }
      }
      case 'transferFrom': {
        const toKnown = known_(args[1])
        const s = t('wc.transferFrom', { amt: fmtAmt(args[2] as bigint, target), dest: t(toKnown ? 'wc.destKnown' : 'wc.destUnknown') })
        return toKnown
          ? { fn: 'transferFrom', summary: s, level: 'caution' }
          : { fn: 'transferFrom', summary: s, level: 'danger', warn: t('wc.warnTransferFromUnknown') }
      }
      // ── WETH ──
      case 'deposit':
        return { fn: 'deposit', summary: t('wc.wrap', { amt: fmtAmt(value) }), level: 'safe' }

      // ── Aave + WETH.withdraw (mismo nombre, distinto número de args) ──
      case 'withdraw': {
        if (args.length === 1) return { fn: 'withdraw', summary: t('wc.unwrap', { amt: fmtAmt(args[0] as bigint) }), level: 'safe' }
        const asset = String(args[0])
        // `to`: a dónde sale el colateral que retiras.
        return conDestino({ fn: 'Aave withdraw', summary: t('wc.aaveWithdraw', { amt: fmtAmt(args[1] as bigint, asset) }), level: 'safe' }, args[2], ctx)
      }
      case 'supply': {
        const asset = String(args[0])
        // `onBehalfOf`: quién se queda los aTokens. Si no eres tú, has depositado
        // tu dinero en la cuenta de otro.
        return conDestino({ fn: 'Aave supply', summary: t('wc.aaveSupply', { amt: fmtAmt(args[1] as bigint, asset) }), level: 'safe' }, args[2], ctx)
      }
      case 'borrow': {
        const asset = String(args[0])
        const d: Decoded = { fn: 'Aave borrow', summary: t('wc.aaveBorrow', { amt: fmtAmt(args[1] as bigint, asset) }), level: 'caution', warn: t('wc.warnAaveBorrow') }
        if (paraMi(args[4], ctx)) return d
        // Aquí el desvío va al revés que en el resto: la deuda se crea a nombre de
        // otro (que tiene que haberte delegado crédito) y los tokens vienen a ti.
        // No te cuesta dinero, así que se dice pero no se marca como peligro.
        return { ...d, summary: `${d.summary} · ${t('wc.aaveOnBehalf', { addr: corta(String(args[4]).toLowerCase()) })}` }
      }
      case 'repay': {
        const asset = String(args[0])
        // `onBehalfOf`: de quién es la deuda que estás pagando con tu dinero.
        return conDestino({ fn: 'Aave repay', summary: t('wc.aaveRepay', { amt: fmtAmt(args[1] as bigint, asset) }), level: 'safe' }, args[3], ctx)
      }

      // ── Uniswap V3 — liquidez ──
      case 'mint': {
        const p = args[0] as { token0: string; token1: string; amount0Desired: bigint; amount1Desired: bigint; recipient: string }
        // `recipient`: a nombre de quién queda el NFT de la posición.
        return conDestino({ fn: 'mint', summary: t('wc.lpMint', { a: fmtAmt(p.amount0Desired, p.token0), b: fmtAmt(p.amount1Desired, p.token1) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'increaseLiquidity': {
        const p = args[0] as { tokenId: bigint }
        return { fn: 'increaseLiquidity', summary: t('wc.lpIncrease', { id: String(p.tokenId) }), level: 'safe' }
      }
      case 'decreaseLiquidity': {
        const p = args[0] as { tokenId: bigint }
        return { fn: 'decreaseLiquidity', summary: t('wc.lpDecrease', { id: String(p.tokenId) }), level: 'safe' }
      }
      case 'collect': {
        const p = args[0] as { tokenId: bigint; recipient: string }
        // `recipient`: a dónde van las comisiones cobradas.
        return conDestino({ fn: 'collect', summary: t('wc.lpCollect', { id: String(p.tokenId) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'burn':
        return { fn: 'burn', summary: t('wc.lpBurn', { id: String(args[0]) }), level: 'safe' }

      // ── Uniswap V3 — swaps ──
      case 'exactInputSingle': {
        const p = args[0] as { tokenIn: string; tokenOut: string; amountIn: bigint; amountOutMinimum: bigint; recipient: string }
        return conDestino({ fn: 'exactInputSingle', summary: t('wc.swapIn', { amt: fmtAmt(p.amountIn, p.tokenIn), sym: tokenSym(p.tokenOut), min: fmtAmt(p.amountOutMinimum, p.tokenOut) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'exactOutputSingle': {
        const p = args[0] as { tokenIn: string; tokenOut: string; amountOut: bigint; amountInMaximum: bigint; recipient: string }
        return conDestino({ fn: 'exactOutputSingle', summary: t('wc.swapOut', { sym: tokenSym(p.tokenIn), amt: fmtAmt(p.amountOut, p.tokenOut), max: fmtAmt(p.amountInMaximum, p.tokenIn) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'exactInput': {
        const p = args[0] as { amountIn: bigint; amountOutMinimum: bigint; recipient: string }
        return conDestino({ fn: 'exactInput', summary: t('wc.swapInPath', { amt: fmtAmt(p.amountIn), min: fmtAmt(p.amountOutMinimum) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'exactOutput': {
        const p = args[0] as { amountOut: bigint; amountInMaximum: bigint; recipient: string }
        return conDestino({ fn: 'exactOutput', summary: t('wc.swapOutPath', { amt: fmtAmt(p.amountOut), max: fmtAmt(p.amountInMaximum) }), level: 'safe' }, p.recipient, ctx)
      }
      case 'unwrapWETH9':
        // La variante de un solo argumento manda a msg.sender; la de dos lleva
        // `recipient` (undefined en la primera → conDestino no lo mira).
        return conDestino({ fn: 'unwrapWETH9', summary: t('wc.unwrapMin', { amt: fmtAmt(args[0] as bigint) }), level: 'safe' }, args[1], ctx)
      case 'sweepToken':
        return conDestino({ fn: 'sweepToken', summary: t('wc.sweepToken', { sym: tokenSym(String(args[0])) }), level: 'safe' }, args[2], ctx)
      case 'refundETH':
        return { fn: 'refundETH', summary: t('wc.refundEth'), level: 'safe' }
      case 'execute':
        return decodeUR(args[0] as Hex, args[1] as Hex[], ctx)

      // ── Uniswap V4 ──
      case 'modifyLiquidities': {
        const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), args[0] as Hex)
        return decodeV4(actions as Hex, params as Hex[], ctx)
      }
      case 'modifyLiquiditiesWithoutUnlock':
        return decodeV4(args[0] as Hex, args[1] as Hex[], ctx)

      // ── multicall: desenrolla y agrega las sub-llamadas ──
      case 'multicall': {
        const inner = (args.length === 2 ? args[1] : args[0]) as Hex[]
        if (depth > 2) return { fn: t('wc.multicall', { n: inner.length }), level: 'caution' }
        const subs = inner.map((d) => interpret(d, 0n, ctx, depth + 1))
        const summary = subs.map((s) => s.summary || s.fn).filter(Boolean).join(' + ')
        const level = subs.reduce<RiskLevel>((acc, s) => worse(acc, s.level), 'safe')
        const warn = subs.map((s) => s.warn).filter(Boolean).join(' · ') || undefined
        return { fn: t('wc.multicall', { n: inner.length }), summary, level, warn }
      }

      // ── ENS ──
      case 'commit':
        return { fn: 'commit', summary: t('wc.ensCommit'), level: 'safe' }
      case 'register':
        return { fn: 'register', summary: t('wc.ensRegister', { name: String(args[0]), years: (Number(args[2] as bigint) / YEAR).toFixed(1) }), level: 'safe' }
      case 'renew':
        return { fn: 'renew', summary: t('wc.ensRenew', { name: String(args[0]), years: (Number(args[1] as bigint) / YEAR).toFixed(1) }), level: 'safe' }

      default:
        return { fn: functionName, level: noSeLee(ctx), warn: ctx.targetKnown ? undefined : t('wc.warnUnrecognizedUnknown') }
    }
  } catch {
    // "No sé qué hace esta llamada" empataba con "pedir prestado en Aave": las
    // dos salían en amarillo. La escalada de classifyCall no llegaba aquí porque
    // solo actúa sobre las que ya venían en verde.
    return {
      fn: t('wc.unrecognized', { sel: data.slice(0, 10) }),
      level: noSeLee(ctx),
      warn: ctx.targetKnown ? t('wc.warnUnrecognized') : t('wc.warnUnrecognizedUnknown'),
    }
  }
}

/** Calldata ilegible: sobre un contrato conocido es precaución; sobre uno que
 *  tampoco reconocemos no queda nada que sostenga la operación. */
function noSeLee(ctx: Ctx): RiskLevel {
  return ctx.targetKnown ? 'caution' : 'danger'
}

export type ClassifyOpts = {
  /** Dirección de ESTA wallet. Sin ella no se puede saber si el destino de los
   *  fondos es el tuyo, así que el modal la pasa siempre. */
  self: string
  /** Saldo del usuario en el token del approve, si se pudo leer. */
  saldoToken?: bigint
}

export function classifyCall(call: WcCall, known: Set<string>, t: Tr, opts: ClassifyOpts): CallRisk {
  const target = ((call.to ?? call.target) ?? '').toLowerCase()
  const targetKnown = known.has(target)
  const data = call.data
  const value = call.value ? BigInt(call.value) : 0n
  const ctx: Ctx = {
    known, t, target, targetKnown,
    self: (opts.self ?? '').toLowerCase(),
    saldoToken: opts.saldoToken,
  }

  // Sin data → envío de ETH puro
  if (!data || data === '0x' || data.length < 10) {
    if (value > 0n) {
      return targetKnown
        ? { level: 'caution', fn: t('wc.fnSendEth'), summary: t('wc.sendEth', { amt: fmtAmt(value) }), target, targetKnown }
        : { level: 'danger', fn: t('wc.fnSendEth'), summary: t('wc.sendEthUnknown', { amt: fmtAmt(value) }), target, targetKnown, warn: t('wc.warnSendEthUnknown') }
    }
    return { level: 'safe', fn: t('wc.emptyCall'), target, targetKnown }
  }

  const d = interpret(data, value, ctx)
  let level = d.level
  let warn = d.warn
  // Acción reconocida como segura pero hacia un contrato que no conocemos → precaución.
  if (level === 'safe' && !targetKnown) {
    level = 'caution'
    warn = warn ?? t('wc.warnUnknownContract')
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
      unlimited: isUnlimited(amount),
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
