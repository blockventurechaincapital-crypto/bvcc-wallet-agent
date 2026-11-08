import { maxUint160, maxUint256, encodeFunctionData, type Address, type Hex, type PublicClient } from 'viem'
import { BVCC_AGENT_WALLET_ABI, BVCC_AGENT_WALLET_V5_ABI } from './abis'

/**
 * Agent permissions across wallet generations.
 *
 * The two generations read a cap the opposite way:
 *   V4  0 = no limit.
 *   V5  0 = nothing allowed; no limit is type(uint128).max, set on purpose.
 * V5 also leaves an empty recipient list meaning "no recipient" (V4: "any").
 * Everything that shows or checks a cap goes through `capState`, so the page never
 * reads a V5 zero as "unlimited".
 */

export const UINT128_MAX = (1n << 128n) - 1n

/** V5: an agent's expiry can be at most this far from now (MAX_AGENT_LIFETIME). */
export const V5_MAX_AGENT_LIFETIME_SECONDS = 365 * 24 * 60 * 60

export type CapState = 'none' | 'limited' | 'unlimited'

export function capState(value: bigint, generation: number): CapState {
  if (generation >= 5) return value === 0n ? 'none' : value === UINT128_MAX ? 'unlimited' : 'limited'
  return value === 0n ? 'unlimited' : 'limited'
}

/** One shape for both generations. `paused` is the agent's own pause (V5 only). */
export interface AgentPermissionView {
  maxPerTxWei: bigint
  dailyLimitWei: bigint
  totalBudgetWei: bigint
  totalSpentWei: bigint
  periodBudgetWei: bigint
  periodSpentWei: bigint
  allowedTokens: readonly Address[]
  tokenMaxAmounts: readonly bigint[]
  tokenDailyLimits: readonly bigint[]
  tokenTotalBudgets: readonly bigint[]
  allowedProtocols: readonly Address[]
  allowedRecipients: readonly Address[]
  expiry: bigint
  periodDuration: bigint
  periodStart: bigint
  active: boolean
  paused: boolean
}

export async function readAgentPermission(
  client: PublicClient,
  wallet: Address,
  agent: Address,
  generation: number,
): Promise<AgentPermissionView> {
  if (generation < 5) {
    const p = await client.readContract({
      address: wallet, abi: BVCC_AGENT_WALLET_ABI, functionName: 'getAgentPermission', args: [agent],
    })
    return { ...p, paused: false }
  }
  const [p, s] = await Promise.all([
    client.readContract({ address: wallet, abi: BVCC_AGENT_WALLET_V5_ABI, functionName: 'getAgentPermission', args: [agent] }),
    client.readContract({ address: wallet, abi: BVCC_AGENT_WALLET_V5_ABI, functionName: 'getAgentSpending', args: [agent] }),
  ])
  return {
    maxPerTxWei: p.maxPerTxWei,
    dailyLimitWei: p.dailyLimitWei,
    totalBudgetWei: p.totalBudgetWei,
    totalSpentWei: s.totalSpentWei,
    periodBudgetWei: p.periodBudgetWei,
    periodSpentWei: s.periodSpentWei,
    allowedTokens: p.allowedTokens,
    tokenMaxAmounts: p.tokenMaxAmounts,
    tokenDailyLimits: p.tokenDailyLimits,
    tokenTotalBudgets: p.tokenTotalBudgets,
    allowedProtocols: p.allowedProtocols,
    allowedRecipients: p.allowedRecipients,
    expiry: BigInt(p.expiry),
    periodDuration: BigInt(p.periodDuration),
    periodStart: BigInt(s.periodStart),
    active: p.active,
    paused: p.paused,
  }
}

/** A call the wallet makes from the owner's batch. */
export interface OwnerCall {
  target: Address
  value: bigint
  callData: Hex
}

const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

const ERC20_ALLOWANCE_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

const PERMIT2_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }], outputs: [] },
] as const

/**
 * V5: the Permit2 allowances the Universal Router and the v4 PositionManager pull an
 * agent's tokens through. In V5 the agent cannot call Permit2 itself (every protocol
 * call needs a validator, and Permit2 has none), so the owner grants them in the same
 * signature that authorizes the agent. What the agent then moves is still measured and
 * charged to its token budgets, so the allowance is not what bounds it.
 *
 * Only missing or shorter allowances are written: re-approving a token that is already
 * approved breaks on tokens like USDT, which refuse a non-zero to non-zero change.
 */
export async function permit2AllowanceCalls(
  client: PublicClient,
  wallet: Address,
  tokens: readonly Address[],
  spenders: readonly Address[],
  expiry: bigint,
): Promise<OwnerCall[]> {
  if (tokens.length === 0 || spenders.length === 0) return []
  const calls: OwnerCall[] = []
  for (const token of tokens) {
    const toPermit2 = await client.readContract({
      address: token, abi: ERC20_ALLOWANCE_ABI, functionName: 'allowance', args: [wallet, PERMIT2],
    })
    if (toPermit2 < maxUint256 / 2n) {
      calls.push({
        target: token, value: 0n,
        callData: encodeFunctionData({ abi: ERC20_ALLOWANCE_ABI, functionName: 'approve', args: [PERMIT2, maxUint256] }),
      })
    }
    for (const spender of spenders) {
      const [amount, expiration] = await client.readContract({
        address: PERMIT2, abi: PERMIT2_ABI, functionName: 'allowance', args: [wallet, token, spender],
      })
      if (amount === maxUint160 && BigInt(expiration) >= expiry) continue
      calls.push({
        target: PERMIT2, value: 0n,
        callData: encodeFunctionData({ abi: PERMIT2_ABI, functionName: 'approve', args: [token, spender, maxUint160, Number(expiry)] }),
      })
    }
  }
  return calls
}
