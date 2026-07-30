import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem'
import { V3_NFPM, V4_PM } from './defiContracts'
import type { ExecCall } from './executeUserOp'
import type { LpPosition } from './useLpPositions'

const MAX_U128 = (1n << 128n) - 1n

// v3: collect(tokenId, recipient, amount0Max, amount1Max). El NFPM hace un "poke"
// (pool.burn 0) antes de cobrar, así que incluye también las fees frescas.
const V3_COLLECT_ABI = [{
  type: 'function', name: 'collect', stateMutability: 'payable',
  inputs: [{ type: 'tuple', components: [
    { name: 'tokenId', type: 'uint256' }, { name: 'recipient', type: 'address' },
    { name: 'amount0Max', type: 'uint128' }, { name: 'amount1Max', type: 'uint128' },
  ] }],
  outputs: [{ type: 'uint256' }, { type: 'uint256' }],
}] as const

const V4_MODIFY_ABI = [{
  type: 'function', name: 'modifyLiquidities', stateMutability: 'payable',
  inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [],
}] as const

// Construye la llamada para reclamar las comisiones de una posición LP.
export function buildClaimCall(p: LpPosition, recipient: Address, chainId: number): ExecCall {
  if (p.version === 3) {
    const callData = encodeFunctionData({
      abi: V3_COLLECT_ABI, functionName: 'collect',
      args: [{ tokenId: p.tokenId, recipient, amount0Max: MAX_U128, amount1Max: MAX_U128 }],
    })
    return { target: V3_NFPM[chainId], callData }
  }

  // v4: DECREASE_LIQUIDITY(0x01) con liquidez 0 acumula las fees; TAKE_PAIR(0x11)
  // las envía al recipient. unlockData = abi.encode(bytes actions, bytes[] params).
  const actions = '0x0111' as Hex
  const decreaseParams = encodeAbiParameters(
    parseAbiParameters('uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes hookData'),
    [p.tokenId, 0n, 0n, 0n, '0x'],
  )
  const takeParams = encodeAbiParameters(
    parseAbiParameters('address currency0, address currency1, address recipient'),
    [p.token0, p.token1, recipient],
  )
  const unlockData = encodeAbiParameters(
    parseAbiParameters('bytes actions, bytes[] params'),
    [actions, [decreaseParams, takeParams]],
  )
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
  const callData = encodeFunctionData({ abi: V4_MODIFY_ABI, functionName: 'modifyLiquidities', args: [unlockData, deadline] })
  return { target: V4_PM[chainId], callData }
}

// v3: decreaseLiquidity + collect + burn se envían juntos por el multicall del NFPM,
// así una sola firma cierra la posición entera.
const V3_CLOSE_ABI = [
  { type: 'function', name: 'decreaseLiquidity', stateMutability: 'payable', inputs: [{ type: 'tuple', components: [
    { name: 'tokenId', type: 'uint256' }, { name: 'liquidity', type: 'uint128' },
    { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ] }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'function', name: 'collect', stateMutability: 'payable', inputs: [{ type: 'tuple', components: [
    { name: 'tokenId', type: 'uint256' }, { name: 'recipient', type: 'address' },
    { name: 'amount0Max', type: 'uint128' }, { name: 'amount1Max', type: 'uint128' },
  ] }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'function', name: 'burn', stateMutability: 'payable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'multicall', stateMutability: 'payable', inputs: [{ type: 'bytes[]' }], outputs: [{ type: 'bytes[]' }] },
] as const

/**
 * Cierra `bps` diezmilésimas de una posición (10000 = toda) y manda lo retirado y las
 * comisiones al `recipient`. Al cerrar del todo, el NFT se quema: dejarlo vacío solo
 * ensucia la lista.
 *
 * Los mínimos salen de los montos ya leídos, escalados por el porcentaje y con el
 * slippage restado. Mandar 0 abriría la puerta a que un sandwich se quedara con la
 * salida; esto es dinero saliendo del pool, no una consulta.
 */
export function buildCloseCall(
  p: LpPosition, recipient: Address, chainId: number, bps: number, slippageBps = 50,
): ExecCall {
  const share = BigInt(Math.max(1, Math.min(10000, Math.round(bps))))
  const liquidity = (p.liquidity * share) / 10000n
  const keep = BigInt(10000 - slippageBps)
  const min0 = (p.amount0 * share * keep) / 100000000n
  const min1 = (p.amount1 * share * keep) / 100000000n
  const full = share === 10000n
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

  if (p.version === 3) {
    const calls: Hex[] = [
      encodeFunctionData({ abi: V3_CLOSE_ABI, functionName: 'decreaseLiquidity',
        args: [{ tokenId: p.tokenId, liquidity, amount0Min: min0, amount1Min: min1, deadline }] }),
      // collect va después: recoge lo que decrease acaba de liberar y las fees pendientes.
      encodeFunctionData({ abi: V3_CLOSE_ABI, functionName: 'collect',
        args: [{ tokenId: p.tokenId, recipient, amount0Max: MAX_U128, amount1Max: MAX_U128 }] }),
    ]
    if (full) calls.push(encodeFunctionData({ abi: V3_CLOSE_ABI, functionName: 'burn', args: [p.tokenId] }))
    const callData = encodeFunctionData({ abi: V3_CLOSE_ABI, functionName: 'multicall', args: [calls] })
    return { target: V3_NFPM[chainId], callData }
  }

  // v4: DECREASE_LIQUIDITY(0x01) + TAKE_PAIR(0x11), y BURN_POSITION(0x03) si se cierra
  // entera. El burn de v4 exige que la posición ya esté vacía, así que va el último.
  const actions = (full ? '0x011103' : '0x0111') as Hex
  const params: Hex[] = [
    encodeAbiParameters(
      parseAbiParameters('uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes hookData'),
      [p.tokenId, liquidity, min0, min1, '0x'],
    ),
    encodeAbiParameters(
      parseAbiParameters('address currency0, address currency1, address recipient'),
      [p.token0, p.token1, recipient],
    ),
  ]
  if (full) {
    params.push(encodeAbiParameters(
      parseAbiParameters('uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData'),
      [p.tokenId, 0n, 0n, '0x'],
    ))
  }
  const unlockData = encodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'), [actions, params])
  const callData = encodeFunctionData({ abi: V4_MODIFY_ABI, functionName: 'modifyLiquidities', args: [unlockData, deadline] })
  return { target: V4_PM[chainId], callData }
}
