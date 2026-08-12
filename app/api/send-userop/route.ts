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

// ───────────────────────────────────────────────────────────────────────────
// Topes de gas
// ───────────────────────────────────────────────────────────────────────────
// El cliente elige estos tres valores y hasta ahora se copiaban del cuerpo de la
// petición sin techo. Los números salen de lo que pide la ruta más cara de la app,
// con margen; el techo tiene que estorbar al abuso, no a un swap:
//
//   verificationGasLimit  400k (executeUserOp, WalletConnect) · 600k (swap) · 1,5M (agentes)
//   callGasLimit          500k por defecto · 1,2M (swap) · 1,5M (agentes) ·
//                         hasta getMaxGas() en WalletConnect = 3M en L1, 8M en L2,
//                         y el usuario puede subirlo en Ajustes sin límite (lib/wcCalls.ts:45)
//   preVerificationGas    80k (todas) · 300k (agentes)
const MAX_VERIFICATION_GAS = 2_000_000n
const MAX_CALL_GAS = 12_000_000n
const MAX_PREVERIFICATION_GAS = 1_000_000n

// El `preVerificationGas` también necesita SUELO, y por el mismo motivo que la tarifa:
// es lo que la cuenta le paga al bundler por el trabajo que el EntryPoint no le cobra
// a nadie (calldata, overhead del bucle). Bajarlo a cero no impide que la operación se
// ejecute — solo hace que el bundler cobre menos de lo que le cuesta.
//
// Medido sobre una operación real en Arbitrum One (tx 0x3dce0dd3…, 2026-08-10):
//   preVerificationGas = 80.000 → cobra 0,00000360862 / paga 0,00000222568 → +0,0000014 ETH
//   preVerificationGas = 0      → cobra 0,00000200862 / paga 0,00000222568 → −0,0000002 ETH
//
// El punto de equilibrio de esa operación estaba en ~10.900. Todas las rutas de la app
// firman 80.000 (300.000 la de agentes), así que 40.000 deja holgura de sobra y aun así
// deja al bundler en positivo. No se sube a 80.000 para no atarlo al valor exacto que
// hoy usa el cliente.
const MIN_PREVERIFICATION_GAS = 40_000n

// ───────────────────────────────────────────────────────────────────────────
// Banda de tarifa
// ───────────────────────────────────────────────────────────────────────────
// El EntryPoint reembolsa al bundler min(maxFeePerGas, maxPriorityFeePerGas + basefee)
// del UserOp. Si la transacción sale a precio de mercado —que es lo que hace viem si no
// se le pasan tarifas— un UserOp con maxFeePerGas = 1 wei se lleva el gas del bundler y
// le devuelve nada. Hacen falta las dos cotas, y por motivos opuestos:
//
//   SUELO   maxFeePerGas por debajo del base fee = transacción que no se mina. Medido el
//           2026-08-10: Arbitrum Sepolia la RECHAZA al enviar ("The fee cap cannot be
//           lower than the block base fee") sin consumir nonce, que es el caso bueno. No
//           todas las cadenas lo hacen, y el bundler es una sola EOA: una transacción
//           colgada bloquea la cola entera. El margen del 12,5 % es exactamente un bloque
//           de subida máxima de EIP-1559.
//
//   TECHO   protege de un error del cliente, no de un atacante — al atacante lo para el
//           envío con tarifas derivadas del UserOp (abajo). Por eso es generoso.
//
// El margen del suelo no puede subirse a la ligera: el cliente firma con
// estimateFeesPerGas(), y medido el 2026-08-10 eso da maxFee/baseFee = 1,20 en Arbitrum
// Sepolia y Arbitrum One (propina 0), 1,20 en Ethereum, 1,32 en Polygon, 1,40 en Base.
// Con 12,5 % de suelo, en la peor de esas redes todavía quedan ~6,7 puntos de holgura
// para que el base fee se mueva entre la firma y el envío. Un suelo de 25 % rechazaría
// todas las operaciones legítimas de Arbitrum, que es la red principal de la app.
const FEE_FLOOR_MARGIN_BPS = 1_250n   // +12,5 % sobre el base fee del último bloque
const FEE_CEILING_MULTIPLIER = 20n    // × el maxFeePerGas estimado de la red
const BPS = 10_000n

// Códigos estables para el cliente. El mensaje crudo del nodo se queda en el servidor.
type FailCode =
  | 'BUNDLER_NOT_CONFIGURED'
  | 'INVALID_USEROP'
  | 'SENDER_NOT_BVCC'
  | 'GAS_LIMIT_TOO_HIGH'
  | 'GAS_LIMIT_TOO_LOW'
  | 'PAYMASTER_NOT_ALLOWED'
  | 'FEE_TOO_LOW'
  | 'FEE_TOO_HIGH'
  | 'FEE_INVALID'
  | 'WALLET_NEEDS_FUNDS'
  | 'SIGNATURE_REJECTED'
  | 'NONCE_STALE'
  | 'CALL_NOT_ALLOWED'
  | 'BUNDLER_UNAVAILABLE'
  | 'OP_REJECTED'

function fail(code: FailCode, error: string, status = 400): Response {
  return Response.json({ error, code }, { status })
}

// Errores conocidos → código estable + texto que le sirva a quien lo lee. Lo que no
// esté aquí sale como OP_REJECTED genérico: el mensaje del nodo puede llevar direcciones,
// URLs de RPC con clave y trazas internas, y no tiene por qué viajar al navegador.
const KNOWN_ERRORS: { match: RegExp; code: FailCode; error: string }[] = [
  { match: /not a BVCC wallet|BVCC factory|unexpected walletType|requires initCode/i,
    code: 'SENDER_NOT_BVCC',
    error: 'This bundler only relays operations for BVCC wallets.' },
  { match: /AA21|didn't pay prefund/i, code: 'WALLET_NEEDS_FUNDS',
    error: 'The wallet cannot cover this operation. Fund it and try again.' },
  { match: /AA24|signature error/i, code: 'SIGNATURE_REJECTED',
    error: 'The wallet rejected the signature. Sign again with the passkey that owns it.' },
  { match: /AA25|invalid account nonce/i, code: 'NONCE_STALE',
    error: 'This operation is out of date. Reload and sign it again.' },
  { match: /SelectorNotAllowed|TargetNotAllowed|RecipientNotAllowed|LimitExceeded|Expired|Paused/i,
    code: 'CALL_NOT_ALLOWED',
    error: 'The wallet rules do not allow this call.' },
  { match: /fee cap|less than block base fee|base fee/i, code: 'FEE_TOO_LOW',
    error: 'The signed gas price is below the current network fee. Sign again.' },
  { match: /insufficient funds|nonce too low|replacement transaction/i, code: 'BUNDLER_UNAVAILABLE',
    error: 'The bundler cannot relay right now. Try again in a moment.' },
]

function mapError(msg: string): { code: FailCode; error: string } {
  const hit = KNOWN_ERRORS.find((e) => e.match.test(msg))
  if (hit) return { code: hit.code, error: hit.error }
  return { code: 'OP_REJECTED', error: 'The operation was rejected. Check the wallet and try again.' }
}

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
      return fail('BUNDLER_NOT_CONFIGURED', 'Bundler not configured', 501)
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
    if (!userOp || typeof userOp !== 'object') {
      return fail('INVALID_USEROP', 'Missing userOp')
    }

    // JSON transfers BigInt as string — convert back
    let op: {
      sender: `0x${string}`
      nonce: bigint
      initCode: `0x${string}`
      callData: `0x${string}`
      accountGasLimits: `0x${string}`
      preVerificationGas: bigint
      gasFees: `0x${string}`
      paymasterAndData: `0x${string}`
      signature: `0x${string}`
    }
    try {
      op = {
        sender: getAddress(userOp.sender),
        nonce: BigInt(userOp.nonce),
        initCode: userOp.initCode,
        callData: userOp.callData,
        accountGasLimits: userOp.accountGasLimits,
        preVerificationGas: BigInt(userOp.preVerificationGas),
        gasFees: userOp.gasFees,
        paymasterAndData: userOp.paymasterAndData,
        signature: userOp.signature,
      }
    } catch {
      return fail('INVALID_USEROP', 'The userOp fields are malformed')
    }

    // ── Desempaquetar y acotar, antes de gastar una sola llamada RPC ──────────
    // Los dos campos son dos uint128 empaquetados en un bytes32 (lib/executeUserOp.ts:21):
    //   accountGasLimits = verificationGasLimit (alta) | callGasLimit (baja)
    //   gasFees          = maxPriorityFeePerGas (alta) | maxFeePerGas (baja)
    const LOW_128 = (1n << 128n) - 1n
    let verificationGasLimit: bigint, callGasLimit: bigint
    let maxPriorityFeePerGas: bigint, maxFeePerGas: bigint
    try {
      const packedLimits = BigInt(op.accountGasLimits)
      verificationGasLimit = packedLimits >> 128n
      callGasLimit = packedLimits & LOW_128
      const packedFees = BigInt(op.gasFees)
      maxPriorityFeePerGas = packedFees >> 128n
      maxFeePerGas = packedFees & LOW_128
    } catch {
      return fail('INVALID_USEROP', 'accountGasLimits / gasFees are not valid bytes32')
    }

    if (verificationGasLimit > MAX_VERIFICATION_GAS) {
      return fail('GAS_LIMIT_TOO_HIGH', 'verificationGasLimit is above the allowed maximum')
    }
    if (callGasLimit > MAX_CALL_GAS) {
      return fail('GAS_LIMIT_TOO_HIGH', 'callGasLimit is above the allowed maximum')
    }
    if (op.preVerificationGas > MAX_PREVERIFICATION_GAS) {
      return fail('GAS_LIMIT_TOO_HIGH', 'preVerificationGas is above the allowed maximum')
    }
    if (op.preVerificationGas < MIN_PREVERIFICATION_GAS) {
      return fail('GAS_LIMIT_TOO_LOW', 'preVerificationGas is below the allowed minimum')
    }
    if (maxFeePerGas === 0n || maxPriorityFeePerGas > maxFeePerGas) {
      return fail('FEE_INVALID', 'maxPriorityFeePerGas cannot exceed maxFeePerGas')
    }

    // La app no usa paymaster en ninguna de sus rutas: los cinco sitios que construyen
    // UserOps mandan '0x'. Aceptar uno cualquiera le regala al atacante un contrato que
    // puede pasar la simulación y fallar al ejecutar — y una transacción revertida la
    // paga el bundler entera, sin reembolso. Si algún día se usa paymaster, esto se
    // convierte en una lista blanca, no en un pass-through.
    if (op.paymasterAndData && op.paymasterAndData !== '0x') {
      return fail('PAYMASTER_NOT_ALLOWED', 'This bundler does not relay operations with a paymaster')
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

    // ── Banda de tarifa contra el estado real de la cadena ───────────────────
    const [block, marketFees] = await Promise.all([
      publicClient.getBlock({ blockTag: 'latest' }),
      publicClient.estimateFeesPerGas().catch(() => null),
    ])
    const baseFee = block.baseFeePerGas ?? 0n
    const feeFloor = (baseFee * (BPS + FEE_FLOOR_MARGIN_BPS)) / BPS
    if (maxFeePerGas < feeFloor) {
      return fail('FEE_TOO_LOW', 'The signed gas price is below the current network fee. Sign again.')
    }
    if (marketFees?.maxFeePerGas && maxFeePerGas > marketFees.maxFeePerGas * FEE_CEILING_MULTIPLIER) {
      return fail('FEE_TOO_HIGH', 'The signed gas price is far above the current network fee')
    }

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
    const txGasLimit = op.preVerificationGas + verificationGasLimit + callGasLimit + 100_000n

    // Tarifas derivadas del UserOp, NO del mercado. El reembolso del EntryPoint es
    // min(maxFeePerGas, maxPriorityFeePerGas + basefee); enviando con este techo y esta
    // propina, el precio efectivo que paga la transacción nunca lo supera. Es lo que
    // convierte "el bundler paga y no recupera" en imposible, y no depende del suelo.
    const headroom = maxFeePerGas > baseFee ? maxFeePerGas - baseFee : 0n
    const txPriorityFee = maxPriorityFeePerGas < headroom ? maxPriorityFeePerGas : headroom

    const txHash = await walletClient.writeContract({
      address: entryPoint,
      abi: ENTRYPOINT_ABI,
      functionName: 'handleOps',
      args: [[op], account.address],
      gas: txGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas: txPriorityFee,
    })

    return Response.json({ txHash })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // El mensaje completo se queda aquí: puede llevar la URL del RPC con su clave.
    console.error('[send-userop]', msg)
    const { code, error } = mapError(msg)
    return fail(code, error)
  }
}
