import { NETWORKS } from './networks'

/**
 * Input validation for the API routes that spend the Etherscan key.
 *
 * Four routes (`logs`, `tokens`, `transactions`, `wallet-info`) take `chainId` and
 * `address` from the query string and interpolate them straight into an Etherscan v2
 * URL built with the server's key. An unescaped `&` in either value injects extra
 * query parameters, so `chainId=1&module=account&action=balance` turns a scoped proxy
 * into an arbitrary Etherscan call paid for with our key.
 *
 * These helpers are the whole defence: an allowlist for the chain and a strict shape
 * for the address leave nothing to inject. Rate limiting is deliberately NOT here —
 * an in-memory counter resets on deploy and does not span PM2 workers, so it belongs
 * in nginx, in front of Node. See the block in docs/self-hosting.md.
 *
 * The key is read-only public chain data: it cannot move funds or sign anything. The
 * realistic damage is a drained daily quota, which breaks the allowances, LP positions
 * and history pages until it resets.
 */

const VALID_CHAIN_IDS = new Set(NETWORKS.map(n => String(n.chainId)))

/** A chain id we actually deploy to, or null. Never trust the raw string. */
export function safeChainId(raw: string | null, fallback?: string): string | null {
  if (raw && VALID_CHAIN_IDS.has(raw)) return raw
  if (!raw && fallback && VALID_CHAIN_IDS.has(fallback)) return fallback
  return null
}

/** Lowercased 0x-address, or null. The shape check is what blocks injection. */
export function safeAddress(raw: string | null): string | null {
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

/** A 32-byte topic (`0x` + 64 hex), or null. Used by the logs proxy. */
export function safeTopic(raw: string | null): string | null {
  if (!raw || !/^0x[a-fA-F0-9]{64}$/.test(raw)) return null
  return raw.toLowerCase()
}

/** A positive integer inside a cap — for page/offset style params. */
export function safeInt(raw: string | null, def: number, max: number): string {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > max) return String(def)
  return String(n)
}
