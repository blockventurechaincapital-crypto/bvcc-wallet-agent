'use client'
import { useCallback } from 'react'
import { useWalletClient } from 'wagmi'
import { createPublicClient, http, type Hex } from 'viem'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI } from './entrypoint'
import { getNetwork, DEFAULT_NETWORK } from './networks'
import { getUseBundler } from './wcCalls'

// Payload tal cual lo arman los call sites (BigInt serializado a string)
export type SubmitUserOpPayload = {
  chainId?: number
  userOp: {
    sender: `0x${string}`
    nonce: string
    initCode: Hex
    callData: Hex
    accountGasLimits: Hex
    preVerificationGas: string
    gasFees: Hex
    paymasterAndData: Hex
    signature: Hex
  }
}

// Envía un UserOp. Estrategia:
//  1. Intenta el bundler server-side (/api/send-userop) — modo producción (VPS
//     con BUNDLER_PRIVATE_KEY). UX Face ID pura, sin EOA conectada.
//  2. Si el bundler NO está configurado (code BUNDLER_NOT_CONFIGURED), cae al
//     modo self-host/localhost: la wallet conectada (MetaMask/WalletConnect)
//     llama EntryPoint.handleOps y paga el gas — igual que ya hace createWallet.
//     El UserOp sigue firmado por WebAuthn; la EOA solo relayea y paga gas, no
//     puede mover fondos → no rompe el non-custodial.
export function useSubmitUserOp() {
  const { data: walletClient } = useWalletClient()

  return useCallback(async (payload: SubmitUserOpPayload): Promise<{ txHash: string }> => {
    // ── 0. ¿El usuario prefiere pagar su propio gas? ────────────────────────
    // Ajustes → "Quién paga el gas". Si lo desactiva, ni se llama al bundler:
    // se va directo al camino de la wallet conectada, que es el mismo que ya se
    // usa cuando el servidor no tiene bundler configurado.
    if (!getUseBundler()) return await enviarConWalletConectada(payload)

    // ── 1. Bundler server-side ──────────────────────────────────────────────
    const res = await fetch('/api/send-userop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({} as { txHash?: string; error?: string; code?: string }))

    if (res.ok && data.txHash) return { txHash: data.txHash }
    if (data.code !== 'BUNDLER_NOT_CONFIGURED') {
      throw new Error(data.error || 'Error en el bundler')
    }

    // La wallet conectada firma la transaccion y paga el gas. La UserOperation
    // la sigue firmando la passkey: esta EOA solo retransmite, no puede mover
    // fondos. Se usa en dos casos: cuando el servidor no tiene bundler, y cuando
    // el usuario lo ha desactivado en Ajustes.
    async function enviarConWalletConectada(payload: SubmitUserOpPayload): Promise<{ txHash: string }> {
      // ── 2. Fallback: la wallet conectada paga el gas ────────────────────────
      if (!walletClient) {
        throw new Error(
          'No bundler is configured and no wallet is connected to relay the UserOp. ' +
          'Connect a wallet (MetaMask/WalletConnect) with gas, or set BUNDLER_PRIVATE_KEY.'
        )
      }

      const network = payload.chainId
        ? (() => { try { return getNetwork(payload.chainId!) } catch { return DEFAULT_NETWORK } })()
        : DEFAULT_NETWORK

      // La wallet conectada debe estar en la red correcta
      if (walletClient.chain?.id !== network.chainId) {
        await walletClient.switchChain({ id: network.chainId })
      }

      const u = payload.userOp
      const op = {
        sender: u.sender,
        nonce: BigInt(u.nonce),
        initCode: u.initCode,
        callData: u.callData,
        accountGasLimits: u.accountGasLimits,
        preVerificationGas: BigInt(u.preVerificationGas),
        gasFees: u.gasFees,
        paymasterAndData: u.paymasterAndData,
        signature: u.signature,
      }

      const entryPoint = network.contracts.entryPoint || ENTRYPOINT_ADDRESS
      const beneficiary = walletClient.account.address

      const publicClient = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })

      // Simular antes de pedir firma al usuario (evita gastar gas en revert obvio)
      await publicClient.simulateContract({
        address: entryPoint,
        abi: ENTRYPOINT_ABI,
        functionName: 'handleOps',
        args: [[op], beneficiary],
        account: beneficiary,
      })

      // Gas explícito: mismo cálculo que el bundler server-side
      const accountGasLimitsBig = BigInt(op.accountGasLimits)
      const verificationGasLimit = accountGasLimitsBig >> 128n
      const callGasLimit = accountGasLimitsBig & ((1n << 128n) - 1n)
      const gas = op.preVerificationGas + verificationGasLimit + callGasLimit + 100_000n

      const txHash = await walletClient.writeContract({
        address: entryPoint,
        abi: ENTRYPOINT_ABI,
        functionName: 'handleOps',
        args: [[op], beneficiary],
        gas,
      })

    return { txHash }
    }

    // ── 2. Sin bundler en el servidor: lo paga la wallet conectada ─────────
    return await enviarConWalletConectada(payload)
  }, [walletClient])
}
