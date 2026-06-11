<!-- Mirrored in the web app at /docs/bundler-api — keep in sync -->

# Bundler API Reference

The app ships an **optional, self-hosted relay** for ERC-4337 UserOps: a single Next.js API route that submits WebAuthn-signed UserOps to `EntryPoint.handleOps` and pays the gas. Source: [`app/api/send-userop/route.ts`](../app/api/send-userop/route.ts).

> **Not a standard bundler.** This is **not** an ERC-4337 RPC bundler (`eth_sendUserOperation`) and is **not compatible with Pimlico/Alchemy/Stackup** infrastructure. It targets the OpenZeppelin EntryPoint v0.9 (`0x433709009B8330FDa32311DF1C2AFA402eD8D009`) with **packed** UserOps, and only relays for BVCC wallets.

AI agents do **not** need this route — they call `executeAsAgent` directly as a normal transaction (see [Agent Integration](./agent-integration.md)). This route serves the app UI (send/swap/recovery flows signed with Face ID).

## `POST /api/send-userop`

### Request body

BigInt values travel as **strings**; packed fields are hex `bytes32`.

```json
{
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
}
```

- `chainId` — optional; defaults to Arbitrum Sepolia if missing or unknown.
- `accountGasLimits` — packed `bytes32`: `verificationGasLimit (high 128 bits) | callGasLimit (low 128 bits)`.
- `gasFees` — packed `bytes32`: `maxPriorityFeePerGas (high) | maxFeePerGas (low)`.
- `initCode` — `factory address (20 bytes) ++ factory calldata` for counterfactual senders, else `0x`.

### Sender validation (anti gas-drain)

The route only relays for BVCC wallets — the bundler EOA must not pay gas for arbitrary accounts:

- **Deployed sender** → `walletType()` is called on it and must return `0` (personal) or `1` (agent).
- **Counterfactual sender** → the first 20 bytes of `initCode` must be one of the BVCC factories for that network (the EntryPoint itself then guarantees the CREATE2 result matches `sender`).

### Behavior

1. Validates the sender (above).
2. **Simulates** `handleOps([op], bundler)` before spending gas — reverts surface as 400 errors with the revert reason.
3. Submits with an explicit gas limit: `preVerificationGas + verificationGasLimit + callGasLimit + 100_000` (EntryPoint overhead).

### Responses

| Status | Body | Meaning |
|---|---|---|
| `200` | `{ "txHash": "0x..." }` | submitted; hash of the `handleOps` transaction |
| `501` | `{ "error": "Bundler not configured", "code": "BUNDLER_NOT_CONFIGURED" }` | no `BUNDLER_PRIVATE_KEY` on the server — the client must fall back to the connected wallet |
| `400` | `{ "error": "<message>" }` | validation/simulation failure (non-BVCC sender, bad payload, reverted simulation) |

### Client fallback

`lib/useSubmitUserOp.ts` implements the client side: it tries this route first; on `501 BUNDLER_NOT_CONFIGURED` it has the user's connected wallet (MetaMask/WalletConnect via wagmi) call `EntryPoint.handleOps([op], userEOA)` directly and pay the gas. The UserOp is WebAuthn-signed in both paths — whoever submits it can only pay gas, never move funds.

## See also

- [Self-Hosting](./self-hosting.md) — configuring `BUNDLER_PRIVATE_KEY`
- [Agent Integration](./agent-integration.md) · [Contract Reference](./contracts.md)
