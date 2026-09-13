'use client'
import { type PublicClient, createPublicClient, http, parseGwei } from 'viem'
import { NETWORKS } from './networks'

/**
 * Tarifa con la que se firma un UserOp.
 *
 * Estaba copiada en seis ficheros (`feeData.maxFeePerGas ?? parseGwei('2')`), lo
 * que garantizaba que tarde o temprano divergieran. Y tenía un problema de fondo:
 * viem estima `maxFeePerGas ≈ baseFee × 1,2`, o sea **menos de dos bloques** de
 * subida máxima de EIP-1559 (12,5 % por bloque).
 *
 * En una wallet normal eso da igual: la transacción es tuya y la reemplazas. Aquí
 * la manda **la EOA del bundler, compartida por todos los usuarios de esa red**:
 * una que no entra bloquea la cola entera hasta que alguien opere y la reemplace.
 *
 * ── Por qué el multiplicador va por TRAMOS y no es una constante ──────────────
 *
 * El techo NO es lo que se paga: se paga `baseFee + propina`. Pero el EntryPoint
 * **reserva** `maxFeePerGas × gas` del saldo de la wallet mientras dura la
 * operación. Esa reserva se libera, pero hay que TENERLA para pasar la validación.
 *
 * Medido con 980.000 de gas y ETH a 1.878 $:
 *
 *   baseFee     coste real   reserva ×1,2   reserva ×2   reserva ×3
 *   0,07 gwei      0 $           0 $           0 $          0 $
 *   5 gwei         9 $          11 $          18 $         28 $
 *   15 gwei       28 $          33 $          55 $         83 $
 *   45 gwei       83 $          99 $         166 $        248 $
 *   80 gwei      147 $         177 $         294 $        442 $
 *
 * Con el gas barato, un margen generoso es gratis. Con el gas caro, un ×2 obliga
 * a la wallet a tener el doble de lo que va a gastar — y una wallet con 150 $ no
 * podría hacer una operación de 83 $.
 *
 * Hay un contraargumento honesto: con el gas alto es cuando más se mueve el base
 * fee, o sea cuando más margen haría falta. Cierto. Pero las consecuencias no son
 * simétricas: **atascarse es recuperable** —reintentar reemplaza a la atascada y
 * desatasca— mientras que **quedarse fuera por reserva es un fallo seguro**: no
 * hay reintento que arregle no tener saldo. Por eso el margen se aprieta cuando
 * el gas sube.
 */

const G = (n: string) => parseGwei(n)
const SIN_LIMITE = 2n ** 128n

type Tramo = { hastaBaseFee: bigint; mult: number }

/**
 * Tramos por red, de menor a mayor base fee. Se aplica el primero que encaje.
 *
 * L2 con secuenciador (Arbitrum, Base): comprobado el 2026-08-11 que rechazan al
 * enviar tanto las tarifas por debajo del base fee como los huecos de nonce, e
 * incluyen casi al instante. Ahí no hay atasco que evitar, así que se deja el
 * 1,2 de viem y no se toca nada.
 */
const TRAMOS: Record<number, Tramo[]> = {
  // ── Ethereum: la cara, y la que de verdad se atasca ──────────────────────
  1: [
    { hastaBaseFee: G('2'), mult: 3 },      // hasta ~6 $ de reserva
    { hastaBaseFee: G('10'), mult: 2 },     // hasta ~37 $
    { hastaBaseFee: G('30'), mult: 1.5 },   // hasta ~83 $
    { hastaBaseFee: SIN_LIMITE, mult: 1.25 },
  ],
  // ── Polygon: base fee de cientos de gwei, pero POL vale céntimos. Una
  //    operación entera cuesta ~0,02 $, así que el margen es casi gratis
  //    incluso arriba; los cortes van mucho más altos que en Ethereum ──────
  137: [
    { hastaBaseFee: G('500'), mult: 3 },
    { hastaBaseFee: G('2000'), mult: 2 },
    { hastaBaseFee: SIN_LIMITE, mult: 1.5 },
  ],
  // ── BSC: el base fee es 0, así que el multiplicador apenas interviene
  //    (el suelo queda en la propina). Se deja por coherencia ──────────────
  56: [
    { hastaBaseFee: G('5'), mult: 3 },
    { hastaBaseFee: SIN_LIMITE, mult: 2 },
  ],
  // ── L2 con secuenciador: sin cambios respecto a lo que ya hacía viem ─────
  42161: [{ hastaBaseFee: SIN_LIMITE, mult: 1.2 }],
  421614: [{ hastaBaseFee: SIN_LIMITE, mult: 1.2 }],
  8453: [{ hastaBaseFee: SIN_LIMITE, mult: 1.2 }],
}

/** Redes que no estén en la tabla: se asume mempool y se es prudente. */
const POR_DEFECTO: Tramo[] = [
  { hastaBaseFee: G('2'), mult: 2 },
  { hastaBaseFee: SIN_LIMITE, mult: 1.5 },
]

export type GasFees = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }

/** Qué multiplicador toca con este base fee en esta red. Exportado para la UI. */
export function multiplicadorPara(chainId: number, baseFee: bigint): number {
  const tramos = TRAMOS[chainId] ?? POR_DEFECTO
  return (tramos.find((t) => baseFee <= t.hastaBaseFee) ?? tramos[tramos.length - 1]).mult
}

type FeeReading = GasFees & { baseFee: bigint }

/** Lo que se firmaría leyendo de este cliente. En modo estricto, null si falta
 *  algún dato: una referencia inventada con los valores por defecto no sirve. */
async function feesFrom(client: PublicClient, chainId: number, strict: boolean): Promise<FeeReading | null> {
  const [fees, block] = await Promise.all([
    client.estimateFeesPerGas().catch(() => null),
    client.getBlock({ blockTag: 'latest' }).catch(() => null),
  ])
  if (strict && (!fees || !block)) return null

  const estimado = fees?.maxFeePerGas ?? parseGwei('2')
  const propina = fees?.maxPriorityFeePerGas ?? parseGwei('0.1')
  const baseFee = block?.baseFeePerGas ?? 0n

  const mult = multiplicadorPara(chainId, baseFee)
  // Los multiplicadores llevan decimal: se opera en centésimas con enteros.
  const suelo = (baseFee * BigInt(Math.round(mult * 100))) / 100n + propina

  return {
    maxFeePerGas: suelo > estimado ? suelo : estimado,
    maxPriorityFeePerGas: propina,
    baseFee,
  }
}

/**
 * ── Contraste con un segundo proveedor ──────────────────────────────────────
 *
 * Todo lo de arriba sale del RPC, y un RPC que mienta mueve a la vez la
 * estimación y el base fee: contra sí mismo no hay tope que valga. Así que se
 * repite el MISMO cálculo contra el RPC de reserva de la red (otro operador) y
 * no se firma por encima de REFERENCE_SLACK veces lo que dé.
 *
 * Qué evita: con una tarifa inflada, el EntryPoint reserva `maxFee × gas` del
 * saldo (AA21 y fondos bloqueados) y la wallet PAGA `propina + base fee` por
 * gas a quien mande la operación. El servidor ya rechaza lo que pase de 20× su
 * estimación (app/api/send-userop), pero una operación firmada que va por la
 * wallet conectada no pasa por ahí, y en una mempool pública la puede reenviar
 * cualquiera cobrándose esa propina.
 *
 * Por qué ×3: medido el 2026-09-13 en las 6 redes, dos proveedores honrados
 * pedidos a la vez dan cocientes entre 0,97 y 1,02. ×3 deja sitio para varios
 * bloques de desfase en plena subida y aun así corta cualquier inflado grande.
 * Y queda por debajo del ×20 del servidor: lo que el cliente firma, el servidor
 * no lo rechaza por caro.
 *
 * Si la reserva no contesta, se firma sin contraste: bloquear las firmas porque
 * el RPC de repuesto está caído sería peor que el riesgo que cubre.
 */
const REFERENCE_SLACK = 3n
const REFERENCE_TIMEOUT_MS = 4_000

function referenceClient(chainId: number): PublicClient | null {
  const n = NETWORKS.find((x) => x.chainId === chainId)
  if (!n || n.rpcUrls.length < 2) return null
  return createPublicClient({
    chain: n.viemChain,
    transport: http(n.rpcUrls[1], { retryCount: 0, timeout: REFERENCE_TIMEOUT_MS }),
  }) as PublicClient
}

/** Recorta la tarifa a REFERENCE_SLACK veces la de referencia. Exportado para las pruebas. */
export function capToReference(own: GasFees, ref: FeeReading): GasFees {
  // La propina se acota también contra el base fee: en Arbitrum la estimación de
  // propina es 0, y un tope de 0 × 3 no dejaría ninguna. En BSC es al revés (base
  // fee 0, propina 0,05 gwei). Si la referencia no da ninguno de los dos, no hay
  // con qué comparar y no se toca.
  const tipRef = ref.maxPriorityFeePerGas * REFERENCE_SLACK > ref.baseFee
    ? ref.maxPriorityFeePerGas * REFERENCE_SLACK
    : ref.baseFee
  const feeRef = ref.maxFeePerGas * REFERENCE_SLACK

  const tip = tipRef > 0n && own.maxPriorityFeePerGas > tipRef ? tipRef : own.maxPriorityFeePerGas
  let maxFee = feeRef > 0n && own.maxFeePerGas > feeRef ? feeRef : own.maxFeePerGas
  if (maxFee < tip) maxFee = tip
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip }
}

/**
 * Tarifa sugerida para firmar. Se queda con lo más alto entre lo que estima viem
 * y `baseFee × multiplicador`, así que **nunca baja** de lo que ya se hacía, y
 * después se contrasta con el RPC de reserva (ver arriba).
 */
export async function suggestGasFees(
  client: PublicClient,
  chainId: number,
  reference: PublicClient | null = referenceClient(chainId),
): Promise<GasFees> {
  const [own, ref] = await Promise.all([
    feesFrom(client, chainId, false),
    reference ? feesFrom(reference, chainId, true) : Promise.resolve(null),
  ])
  const fees: GasFees = { maxFeePerGas: own!.maxFeePerGas, maxPriorityFeePerGas: own!.maxPriorityFeePerGas }
  if (!ref) return fees

  const capped = capToReference(fees, ref)
  if (capped.maxFeePerGas !== fees.maxFeePerGas || capped.maxPriorityFeePerGas !== fees.maxPriorityFeePerGas) {
    console.warn('[gasFees] the RPC fee is far above the reference RPC; capped before signing', {
      chainId, own: fees, capped,
    })
  }
  return capped
}
