// What a SIGNATURE authorises — the other half of lib/wcCalls.ts.
//
// wcCalls reads calldata (eth_sendTransaction / wallet_sendCalls). This file
// covers the two methods that sign instead of sending: eth_signTypedData_v4 and
// personal_sign. They cost no gas, which is exactly why they are the cheapest way
// to empty a wallet: a Permit2 `PermitSingle` is one signature, and afterwards the
// spender drains the token on their own — the victim never sees a transaction to
// review, because there wasn't one.
//
// Same two rules as the decoder. Never hide a danger: every field of the message
// is rendered, nothing is cut off, because the interesting values (spender, amount,
// deadline) live at the END of the payload, behind the `types` block. And never
// invent one: the level only goes red where a concrete address or amount says so.
import { hexToBytes } from 'viem'
import { isUnlimited } from './allowanceLimits'
import { formatAmount, formatWithMeta, worseRisk, type RiskLevel, type Tr } from './wcCalls'
import { BIDI, esControl } from './textSafety'

// ───────────────────────────────────────────────────────────────────────────
// Typed data (EIP-712)
// ───────────────────────────────────────────────────────────────────────────
export type TokenMeta = { symbol: string; decimals: number }

/** One rendered field of the message. `label` is the real path in the payload
 *  ("details.amount"); `hint` is the plain-language name when we recognise it. */
export type SigRow = {
  label: string
  value: string
  hint?: string
  note?: string
  level?: RiskLevel
}

export type SigKind =
  | 'permitSingle' | 'permitBatch' | 'permitTransfer' | 'permit2612'
  | 'generic' | 'unreadable'

export type TypedDataRisk = {
  level: RiskLevel
  kind: SigKind
  /** One sentence: what signing this does. */
  title: string
  primaryType: string
  domainName?: string
  verifyingContract?: string
  rows: SigRow[]
  warn?: string
  /** Explicación neutra, no un aviso: qué deja vivo esta firma y qué lo limita. */
  info?: string
  /** Token addresses found in the payload, so the caller can read their symbol
   *  and decimals on-chain and hand them back through `opts.meta`. */
  tokens: string[]
}

export type SigOpts = {
  /** This wallet. A field pointing here is not a third party. */
  self: string
  /** Token metadata resolved on-chain by the caller, keyed by lowercase address. */
  meta?: Record<string, TokenMeta>
  /** Lo que la wallet tiene aprobado (ERC-20 `allowance`) al contrato que
   *  verifica el permiso, por token en minúsculas. Es el tope real: el permiso
   *  firmado no puede mover más que esto, diga lo que diga. */
  caps?: Record<string, bigint>
}

// Un payload hostil puede traer miles de campos: se enseña todo lo que cabe y se
// dice cuánto se ha dejado fuera, en vez de colgar el modal que pide la firma.
const MAX_ROWS = 80
const MAX_DEPTH = 6
const MAX_CHARS = 256

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/
const NUM_RE = /^-?\d+$/
// Segundos de época creíbles: de 2001 a 5138. Por encima es "sin caducidad".
const TIME_MIN = 1_000_000_000
const TIME_MAX = 100_000_000_000
// Tres familias de fechas que significan cosas opuestas en el pasado: una
// caducidad pasada es un permiso muerto; un inicio pasado es uno EN VIGOR; y un
// sello de creación está en el pasado siempre, por definición. Meterlas en el
// mismo saco pintaba «ya caducado» en todo login con `timestamp`, y una alarma
// que salta sin motivo enseña a no leer la que sí lo tiene.
const TIME_END = /deadline|expiration|expiry|expires|validuntil|validbefore|endtime/i
const TIME_START = /validafter|validfrom|notbefore|starttime/i
const TIME_STAMP = /timestamp|issuedat|createdat/i
type TimeKind = 'end' | 'start' | 'stamp'
function timeKind(leaf: string): TimeKind | null {
  if (TIME_START.test(leaf)) return 'start'
  if (TIME_END.test(leaf)) return 'end'
  if (TIME_STAMP.test(leaf)) return 'stamp'
  return null
}
const AMOUNT_FIELD = /amount|value|quantity|price|limit/i

type Ctx = { known: Set<string>; t: Tr; self: string; meta: Record<string, TokenMeta> }

function corta(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

/** Importe con los decimales del token: primero lo que el modal haya leído
 *  on-chain, y si no, lo que ya sabe el decodificador (USDC/WETH por red). Las
 *  dos vías escriben el número igual porque lo hace el mismo formateador. */
function fmtToken(raw: bigint, token: string | undefined, ctx: Ctx): string {
  const m = token ? ctx.meta[token.toLowerCase()] : undefined
  if (m) return formatWithMeta(raw, m.decimals, m.symbol)
  return formatAmount(raw, token)
}

function fmtDate(n: bigint, t: Tr, kind: TimeKind): { value: string; note?: string } {
  const secs = Number(n)
  if (secs >= TIME_MAX) return kind === 'end' ? { value: t('wc.sigNoExpiry') } : { value: n.toString() }
  const d = new Date(secs * 1000)
  const value = `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  if (kind === 'stamp') return { value }
  const dias = (secs * 1000 - Date.now()) / 86_400_000
  if (kind === 'start') return dias > 0 ? { value, note: t('wc.sigNotYetValid') } : { value }
  if (dias < 0) return { value, note: t('wc.sigExpired') }
  if (dias > 400) return { value, note: t('wc.sigFarFuture', { n: Math.round(dias) }) }
  return { value }
}

/** Cómo de tuya es una dirección. Devuelve la nota y, si es de fuera, el nivel. */
function addrNote(a: string, ctx: Ctx): { note: string; level?: RiskLevel } {
  const low = a.toLowerCase()
  if (low === ctx.self) return { note: ctx.t('wc.sigSelf') }
  if (ctx.known.has(low)) return { note: ctx.t('wc.sigKnownAddr') }
  return { note: ctx.t('wc.sigUnknownAddr'), level: 'caution' }
}

// Nombres llanos para los campos de los permisos. La clave es el camino sin
// índices, así `details[3].amount` y `details.amount` comparten entrada.
const HINTS: Record<string, string> = {
  'spender': 'wc.sigFieldSpender',
  'owner': 'wc.sigFieldOwner',
  'token': 'wc.sigFieldToken',
  'details.token': 'wc.sigFieldToken',
  'permitted.token': 'wc.sigFieldToken',
  'value': 'wc.sigFieldAmount',
  'details.amount': 'wc.sigFieldAmount',
  'permitted.amount': 'wc.sigFieldAmount',
  'details.expiration': 'wc.sigFieldExpiration',
  'deadline': 'wc.sigFieldDeadline',
  'sigDeadline': 'wc.sigFieldDeadline',
}
function hintFor(path: string, t: Tr): string | undefined {
  const key = HINTS[path.replace(/\[\d+\]/g, '')]
  return key ? t(key) : undefined
}

/** Convierte un escalar del mensaje en una fila legible. */
function scalarRow(path: string, v: unknown, ctx: Ctx, tokenHint?: string): SigRow {
  const row: SigRow = { label: path, value: '', hint: hintFor(path, ctx.t) }
  const leaf = path.split('.').pop() ?? path

  if (typeof v === 'string' && ADDR_RE.test(v)) {
    row.value = v
    const n = addrNote(v, ctx)
    row.note = n.note
    row.level = n.level
    return row
  }

  const esNum = typeof v === 'bigint' || typeof v === 'number' ||
    (typeof v === 'string' && NUM_RE.test(v))
  if (esNum) {
    let n: bigint
    try { n = BigInt(v as string | number | bigint) } catch { n = 0n }
    const tk = timeKind(leaf)
    if (tk && n >= TIME_MIN) {
      const d = fmtDate(n, ctx.t, tk)
      row.value = d.value
      row.note = d.note
      return row
    }
    if (AMOUNT_FIELD.test(leaf)) {
      if (isUnlimited(n)) {
        row.value = ctx.t('wc.unlimited')
        row.note = n.toString()
        row.level = 'caution'
        return row
      }
      row.value = fmtToken(n, tokenHint, ctx)
      return row
    }
    row.value = n.toString()
    return row
  }

  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  row.value = s.length > MAX_CHARS
    ? `${s.slice(0, MAX_CHARS)}… ${ctx.t('wc.sigTruncated', { n: s.length - MAX_CHARS })}`
    : s
  return row
}

/** Aplana el mensaje entero. El token del bloque en curso se arrastra hacia
 *  abajo para que `amount` se formatee con SUS decimales, no con 18 por defecto. */
function flatten(
  v: unknown, path: string, out: SigRow[], ctx: Ctx, depth: number, tokenHint?: string,
): void {
  if (out.length >= MAX_ROWS) return
  if (Array.isArray(v)) {
    if (depth >= MAX_DEPTH) { out.push(scalarRow(path, v, ctx, tokenHint)); return }
    for (let i = 0; i < v.length; i++) {
      flatten(v[i], `${path}[${i}]`, out, ctx, depth + 1, tokenHint)
      if (out.length >= MAX_ROWS) return
    }
    return
  }
  if (v && typeof v === 'object') {
    if (depth >= MAX_DEPTH) { out.push(scalarRow(path, v, ctx, tokenHint)); return }
    const obj = v as Record<string, unknown>
    // Si este bloque trae su propio token, manda sobre el de arriba.
    const propio = typeof obj.token === 'string' && ADDR_RE.test(obj.token) ? obj.token : tokenHint
    for (const k of Object.keys(obj)) {
      flatten(obj[k], path ? `${path}.${k}` : k, out, ctx, depth + 1, propio)
      if (out.length >= MAX_ROWS) return
    }
    return
  }
  out.push(scalarRow(path, v, ctx, tokenHint))
}

function contarCampos(v: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) return 1
  if (Array.isArray(v)) return v.reduce<number>((a, it) => a + contarCampos(it, depth + 1), 0)
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .reduce<number>((a, it) => a + contarCampos(it, depth + 1), 0)
  }
  return 1
}

function esObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function kindOf(primaryType: string, msg: Record<string, unknown>): SigKind {
  if (primaryType === 'PermitSingle' && esObj(msg.details)) return 'permitSingle'
  if (primaryType === 'PermitBatch' && Array.isArray(msg.details)) return 'permitBatch'
  if (primaryType === 'PermitTransferFrom' || primaryType === 'PermitBatchTransferFrom') return 'permitTransfer'
  if (primaryType === 'Permit' && 'spender' in msg && ('value' in msg || 'amount' in msg)) return 'permit2612'
  return 'generic'
}

/** Los pares (token, importe) que el permiso autoriza, sea cual sea su forma. */
function permisos(kind: SigKind, msg: Record<string, unknown>, verifying?: string)
  : { token?: string; amount?: bigint }[] {
  const uno = (o: unknown, tokenPorDefecto?: string) => {
    if (!esObj(o)) return { token: tokenPorDefecto }
    const token = typeof o.token === 'string' ? o.token : tokenPorDefecto
    const bruto = o.amount ?? o.value
    let amount: bigint | undefined
    try { if (bruto !== undefined) amount = BigInt(bruto as string) } catch { /* ilegible */ }
    return { token, amount }
  }
  switch (kind) {
    case 'permitSingle': return [uno(msg.details)]
    case 'permitBatch': return (msg.details as unknown[]).map((d) => uno(d))
    case 'permitTransfer': {
      const p = msg.permitted
      return Array.isArray(p) ? p.map((d) => uno(d)) : [uno(p)]
    }
    case 'permit2612': return [uno(msg, verifying)]
    default: return []
  }
}

/**
 * Lee un payload de `eth_signTypedData_v4` y dice qué autoriza y cuánto riesgo
 * tiene. Nunca lanza: un payload roto sale como 'unreadable' en precaución, que
 * es peor que entenderlo y mejor que un modal en blanco.
 */
export function analyzeTypedData(
  raw: unknown, known: Set<string>, t: Tr, opts: SigOpts,
): TypedDataRisk {
  const ctx: Ctx = { known, t, self: (opts.self ?? '').toLowerCase(), meta: opts.meta ?? {} }
  const vacio: TypedDataRisk = {
    level: 'caution', kind: 'unreadable', title: t('wc.sigUnreadable'),
    primaryType: '—', rows: [], warn: t('wc.warnSigUnreadable'), tokens: [],
  }

  let td: Record<string, unknown>
  try {
    td = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>
    if (!esObj(td)) return vacio
  } catch { return vacio }

  const primaryType = typeof td.primaryType === 'string' ? td.primaryType : '—'
  const domain = esObj(td.domain) ? td.domain : {}
  const message = esObj(td.message) ? td.message : {}
  const domainName = typeof domain.name === 'string' ? domain.name : undefined
  const verifying = typeof domain.verifyingContract === 'string' ? domain.verifyingContract : undefined

  const kind = kindOf(primaryType, message)
  // En un permit de ERC-2612 el token no está en el mensaje: es el contrato que
  // verifica la firma. Sin este dato, `value` se formatea con 18 decimales y un
  // permiso de 250 USDC se pinta como "0".
  const rows: SigRow[] = []
  flatten(message, '', rows, ctx, 0, kind === 'permit2612' ? verifying : undefined)
  const total = contarCampos(message)
  if (total > rows.length) {
    rows.push({ label: '…', value: t('wc.sigMoreFields', { n: total - rows.length }), level: 'caution' })
  }

  const perms = permisos(kind, message, verifying)
  const tokens = [...new Set(perms.map((p) => p.token?.toLowerCase()).filter(Boolean) as string[])]

  // ── Familia Permit: quién gasta y cuánto ──────────────────────────────────
  if (kind !== 'generic') {
    const spender = typeof message.spender === 'string' ? message.spender : ''
    const spenderLow = spender.toLowerCase()
    const conocido = !spender || spenderLow === ctx.self || known.has(spenderLow)
    const primero = perms[0]?.amount
    const ilimitado = perms.some((p) => p.amount !== undefined && isUnlimited(p.amount))

    const importe = primero === undefined
      ? '—'
      : isUnlimited(primero) ? t('wc.unlimited') : fmtToken(primero, perms[0].token, ctx)
    const quien = spender ? corta(spender) : '—'
    const title = kind === 'permitBatch'
      ? t('wc.sigPermitMany', { spender: quien, n: perms.length })
      : kind === 'permitTransfer'
        ? t('wc.sigPermitTransfer', { spender: quien, amt: importe })
        : t('wc.sigPermitOne', { spender: quien, amt: importe })

    let level: RiskLevel = 'safe'
    const warns: string[] = []
    if (!conocido) {
      level = 'danger'
      warns.push(t('wc.warnSigSpenderUnknown', { addr: corta(spender) }))
    }
    if (ilimitado) {
      level = worseRisk(level, 'caution')
      warns.push(t('wc.warnSigUnlimited'))
    }
    return {
      level, kind, title, primaryType, domainName, verifyingContract: verifying,
      rows, warn: warns.join(' · ') || undefined, tokens,
      info: infoPermiso(kind, message, perms, quien, opts.caps, ctx),
    }
  }

  // ── Cualquier otra estructura ─────────────────────────────────────────────
  // Se enseña entera, así que no hay nada oculto; pero esta wallet no sabe qué
  // autoriza, y eso se dice. Sube a rojo si un campo que significa "te doy
  // control" (spender / operator) apunta a alguien de fuera.
  const control = rows.find(
    (r) => /(^|\.)(spender|operator)$/i.test(r.label) && r.level === 'caution',
  )
  if (control) {
    return {
      level: 'danger', kind, primaryType, domainName, verifyingContract: verifying, rows, tokens,
      title: t('wc.sigGeneric', { type: primaryType }),
      warn: t('wc.warnSigSpenderUnknown', { addr: corta(control.value) }),
    }
  }
  return {
    level: 'caution', kind, primaryType, domainName, verifyingContract: verifying, rows, tokens,
    title: t('wc.sigGeneric', { type: primaryType }),
    warn: t('wc.warnSigGeneric'),
  }
}

/**
 * Un permiso de Permit2 (PermitSingle / PermitBatch) no se gasta al firmarlo:
 * queda VIVO hasta su `expiration`, que la dApp suele poner a 30 días. No se puede
 * recortar desde aquí —la dApp manda su propia copia del permiso dentro del swap y
 * Permit2 comprueba la firma contra esa copia; firmar otra fecha haría revertir el
 * swap—, así que lo que se puede hacer es decirlo, junto con lo que de verdad lo
 * limita: lo aprobado al contrato Permit2 con el `approve` del token.
 * Los `PermitTransferFrom` no entran: son de un solo uso y no dejan nada vivo.
 */
function infoPermiso(
  kind: SigKind, msg: Record<string, unknown>, perms: { token?: string; amount?: bigint }[],
  quien: string, caps: Record<string, bigint> | undefined, ctx: Ctx,
): string | undefined {
  if (kind !== 'permitSingle' && kind !== 'permitBatch') return undefined
  const detalles = kind === 'permitSingle' ? [msg.details] : (msg.details as unknown[])
  let exp: bigint | undefined
  for (const d of detalles) {
    if (!esObj(d)) continue
    try {
      const e = BigInt(d.expiration as string)
      if (exp === undefined || e > exp) exp = e
    } catch { /* ilegible */ }
  }
  // En Permit2, expiration 0 significa "solo en el bloque en que se use".
  const fecha = exp === undefined ? '—'
    : exp === 0n ? ctx.t('wc.sigThisBlock')
    : exp >= BigInt(TIME_MIN) ? fmtDate(exp, ctx.t, 'end').value
    : exp.toString()

  const partes: string[] = []
  if (kind === 'permitSingle') {
    const p = perms[0]
    const amt = p?.amount === undefined ? '—'
      : isUnlimited(p.amount) ? ctx.t('wc.unlimited') : fmtToken(p.amount, p.token, ctx)
    partes.push(ctx.t('wc.infoPermitLive', { spender: quien, amt, date: fecha }))
    const cap = p?.token ? caps?.[p.token.toLowerCase()] : undefined
    if (cap === undefined) partes.push(ctx.t('wc.infoPermitCapUnknown'))
    else if (isUnlimited(cap)) partes.push(ctx.t('wc.infoPermitCapUnlimited'))
    else partes.push(ctx.t('wc.infoPermitCap', { cap: fmtToken(cap, p?.token, ctx) }))
  } else {
    partes.push(ctx.t('wc.infoPermitLiveMany', { spender: quien, n: perms.length, date: fecha }))
    partes.push(ctx.t('wc.infoPermitCapUnknown'))
  }
  return partes.join(' ')
}

// ───────────────────────────────────────────────────────────────────────────
// personal_sign
// ───────────────────────────────────────────────────────────────────────────
export type MessageRisk = {
  level: RiskLevel
  /** Lo que hay que pintar: el texto ya escapado, o el hex en crudo. */
  text: string
  /** true → enseñarlo como dato, no como frase. */
  raw: boolean
  warn?: string
  /** Presente si el mensaje es un login de Sign-In with Ethereum (EIP-4361). */
  siwe?: SiweCheck
}

export type SiweCheck = {
  /** El dominio tal cual lo escribe el mensaje. */
  domain: string
  /** 'match'    → coincide con el origen verificado por WalletConnect.
   *  'mismatch' → el origen verificado es OTRO: la firma abre sesión en un sitio
   *               que no es el que la pide.
   *  'unverified' → no hay origen verificado con el que comparar. */
  match: 'match' | 'mismatch' | 'unverified'
}

export type MessageOpts = {
  /** Origen de la petición según WalletConnect, y si el relay lo verificó. */
  origin?: string
  originVerified?: boolean
  /** Esta wallet y la red en la que se va a validar la firma. */
  self?: string
  chainId?: number
}

// La primera línea de EIP-4361 es `[scheme://]domain wants you to sign in with
// your Ethereum account:` y la segunda, la dirección. Se busca en cualquier línea
// y no solo en la primera: un mensaje con texto delante no es SIWE válido para un
// parser estricto, pero sí lo es para alguno laxo, y aquí se prefiere comparar de
// más a no comparar.
const SIWE_HEAD = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\S+) wants you to sign in with your Ethereum account:\r?\n(0x[0-9a-fA-F]{40})?/im
const SIWE_CHAIN = /^Chain ID: *(\d+) *$/im

/** Host (con puerto si no es el de por defecto) de un dominio o url, en minúsculas.
 *  El dominio de SIWE es una authority: si trae `usuario@`, lo que cuenta es lo de
 *  detrás de la arroba, que es a donde de verdad se abre la sesión. */
function hostDe(domain: string, scheme: string): string | null {
  try { return new URL(`${scheme}//${domain}`).host.toLowerCase() } catch { return null }
}

/** Compara un login SIWE con quien lo pide. La firma solo queda atada al dominio
 *  ESCRITO en el mensaje, que lo pone la dApp; el origen verificado lo pone el
 *  relay. Si no coinciden, esa firma sirve para entrar en otro sitio como tú. */
function checkSiwe(texto: string, t: Tr, opts: MessageOpts): { siwe: SiweCheck; level: RiskLevel; warns: string[] } | null {
  const m = SIWE_HEAD.exec(texto)
  if (!m) return null
  const domain = m[2]
  const warns: string[] = []
  let level: RiskLevel = 'safe'
  let match: SiweCheck['match'] = 'unverified'

  let origen: URL | null = null
  try { origen = opts.origin ? new URL(opts.origin) : null } catch { origen = null }
  const scheme = m[1] ? `${m[1].toLowerCase()}:` : (origen?.protocol ?? 'https:')
  const host = hostDe(domain, scheme)

  if (origen && host) {
    const mismo = host === origen.host.toLowerCase() && scheme === origen.protocol
    if (mismo) {
      match = opts.originVerified ? 'match' : 'unverified'
      if (!opts.originVerified) {
        level = 'caution'
        warns.push(t('wc.warnSiweUnverified', { domain }))
      }
    } else if (opts.originVerified) {
      match = 'mismatch'
      level = 'danger'
      warns.push(t('wc.warnSiweMismatch', { domain, origin: origen.host }))
    } else {
      // Sin verificar, el origen lo declara la propia dApp: que no cuadre es raro,
      // pero no es una prueba. Amarillo, y se dice qué no cuadra.
      level = 'caution'
      warns.push(t('wc.warnSiweMismatchUnverified', { domain, origin: origen.host }))
    }
  } else {
    level = 'caution'
    warns.push(t('wc.warnSiweUnverified', { domain }))
  }

  const cuenta = m[3]
  if (cuenta && opts.self && cuenta.toLowerCase() !== opts.self.toLowerCase()) {
    level = worseRisk(level, 'caution')
    warns.push(t('wc.warnSiweAccount', { addr: corta(cuenta) }))
  }
  const cadena = SIWE_CHAIN.exec(texto)?.[1]
  if (cadena && opts.chainId !== undefined && Number(cadena) !== opts.chainId) {
    level = worseRisk(level, 'caution')
    warns.push(t('wc.warnSiweChain', { asked: cadena, net: opts.chainId }))
  }
  return { siwe: { domain, match }, level, warns }
}

// La tabla de caracteres invisibles vive en `lib/textSafety.ts`: aquí se
// ESCAPAN (el usuario tiene que ver que están, porque es lo que va a firmar) y
// en los metadatos de token se BORRAN. Misma clasificación, dos reacciones.

/** Sustituye lo invisible por su código, para que se vea que está. */
function escapar(texto: string): { out: string; bidi: boolean; control: boolean } {
  let out = ''
  let bidi = false
  let control = false
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0
    const esBidi = BIDI.has(c)
    if (!esBidi && !esControl(c)) { out += ch; continue }
    if (esBidi) bidi = true
    else control = true
    out += `\\u${c.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return { out, bidi, control }
}

/**
 * Un `personal_sign` puede traer cualquier cosa. Lo que importa es distinguir
 * "un mensaje que puedes leer" de "algo que solo PARECE un mensaje": 32 bytes en
 * crudo son un hash —firmarlo autoriza lo que sea que se hasheó, y no se ve—, y
 * los caracteres bidireccionales enseñan una frase y firman otra.
 */
export function analyzeMessage(raw: string, t: Tr, opts: MessageOpts = {}): MessageRisk {
  if (!raw) return { level: 'safe', text: '', raw: false }

  let texto = raw
  if (raw.startsWith('0x')) {
    let bytes: Uint8Array | null = null
    try { bytes = hexToBytes(raw as `0x${string}`) } catch { bytes = null }
    if (bytes) {
      if (bytes.length === 32) {
        return { level: 'danger', text: raw, raw: true, warn: t('wc.warnSigHash') }
      }
      try {
        texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        return { level: 'caution', text: raw, raw: true, warn: t('wc.warnSigBinary') }
      }
    }
  }

  const { out, bidi, control } = escapar(texto)
  if (bidi) return { level: 'danger', text: out, raw: true, warn: t('wc.warnSigBidi') }
  if (control) return { level: 'caution', text: out, raw: true, warn: t('wc.warnSigControl') }
  const s = checkSiwe(texto, t, opts)
  if (s) return { level: s.level, text: texto, raw: false, warn: s.warns.join(' · ') || undefined, siwe: s.siwe }
  return { level: 'safe', text: texto, raw: false }
}

// ───────────────────────────────────────────────────────────────────────────
// Verificación de origen (la que WalletConnect ya hacía y la app tiraba)
// ───────────────────────────────────────────────────────────────────────────
export type OriginCheck = {
  origin: string
  /** Sin origen verificado NO se rellena con el chainId: eso es un dato falso
   *  con aspecto de dato bueno. */
  known: boolean
  level: RiskLevel
  label: string
  warn?: string
}

type VerifyCtx = {
  verified?: { origin?: string; validation?: string; isScam?: boolean }
}

/** `verifyContext` lo calcula el relay de WalletConnect comparando el origen real
 *  de la petición con el dominio que la dApp declara en sus metadatos. Llegaba
 *  entero y la app solo usaba el nombre. */
export function checkOrigin(verifyContext: unknown, t: Tr): OriginCheck {
  const v = (verifyContext as VerifyCtx | undefined)?.verified
  const origin = typeof v?.origin === 'string' ? v.origin : ''
  const validation = String(v?.validation ?? 'UNKNOWN').toUpperCase()
  const sinOrigen = { origin: origin || t('connect.unknownOrigin'), known: !!origin }

  if (v?.isScam) {
    return { ...sinOrigen, level: 'danger', label: t('connect.originScam'), warn: t('connect.warnOriginScam') }
  }
  if (validation === 'INVALID') {
    return { ...sinOrigen, level: 'danger', label: t('connect.originInvalid'), warn: t('connect.warnOriginInvalid') }
  }
  if (validation === 'VALID' && origin) {
    return { origin, known: true, level: 'safe', label: t('connect.originValid') }
  }
  return { ...sinOrigen, level: 'caution', label: t('connect.originUnverified') }
}
