import { createWalletClient, createPublicClient, http, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI } from '@/lib/entrypoint'
import { getNetwork } from '@/lib/networks'
import { DEFAULT_NETWORK } from '@/lib/networks'
import type { NetworkConfig } from '@/lib/networks'

// walletType(): BVCCSmartWalletV1 → 0, BVCCAgentWalletV1 → 1
const WALLET_TYPE_ABI = [{
  name: 'walletType',
  type: 'function',
  inputs: [],
  outputs: [{ name: '', type: 'uint8' }],
  stateMutability: 'view',
}] as const

// Acepta solo UserOps cuyo sender sea una BVCC Wallet / Agent Wallet.
// Anti gas-drain: el bundler firma y paga gas, no debe adelantar gas por
// cuentas ajenas. Deployed → walletType() ∈ {0,1}. Counterfactual → la
// factory embebida en initCode debe ser una de NUESTRAS factories (el
// EntryPoint ya verifica que la address CREATE2 resultante == sender).
async function assertBVCCSender(
  publicClient: ReturnType<typeof createPublicClient>,
  network: NetworkConfig,
  sender: `0x${string}`,
  initCode: `0x${string}`,
): Promise<void> {
  const code = await publicClient.getCode({ address: sender })

  if (code && code !== '0x') {
    let wt: number
    try {
      wt = await publicClient.readContract({
        address: sender,
        abi: WALLET_TYPE_ABI,
        functionName: 'walletType',
      })
    } catch {
      throw new Error('Sender is not a BVCC wallet (walletType() reverted)')
    }
    if (wt !== 0 && wt !== 1) throw new Error(`Sender has unexpected walletType ${wt}`)
    return
  }

  // No desplegado: exigir initCode con una de nuestras factories
  if (!initCode || initCode.length < 42) {
    throw new Error('Undeployed sender requires initCode pointing to a BVCC factory')
  }
  const factory = getAddress(('0x' + initCode.slice(2, 42)) as `0x${string}`)
  const ours = [network.contracts.factory, network.contracts.agentFactory]
    .filter(Boolean)
    .map((a) => getAddress(a as `0x${string}`))
  if (!ours.includes(factory)) {
    throw new Error('initCode factory is not a BVCC factory')
  }
}

export async function POST(req: Request) {
  try {
    const bundlerKey = process.env.BUNDLER_PRIVATE_KEY
    if (!bundlerKey) {
      // Señal para que el cliente caiga al fallback (wallet conectada paga gas)
      return Response.json(
        { error: 'Bundler not configured', code: 'BUNDLER_NOT_CONFIGURED' },
        { status: 501 },
      )
    }

    const body = await req.json() as {
      chainId?: number
      userOp: {
        sender: `0x${string}`
        nonce: string
        initCode: `0x${string}`
        callData: `0x${string}`
        accountGasLimits: `0x${string}`
        preVerificationGas: string
        gasFees: `0x${string}`
        paymasterAndData: `0x${string}`
        signature: `0x${string}`
      }
    }

    // Resolve network from chainId (default to Arbitrum Sepolia)
    const network = body.chainId ? (() => {
      try { return getNetwork(body.chainId!) } catch { return DEFAULT_NETWORK }
    })() : DEFAULT_NETWORK

    const { userOp } = body

    // JSON transfers BigInt as string — convert back
    const op = {
      sender: userOp.sender,
      nonce: BigInt(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: userOp.accountGasLimits,
      preVerificationGas: BigInt(userOp.preVerificationGas),
      gasFees: userOp.gasFees,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    }

    const account = privateKeyToAccount(bundlerKey as `0x${string}`)

    const walletClient = createWalletClient({
      account,
      chain: network.viemChain,
      transport: http(network.rpcUrl),
    })

    const publicClient = createPublicClient({
      chain: network.viemChain,
      transport: http(network.rpcUrl),
    })

    // Use network's entryPoint address (same OZ v0.9 across chains)
    const entryPoint = network.contracts.entryPoint || ENTRYPOINT_ADDRESS

    // Anti gas-drain: rechazar senders que no sean BVCC Wallet/Agent Wallet
    await assertBVCCSender(publicClient, network, op.sender, op.initCode)

    // Simulate first to catch obvious errors before spending gas
    await publicClient.simulateContract({
      address: entryPoint,
      abi: ENTRYPOINT_ABI,
      functionName: 'handleOps',
      args: [[op], account.address],
      account: account.address,
    })

    // Calcular gas explícito: preVerificationGas + verificationGasLimit + callGasLimit + overhead EntryPoint
    const accountGasLimitsBig = BigInt(op.accountGasLimits)
    const verificationGasLimit = accountGasLimitsBig >> 128n
    const callGasLimit = accountGasLimitsBig & ((1n << 128n) - 1n)
    const txGasLimit = op.preVerificationGas + verificationGasLimit + callGasLimit + 100_000n

    const txHash = await walletClient.writeContract({
      address: entryPoint,
      abi: ENTRYPOINT_ABI,
      functionName: 'handleOps',
      args: [[op], account.address],
      gas: txGasLimit,
    })

    return Response.json({ txHash })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[send-userop]', msg)
    return Response.json({ error: msg }, { status: 400 })
  }
}
