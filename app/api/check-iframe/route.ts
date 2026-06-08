import { NextRequest, NextResponse } from 'next/server'
import { resolveAllowedDAppUrl } from '@/lib/dapps'

// Checks whether a curated BVCC dApp can be embedded in an iframe.
// The dApp list is manually curated (lib/dapps.ts) and users cannot add
// arbitrary URLs, so this route only ever fetches a host from that allowlist.
// Anything else → { allowed: false }, and the frontend opens it in a new tab.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ allowed: false })

  // Only proceed for https URLs whose hostname is a known dApp host and is
  // not an internal/loopback/metadata target (SSRF defense-in-depth).
  const target = resolveAllowedDAppUrl(raw)
  if (!target) return NextResponse.json({ allowed: false })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(target.toString(), {
      method: 'HEAD',
      // Do not follow redirects — a redirect must never lead us to an
      // internal URL. A 3xx surfaces here with no frame headers.
      redirect: 'manual',
      signal: controller.signal,
    })

    const xfo = res.headers.get('x-frame-options') ?? ''
    const csp = res.headers.get('content-security-policy') ?? ''

    const blockedByXfo =
      xfo.toUpperCase().includes('DENY') ||
      xfo.toUpperCase().includes('SAMEORIGIN')

    // frame-ancestors 'none' or 'self' blocks cross-origin embedding
    const blockedByCsp =
      csp.includes('frame-ancestors') &&
      !csp.includes('frame-ancestors *') &&
      (csp.includes("frame-ancestors 'none'") || csp.includes("frame-ancestors 'self'"))

    return NextResponse.json({ allowed: !(blockedByXfo || blockedByCsp) })
  } catch {
    // Network error / timeout — do NOT assume allowed. The frontend falls
    // back to opening the dApp in a new tab when allowed is false.
    return NextResponse.json({ allowed: false })
  } finally {
    clearTimeout(timeout)
  }
}
