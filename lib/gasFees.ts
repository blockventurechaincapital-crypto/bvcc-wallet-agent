'use client'
import { type PublicClient, parseGwei } from 'viem'

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

/**
 * Tarifa sugerida para firmar. Se queda con lo más alto entre lo que estima viem
 * y `baseFee × multiplicador`, así que **nunca baja** de lo que ya se hacía.
 */
export async function suggestGasFees(client: PublicClient, chainId: number): Promise<GasFees> {
  const [fees, block] = await Promise.all([
    client.estimateFeesPerGas().catch(() => null),
    client.getBlock({ blockTag: 'latest' }).catch(() => null),
  ])

  const estimado = fees?.maxFeePerGas ?? parseGwei('2')
  const propina = fees?.maxPriorityFeePerGas ?? parseGwei('0.1')
  const baseFee = block?.baseFeePerGas ?? 0n

  const mult = multiplicadorPara(chainId, baseFee)
  // Los multiplicadores llevan decimal: se opera en centésimas con enteros.
  const suelo = (baseFee * BigInt(Math.round(mult * 100))) / 100n + propina

  return {
    maxFeePerGas: suelo > estimado ? suelo : estimado,
    maxPriorityFeePerGas: propina,
  }
}
