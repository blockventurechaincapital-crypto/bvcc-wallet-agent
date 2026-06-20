'use client'
import { createPublicClient, http, encodeAbiParameters, encodeFunctionData, parseGwei, type Address, type Hex } from 'viem'
import { authenticateWebAuthn } from './webauthn'
import { BVCC_WALLET_ABI } from './abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from './entrypoint'
import type { NetworkConfig } from './networks'
import type { SubmitUserOpPayload } from './useSubmitUserOp'

// Una llamada del batch ERC-7821 (target + value + calldata).
export type ExecCall = { target: Address; value?: bigint; callData?: Hex }

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}
function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

// Construye un userOp ERC-4337 con N llamadas (ERC-7821 batch), lo firma con
// Face ID (WebAuthn) y lo envía (bundler o fallback wallet conectada). Misma
// lógica que send/page.tsx y WcConnectModal, extraída para reusar en otras
// páginas (revocar allowances, gestionar posiciones, etc.).
export async function executeWithFaceId(opts: {
  network: NetworkConfig
  walletAddress: Address
  credentialId: string
  calls: ExecCall[]
  submitUserOp: (p: SubmitUserOpPayload) => Promise<{ txHash: string }>
  callGasLimit?: bigint
}): Promise<string> {
  const { network, walletAddress, credentialId, calls, submitUserOp } = opts
  if (!calls.length) throw new Error('No hay llamadas que ejecutar')

  const publicClient = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })

  const nonce = await publicClient.readContract({
    address: walletAddress, abi: BVCC_WALLET_ABI, functionName: 'getNonce', args: [],
  }) as bigint

  const executionData = encodeAbiParameters(
    [{ type: 'tuple[]', components: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ] }],
    [calls.map((c) => ({ target: c.target, value: c.value ?? 0n, callData: (c.callData ?? '0x') as Hex }))],
  )
  const callData = encodeFunctionData({ abi: BVCC_WALLET_ABI, functionName: 'execute', args: [BATCH_MODE, executionData] })

  const feeData = await publicClient.estimateFeesPerGas()
  const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('2')
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')

  const userOp = {
    sender: walletAddress,
    nonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits: packBytes32(400_000n, opts.callGasLimit ?? 500_000n),
    preVerificationGas: 80_000n,
    gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData: '0x' as Hex,
    signature: '0x' as Hex,
  }

  const userOpHash = await publicClient.readContract({
    address: ENTRYPOINT_ADDRESS, abi: ENTRYPOINT_ABI, functionName: 'getUserOpHash', args: [userOp],
  }) as Hex

  const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
    await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))
  const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataHex))
  const challengeIndex = BigInt(clientDataStr.indexOf('"challenge":'))
  const typeIndex = BigInt(clientDataStr.indexOf('"type":'))

  const signature = encodeAbiParameters(
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
      challengeIndex, typeIndex, authenticatorData, clientDataStr,
    ],
  )

  const { txHash } = await submitUserOp({
    chainId: network.chainId,
    userOp: { ...userOp, nonce: nonce.toString(), preVerificationGas: userOp.preVerificationGas.toString(), signature },
  })
  return txHash
}
