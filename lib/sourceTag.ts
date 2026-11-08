/**
 * Source tag reader — which tool built an agent transaction.
 *
 * Since 0.3.0 the SDK and the MCP append 8 bytes to the `executeAsAgent` calldata:
 *
 *   "bvcc" (4 bytes, magic) ++ tool (1 byte: 0x01 SDK, 0x02 MCP) ++ version (3 bytes:
 *   major, minor, patch)
 *
 * Same decoding as `decodeSourceTag` in @bvcc/agent-sdk (src/sourceTag.ts), copied here
 * so the app does not depend on the SDK. Keep both in step if the format ever changes.
 */

export type SourceTool = 'sdk' | 'mcp'

export type SourceTag = { tool: SourceTool | 'unknown'; version: string }

/** "bvcc" in ASCII, without 0x. */
const MAGIC = '62766363'

/** The tag at the end of a transaction input, or null when there is none. */
export function decodeSourceTag(input: string | null | undefined): SourceTag | null {
  if (!input || !input.startsWith('0x') || input.length < 2 + 16) return null
  const tail = input.slice(-16).toLowerCase()
  if (tail.slice(0, 8) !== MAGIC) return null
  const byte = (i: number) => Number.parseInt(tail.slice(8 + i * 2, 10 + i * 2), 16)
  const tool = byte(0) === 1 ? 'sdk' : byte(0) === 2 ? 'mcp' : 'unknown'
  return { tool, version: `${byte(1)}.${byte(2)}.${byte(3)}` }
}

/** -1, 0 or 1, comparing "major.minor.patch" strings. Missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}
