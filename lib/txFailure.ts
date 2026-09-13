/**
 * Why a transfer requested from the connected wallet did not go through, in the only terms
 * the user can act on: they declined it, or their wallet cannot afford it, or something else.
 *
 * Wallets report these inconsistently. viem maps EIP-1193's 4001 and WalletConnect's 5000 to
 * UserRejectedRequestError, and a node's "insufficient funds" to InsufficientFundsError, but
 * a mobile wallet over WalletConnect may hand back nothing more than its own message. So the
 * cause chain is walked for the typed error first and for the words after.
 */
export type TransferFailure = 'rejected' | 'insufficientFunds' | 'other'

const REJECTED_CODES = new Set<unknown>([4001, 5000])
const REJECTED_TEXT = /user rejected|user denied|rejected by (the )?user|user cancel/i
const NO_FUNDS_TEXT = /insufficient (funds|balance)|exceeds (the )?balance|exceeds transaction sender account balance/i

type ErrorLike = {
  name?: unknown
  code?: unknown
  message?: unknown
  shortMessage?: unknown
  details?: unknown
  cause?: unknown
}

export function classifyTransferFailure(err: unknown): TransferFailure {
  let text = typeof err === 'string' ? err : ''
  const seen = new Set<unknown>()
  let current: unknown = err

  while (current && typeof current === 'object' && !seen.has(current) && seen.size < 10) {
    seen.add(current)
    const e = current as ErrorLike
    if (e.name === 'InsufficientFundsError') return 'insufficientFunds'
    if (e.name === 'UserRejectedRequestError' || REJECTED_CODES.has(e.code)) return 'rejected'
    for (const part of [e.shortMessage, e.message, e.details]) {
      if (typeof part === 'string') text += ' ' + part
    }
    current = e.cause
  }

  // Funds before rejection: a wallet that refuses a transfer it cannot pay for may word it as
  // both, and "top up your wallet" is the message that leads somewhere.
  if (NO_FUNDS_TEXT.test(text)) return 'insufficientFunds'
  if (REJECTED_TEXT.test(text)) return 'rejected'
  return 'other'
}

/** One line of an error, short enough to show inline. viem's full message runs to a dozen. */
export function failureSummary(err: unknown): string {
  const e = (err && typeof err === 'object' ? err : {}) as ErrorLike
  const raw = typeof e.shortMessage === 'string' ? e.shortMessage
    : typeof e.message === 'string' ? e.message
    : String(err)
  const line = raw.split('\n')[0].trim()
  return line.length > 200 ? line.slice(0, 199) + '…' : line
}
