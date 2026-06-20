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
