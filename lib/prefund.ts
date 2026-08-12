'use client'
import { createPublicClient, http, type Address } from 'viem'
import { USEROP_TOTAL_GAS } from './executeUserOp'
import { suggestGasFees } from './gasFees'
import type { NetworkConfig } from './networks'

/**
 * How much headroom to leave on top of one userOp's cost. Gas can move between the deploy
 * and the signature that follows it, and on the L2s the whole amount is fractions of a
 * cent, so being generous costs nothing where it is cheap and still covers a spike.
 */
const SAFETY_FACTOR = 3n

const DEPOSIT_ABI = [{
  type: 'function', name: 'balanceOf', stateMutability: 'view',
  inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }],
}] as const

export interface PrefundNeed {
  /** Cost of a single userOp at current fees. */
  required: bigint
  /** What the wallet can already pay with — its own balance plus its EntryPoint deposit. */
  available: bigint
  /** What to send so the wallet clears `required * SAFETY_FACTOR`. Zero when funded. */
  missing: bigint
}

/**
 * What a wallet still needs before it can pay for its own userOp.
 *
 * The EntryPoint charges the prefund to the account, not to whoever relays the bundle, so
 * a freshly deployed wallet holding nothing fails validation with AA21 before its call
 * ever runs. The amount is wildly network-dependent — measured 2026-07-30, one userOp cost
 * 0.0000069 ETH on Base and 0.318 POL on Polygon, a 46,000x spread in native units — so it
 * has to be read from the live fee estimate rather than hardcoded anywhere.
 */
export async function getPrefundNeed(
  walletAddress: Address,
  network: NetworkConfig,
): Promise<PrefundNeed> {
  const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })

  const [balance, deposit, fees] = await Promise.all([
    client.getBalance({ address: walletAddress }),
    client.readContract({
      address: network.contracts.entryPoint, abi: DEPOSIT_ABI,
      functionName: 'balanceOf', args: [walletAddress],
    }).catch(() => 0n) as Promise<bigint>,
    // El MISMO calculo con el que se firma (lib/gasFees.ts). Si aqui se
    // estimara por otro lado, se financiaria una wallet con menos de lo que el
    // EntryPoint le va a reservar y fallaria con AA21 en su primera operacion.
    suggestGasFees(client, network.chainId),
  ])

  const required = USEROP_TOTAL_GAS * fees.maxFeePerGas
  const available = balance + deposit
  const target = required * SAFETY_FACTOR

  return { required, available, missing: available >= target ? 0n : target - available }
}
