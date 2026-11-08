import {
  encodeAbiParameters, encodeFunctionData, keccak256,
  type Address, type Hex, type PublicClient,
} from 'viem'
import { authenticateWebAuthn, credentialIdToBytes } from './webauthn'
import { BVCC_WALLET_ABI, BVCC_WALLET_V5_ABI } from './abis'
import type { NetworkConfig } from './networks'

/**
 * Wallet generations differ in how the passkey signs and how a wallet is created:
 *
 *   V4  UserOp signature = WebAuthn assertion over the userOpHash.
 *       createWallet(x, y); guardians and credential set afterwards with
 *       setGuardians(guardians, credentialId).
 *   V5  UserOp signature = abi.encode(uint48 validUntil, webauthnSig), where the passkey
 *       signs keccak256(abi.encode(userOpHash, validUntil)); the EntryPoint refuses it
 *       once validUntil has passed. createWallet(x, y, credentialId, credentialSig) needs
 *       the passkey to sign its own credential id; setGuardians(guardians) afterwards.
 */
export type WalletGeneration = 4 | 5

/** How long a V5 owner signature stays valid. Counted from the chain's clock, not the device's. */
export const USEROP_SIGNATURE_TTL_SECONDS = 15 * 60

/** Must equal CREDENTIAL_TAG in the V5 wallet. */
const V5_CREDENTIAL_TAG = 'BVCC-V5-credential'

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.slice(2)
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function toBytes32(n: bigint): Hex {
  return `0x${n.toString(16).padStart(64, '0')}`
}

/**
 * Asks the passkey to sign `digest` and returns the assertion encoded the way the wallet's
 * WebAuthn verifier reads it (the same in V4 and V5).
 */
export async function signWithPasskey(credentialId: string | null, digest: Hex): Promise<Hex> {
  const { r, s, authenticatorData, clientDataJSON } = await authenticateWebAuthn(credentialId, hexToBytes(digest))
  const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataJSON))
  return encodeAbiParameters(
    [
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
      { name: 'challengeIndex', type: 'uint256' },
      { name: 'typeIndex', type: 'uint256' },
      { name: 'authenticatorData', type: 'bytes' },
      { name: 'clientDataJSON', type: 'string' },
    ],
    [
      toBytes32(r),
      toBytes32(s),
      BigInt(clientDataStr.indexOf('"challenge":')),
      BigInt(clientDataStr.indexOf('"type":')),
      authenticatorData,
      clientDataStr,
    ],
  )
}

/**
 * The generation of a deployed wallet, from its EIP-712 domain (every release names it
 * BVCCSmartWalletV<n>). Null when it cannot be read: not deployed, not ours, or RPC down.
 */
export async function readWalletGeneration(client: PublicClient, wallet: Address): Promise<number | null> {
  try {
    const { domain } = await client.getEip712Domain({ address: wallet })
    const match = /^BVCCSmartWalletV(\d+)$/.exec(domain.name ?? '')
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

/**
 * Signs a UserOperation hash with the owner passkey, in the format of the wallet's own
 * generation. The wallet itself is asked which one it is: a network can still hold wallets
 * of an older generation than the one its factories create now.
 */
export async function signUserOpHash(opts: {
  client: PublicClient
  network: NetworkConfig
  walletAddress: Address
  credentialId: string | null
  userOpHash: Hex
}): Promise<Hex> {
  const { client, network, walletAddress, credentialId, userOpHash } = opts
  const generation = (await readWalletGeneration(client, walletAddress)) ?? network.contracts.walletVersion
  if (generation < 5) return signWithPasskey(credentialId, userOpHash)

  const { timestamp } = await client.getBlock({ blockTag: 'latest' })
  const validUntil = Number(timestamp) + USEROP_SIGNATURE_TTL_SECONDS
  const digest = keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint48' }],
    [userOpHash, validUntil],
  ))
  const webauthnSig = await signWithPasskey(credentialId, digest)
  return encodeAbiParameters([{ type: 'uint48' }, { type: 'bytes' }], [validUntil, webauthnSig])
}

/**
 * V5 only: the passkey's signature over its own credential id, which createWallet requires.
 * It binds the credential to the predicted wallet address, so nobody else can create the
 * wallet with a credential the owner did not choose.
 */
export async function signCredentialForWallet(walletAddress: Address, credentialId: string): Promise<{
  credential: Hex
  credentialSig: Hex
}> {
  const credential = credentialIdToBytes(credentialId)
  const digest = keccak256(encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }, { type: 'bytes' }],
    [V5_CREDENTIAL_TAG, walletAddress, credential],
  ))
  return { credential, credentialSig: await signWithPasskey(credentialId, digest) }
}

/**
 * Calldata of the passkey-signed self-call that sets the guardians. V4 also registers the
 * credential id there; V5 already has it from createWallet.
 */
export function encodeSetGuardians(
  generation: number,
  guardians: readonly [Address, Address, Address],
  credentialId: string,
): Hex {
  if (generation >= 5) {
    return encodeFunctionData({ abi: BVCC_WALLET_V5_ABI, functionName: 'setGuardians', args: [guardians] })
  }
  return encodeFunctionData({
    abi: BVCC_WALLET_ABI,
    functionName: 'setGuardians',
    args: [guardians, credentialIdToBytes(credentialId)],
  })
}

/**
 * The three guardian slots, empty ones as the zero address. V5 returns them in one call,
 * V4 one index at a time. Null when they cannot be read, which is not the same as "none set".
 */
export async function readGuardians(
  client: PublicClient,
  wallet: Address,
): Promise<readonly [Address, Address, Address] | null> {
  try {
    return await client.readContract({ address: wallet, abi: BVCC_WALLET_V5_ABI, functionName: 'guardians' })
  } catch { /* not V5: read the V4 slots */ }
  try {
    const [g0, g1, g2] = await Promise.all([0n, 1n, 2n].map(i =>
      client.readContract({ address: wallet, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [i] }),
    ))
    return [g0 as Address, g1 as Address, g2 as Address]
  } catch {
    return null
  }
}

/**
 * Whether a guardian recovery is under way, which is when the wallet refuses setGuardians.
 * V4 reports it directly; in V5 it is a proposal armed by two matching votes (votes that
 * have not armed anything do not block, and setGuardians clears them). Null when unknown.
 */
export async function readRecoveryActive(client: PublicClient, wallet: Address): Promise<boolean | null> {
  try {
    const [proposalId] = await client.readContract({ address: wallet, abi: BVCC_WALLET_V5_ABI, functionName: 'armedRecovery' })
    return proposalId !== `0x${'0'.repeat(64)}`
  } catch { /* not V5 */ }
  try {
    return await client.readContract({ address: wallet, abi: BVCC_WALLET_ABI, functionName: 'recoveryInProgress' }) as boolean
  } catch {
    return null
  }
}
