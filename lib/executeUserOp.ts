'use client'
import { createPublicClient, http, encodeAbiParameters, encodeFunctionData, type Address, type Hex } from 'viem'
import { authenticateWebAuthn } from './webauthn'
import { BVCC_WALLET_ABI } from './abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from './entrypoint'
import type { NetworkConfig } from './networks'
import type { SubmitUserOpPayload } from './useSubmitUserOp'
import { waitForUserOp } from './waitForUserOp'
import { suggestGasFees } from './gasFees'

// Una llamada del batch ERC-7821 (target + value + calldata).
export type ExecCall = { target: Address; value?: bigint; callData?: Hex }

// Presupuesto de gas del userOp. Exportado porque el EntryPoint cobra el prefund
// (maxFeePerGas x este total) del saldo de la propia wallet: quien tenga que dejarla
// financiada necesita el mismo numero, y si se duplicara acabarian divergiendo.
export const USEROP_VERIFICATION_GAS = 400_000n
export const USEROP_CALL_GAS = 500_000n
export const USEROP_PREVERIFICATION_GAS = 80_000n
export const USEROP_TOTAL_GAS =
  USEROP_VERIFICATION_GAS + USEROP_CALL_GAS + USEROP_PREVERIFICATION_GAS

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
  /** Por defecto espera el desenlace y lanza si la operación no salió. */
  esperar?: boolean
}): Promise<string> {
  const { network, walletAddress, credentialId, calls, submitUserOp } = opts
  if (!calls.length) throw new Error('Nothing to execute')

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

  const { maxFeePerGas, maxPriorityFeePerGas } = await suggestGasFees(publicClient, network.chainId)

  const userOp = {
    sender: walletAddress,
    nonce,
    initCode: '0x' as Hex,
    callData,
    accountGasLimits: packBytes32(USEROP_VERIFICATION_GAS, opts.callGasLimit ?? USEROP_CALL_GAS),
    preVerificationGas: USEROP_PREVERIFICATION_GAS,
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

  // Tener el hash NO es haber hecho la operación. Antes se devolvía aquí y todos
  // los que llaman a esto —LP, allowances, guardianes, agentes, alta— daban la
  // operación por buena. Dos formas de equivocarse:
  //   · la transacción la reemplaza otra del bundler (una sola EOA compartida)
  //     y nunca llega a minarse
  //   · se mina con `status: success` pero la UserOperation falla dentro (un
  //     préstamo o un LP que revierte), y el EntryPoint cobra igual
  // Se lanza excepción en vez de devolver el desenlace para no tener que tocar a
  // los cinco que llaman: todos hacen `await` dentro de try/catch.
  if (opts.esperar !== false) {
    const res = await waitForUserOp(txHash as Hex, network, { wallet: walletAddress })
    if (res.estado === 'fallida') {
      const e = new Error(res.donde === 'ejecucion'
        ? 'The operation ran but did not complete. Gas was charged.'
        : 'The network rejected the operation before running it. Nothing moved.')
      ;(e as Error & { code?: string }).code = res.donde === 'ejecucion' ? 'OP_EXECUTION_FAILED' : 'OP_VALIDATION_FAILED'
      throw e
    }
    if (res.estado === 'reemplazada') {
      const e = new Error('Another transaction took its place before this one confirmed. Nothing moved — try again.')
      ;(e as Error & { code?: string }).code = 'OP_REPLACED'
      throw e
    }
    // `pendiente` no es un fallo: puede confirmar más tarde. Se devuelve el hash
    // y quien llama decide; forzar un error aquí sería mentir al revés.
  }
  return txHash
}
