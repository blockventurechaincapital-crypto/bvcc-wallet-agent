// Port mínimo de TickMath + LiquidityAmounts de Uniswap v3/v4 — solo lo que
// usamos para mostrar cuánto vale una posición LP (montos de cada token).
const Q96 = 2n ** 96n
const MAX_UINT256 = 2n ** 256n - 1n

// sqrtPriceX96 en el límite de un tick. Port directo de TickMath.getSqrtRatioAtTick.
export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(Math.abs(tick))
  let ratio = (absTick & 0x1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n
  const muls: [bigint, bigint][] = [
    [0x2n, 0xfff97272373d413259a46990580e213an],
    [0x4n, 0xfff2e50f5f656932ef12357cf3c7fdccn],
    [0x8n, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [0x10n, 0xffcb9843d60f6159c9db58835c926644n],
    [0x20n, 0xff973b41fa98c081472e6896dfb254c0n],
    [0x40n, 0xff2ea16466c96a3843ec78b326b52861n],
    [0x80n, 0xfe5dee046a99a2a811c461f1969c3053n],
    [0x100n, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [0x200n, 0xf987a7253ac413176f2b074cf7815e54n],
    [0x400n, 0xf3392b0822b70005940c7a398e4b70f3n],
    [0x800n, 0xe7159475a2c29b7443b29c7fa6e889d9n],
    [0x1000n, 0xd097f3bdfd2022b8845ad8f792aa5825n],
    [0x2000n, 0xa9f746462d870fdf8a65dc1f90e061e5n],
    [0x4000n, 0x70d869a156d2a1b890bb3df62baf32f7n],
    [0x8000n, 0x31be135f97d08fd981231505542fcfa6n],
    [0x10000n, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [0x20000n, 0x5d6af8dedb81196699c329225ee604n],
    [0x40000n, 0x2216e584f5fa1ea926041bedfe98n],
    [0x80000n, 0x48a170391f7dc42444e8fa2n],
  ]
  for (const [bit, m] of muls) if ((absTick & bit) !== 0n) ratio = (ratio * m) >> 128n
  if (tick > 0) ratio = MAX_UINT256 / ratio
  // de Q128.128 a Q96 (sqrtPriceX96), redondeo hacia arriba
  return (ratio >> 32n) + ((ratio & ((1n << 32n) - 1n)) === 0n ? 0n : 1n)
}

const Q128 = 2n ** 128n
const MASK256 = (1n << 256n) - 1n

// Comisiones devengadas = (feeGrowthInside_actual − feeGrowthInside_last) · L / 2^128.
// Las restas envuelven mod 2^256 (así lo hace el contrato).
export function feesFromGrowth(insideCurrent: bigint, insideLast: bigint, liquidity: bigint): bigint {
  return (((insideCurrent - insideLast) & MASK256) * liquidity) / Q128
}

// feeGrowthInside de una posición v3 (fórmula del whitepaper Uniswap v3).
export function v3FeeGrowthInside(global: bigint, currentTick: number, tickLower: number, tickUpper: number, lowerOutside: bigint, upperOutside: bigint): bigint {
  const below = currentTick >= tickLower ? lowerOutside : (global - lowerOutside) & MASK256
  const above = currentTick < tickUpper ? upperOutside : (global - upperOutside) & MASK256
  return (global - below - above) & MASK256
}

// Cuánto de token0 y token1 representa una liquidez L a un precio actual dado.
export function amountsForLiquidity(sqrtP: bigint, tickLower: number, tickUpper: number, L: bigint): { amount0: bigint; amount1: bigint } {
  let sa = getSqrtRatioAtTick(tickLower)
  let sb = getSqrtRatioAtTick(tickUpper)
  if (sa > sb) [sa, sb] = [sb, sa]
  let amount0 = 0n
  let amount1 = 0n
  if (sqrtP <= sa) {
    amount0 = (L << 96n) * (sb - sa) / sb / sa   // por debajo del rango → todo token0
  } else if (sqrtP < sb) {
    amount0 = (L << 96n) * (sb - sqrtP) / sb / sqrtP
    amount1 = L * (sqrtP - sa) / Q96
  } else {
    amount1 = L * (sb - sa) / Q96                // por encima del rango → todo token1
  }
  return { amount0, amount1 }
}
