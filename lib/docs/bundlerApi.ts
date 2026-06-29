// Mirrored from docs/bundler-api.md (monorepo, English canonical) — keep in sync
import type { LocalizedDoc } from '@/components/DocsPage'

const CODE_BODY = `{
  "chainId": 42161,
  "userOp": {
    "sender": "0x...",
    "nonce": "0",
    "initCode": "0x",
    "callData": "0x...",
    "accountGasLimits": "0x...",
    "preVerificationGas": "50000",
    "gasFees": "0x...",
    "paymasterAndData": "0x",
    "signature": "0x..."
  }
}`

export const bundlerApi: LocalizedDoc = {
  en: {
    title: 'Bundler API Reference',
    intro:
      'The app ships an optional, self-hosted relay for ERC-4337 UserOps: a single Next.js API route (`app/api/send-userop/route.ts`) that submits WebAuthn-signed UserOps to `EntryPoint.handleOps` and pays the gas.',
    blocks: [
      {
        type: 'callout',
        tone: 'warn',
        text: 'Not a standard bundler. This is not an ERC-4337 RPC bundler (`eth_sendUserOperation`) and is not compatible with Pimlico/Alchemy/Stackup infrastructure. It targets the OpenZeppelin EntryPoint v0.9 (`0x433709009B8330FDa32311DF1C2AFA402eD8D009`) with packed UserOps, and only relays for BVCC wallets.',
      },
      {
        type: 'p',
        text: 'AI agents do not need this route — they call `executeAsAgent` directly as a normal transaction (see Agent Integration). This route serves the app UI (send/swap/recovery flows signed with biometrics / WebAuthn).',
      },

      { type: 'h2', text: 'POST /api/send-userop' },

      { type: 'h3', text: 'Request body' },
      { type: 'p', text: 'BigInt values travel as strings; packed fields are hex `bytes32`.' },
      { type: 'code', lang: 'json', code: CODE_BODY },
      {
        type: 'list',
        items: [
          '`chainId` — optional; defaults to Arbitrum Sepolia if missing or unknown.',
          '`accountGasLimits` — packed `bytes32`: `verificationGasLimit (high 128 bits) | callGasLimit (low 128 bits)`.',
          '`gasFees` — packed `bytes32`: `maxPriorityFeePerGas (high) | maxFeePerGas (low)`.',
          '`initCode` — `factory address (20 bytes) ++ factory calldata` for counterfactual senders, else `0x`.',
        ],
      },

      { type: 'h3', text: 'Sender validation (anti gas-drain)' },
      {
        type: 'p',
        text: 'The route only relays for BVCC wallets — the bundler EOA must not pay gas for arbitrary accounts:',
      },
      {
        type: 'list',
        items: [
          'Deployed sender → `walletType()` is called on it and must return `0` (personal) or `1` (agent).',
          'Counterfactual sender → the first 20 bytes of `initCode` must be one of the BVCC factories for that network (the EntryPoint itself then guarantees the CREATE2 result matches `sender`).',
        ],
      },

      { type: 'h3', text: 'Behavior' },
      {
        type: 'list',
        items: [
          'Validates the sender (above).',
          'Simulates `handleOps([op], bundler)` before spending gas — reverts surface as 400 errors with the revert reason.',
          'Submits with an explicit gas limit: `preVerificationGas + verificationGasLimit + callGasLimit + 100_000` (EntryPoint overhead).',
        ],
      },

      { type: 'h3', text: 'Responses' },
      {
        type: 'table',
        headers: ['Status', 'Body', 'Meaning'],
        rows: [
          ['`200`', '`{ "txHash": "0x..." }`', 'submitted; hash of the `handleOps` transaction'],
          [
            '`501`',
            '`{ "error": "Bundler not configured", "code": "BUNDLER_NOT_CONFIGURED" }`',
            'no `BUNDLER_PRIVATE_KEY` on the server — the client must fall back to the connected wallet',
          ],
          ['`400`', '`{ "error": "<message>" }`', 'validation/simulation failure (non-BVCC sender, bad payload, reverted simulation)'],
        ],
      },

      { type: 'h3', text: 'Client fallback' },
      {
        type: 'p',
        text: '`lib/useSubmitUserOp.ts` implements the client side: it tries this route first; on `501 BUNDLER_NOT_CONFIGURED` it has the user’s connected wallet (MetaMask/WalletConnect via wagmi) call `EntryPoint.handleOps([op], userEOA)` directly and pay the gas. The UserOp is WebAuthn-signed in both paths — whoever submits it can only pay gas, never move funds.',
      },
    ],
  },

  es: {
    title: 'Referencia de la API del bundler',
    intro:
      'La app incluye un relay opcional y self-hosted para UserOps ERC-4337: un único API route de Next.js (`app/api/send-userop/route.ts`) que envía UserOps firmados con WebAuthn a `EntryPoint.handleOps` y paga el gas.',
    blocks: [
      {
        type: 'callout',
        tone: 'warn',
        text: 'No es un bundler estándar. No es un bundler RPC ERC-4337 (`eth_sendUserOperation`) y no es compatible con la infraestructura de Pimlico/Alchemy/Stackup. Apunta al EntryPoint v0.9 de OpenZeppelin (`0x433709009B8330FDa32311DF1C2AFA402eD8D009`) con UserOps packed, y solo relayea para wallets BVCC.',
      },
      {
        type: 'p',
        text: 'Los agentes IA no necesitan este route — llaman a `executeAsAgent` directamente como transacción normal (mira Integración de agentes). Este route sirve a la UI de la app (flujos de envío/swap/recovery firmados con biometría / WebAuthn).',
      },

      { type: 'h2', text: 'POST /api/send-userop' },

      { type: 'h3', text: 'Cuerpo de la petición' },
      { type: 'p', text: 'Los BigInt viajan como strings; los campos packed son `bytes32` en hex.' },
      { type: 'code', lang: 'json', code: CODE_BODY },
      {
        type: 'list',
        items: [
          '`chainId` — opcional; por defecto Arbitrum Sepolia si falta o no se reconoce.',
          '`accountGasLimits` — `bytes32` packed: `verificationGasLimit (128 bits altos) | callGasLimit (128 bits bajos)`.',
          '`gasFees` — `bytes32` packed: `maxPriorityFeePerGas (altos) | maxFeePerGas (bajos)`.',
          '`initCode` — `dirección de la factory (20 bytes) ++ calldata de la factory` para senders counterfactual; si no, `0x`.',
        ],
      },

      { type: 'h3', text: 'Validación del sender (anti gas-drain)' },
      {
        type: 'p',
        text: 'El route solo relayea para wallets BVCC — la EOA del bundler no debe pagar gas por cuentas arbitrarias:',
      },
      {
        type: 'list',
        items: [
          'Sender desplegado → se llama a su `walletType()` y debe devolver `0` (personal) o `1` (agente).',
          'Sender counterfactual → los primeros 20 bytes del `initCode` deben ser una de las factories BVCC de esa red (el propio EntryPoint garantiza después que el resultado CREATE2 coincide con `sender`).',
        ],
      },

      { type: 'h3', text: 'Comportamiento' },
      {
        type: 'list',
        items: [
          'Valida el sender (arriba).',
          'Simula `handleOps([op], bundler)` antes de gastar gas — los reverts salen como errores 400 con la razón del revert.',
          'Envía con gas limit explícito: `preVerificationGas + verificationGasLimit + callGasLimit + 100_000` (overhead del EntryPoint).',
        ],
      },

      { type: 'h3', text: 'Respuestas' },
      {
        type: 'table',
        headers: ['Status', 'Body', 'Significado'],
        rows: [
          ['`200`', '`{ "txHash": "0x..." }`', 'enviado; hash de la transacción `handleOps`'],
          [
            '`501`',
            '`{ "error": "Bundler not configured", "code": "BUNDLER_NOT_CONFIGURED" }`',
            'no hay `BUNDLER_PRIVATE_KEY` en el servidor — el cliente debe caer al fallback de la wallet conectada',
          ],
          ['`400`', '`{ "error": "<mensaje>" }`', 'fallo de validación/simulación (sender no BVCC, payload incorrecto, simulación revertida)'],
        ],
      },

      { type: 'h3', text: 'Fallback del cliente' },
      {
        type: 'p',
        text: '`lib/useSubmitUserOp.ts` implementa el lado cliente: prueba primero este route; ante un `501 BUNDLER_NOT_CONFIGURED` hace que la wallet conectada del usuario (MetaMask/WalletConnect vía wagmi) llame directamente a `EntryPoint.handleOps([op], userEOA)` y pague el gas. El UserOp va firmado con WebAuthn en ambos caminos — quien lo envía solo puede pagar gas, nunca mover fondos.',
      },
    ],
  },
}
