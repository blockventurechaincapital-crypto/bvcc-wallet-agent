import { NextRequest, NextResponse } from 'next/server'
import { safeChainId, safeAddress } from '@/lib/apiGuard'

// What a wallet contract is called, when it was deployed, and by which factory.
//
// None of it is readable from the wallet itself. The contract stores no timestamp and
// does not record its creator, and while `eip712Domain()` carries the generation it
// reports "BVCCSmartWalletV4" on agent wallets too, because the agent contract inherits
// the parent's EIP712 constructor. Reconstructing the name from that plus `walletType()`
// works but bakes in an assumption about the naming convention.
//
// So the verified name is taken straight from the explorer instead: it is exactly the
// string a user sees when they open their wallet on Arbiscan, which is the whole point —
// if the app and the explorer disagree, the app looks broken. The frontend keeps the
// reconstruction as a fallback for unverified contracts and for builds with no API key.
//
// Two calls because no single endpoint has both, but they are server-side and cached.
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'

export async function GET(req: NextRequest) {
  const apiKey = process.env.ARBISCAN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY' })

  // Validated before they reach the Etherscan URL — see lib/apiGuard.
  const sp = req.nextUrl.searchParams
  const chainId = safeChainId(sp.get('chainId'))
  const address = safeAddress(sp.get('address'))
  if (!chainId || !address) return NextResponse.json({ error: 'BAD_PARAMS' })

  const base = `${ETHERSCAN_V2}?chainid=${chainId}&apikey=${apiKey}`

  try {
    const [creation, source] = await Promise.all([
      fetch(
        `${base}&module=contract&action=getcontractcreation&contractaddresses=${address}`,
        { next: { revalidate: 3600 } },
      ).then(r => r.json()).catch(() => null),
      fetch(
        `${base}&module=contract&action=getsourcecode&address=${address}`,
        { next: { revalidate: 3600 } },
      ).then(r => r.json()).catch(() => null),
    ])

    const hit = Array.isArray(creation?.result) ? creation.result[0] : null
    const src = Array.isArray(source?.result) ? source.result[0] : null
    // Unverified contracts come back with an empty string, not an error.
    const contractName = src?.ContractName?.trim() || null

    if (!hit && !contractName) return NextResponse.json({ error: 'NOT_FOUND' })

    // creationBytecode and SourceCode come back in the payloads and are large —
    // never forward them.
    return NextResponse.json({
      contractName,
      txHash: hit?.txHash ?? null,
      blockNumber: hit?.blockNumber ?? null,
      timestamp: hit?.timestamp ? Number(hit.timestamp) : null,
      factory: hit?.contractFactory ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'FETCH_FAILED' })
  }
}
