import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 60 } }
    )

    if (!res.ok) {
      return NextResponse.json({ eth: { usd: 0, change24h: 0 } })
    }

    const data = await res.json()
    const eth = data?.ethereum

    return NextResponse.json({
      eth: {
        usd: eth?.usd ?? 0,
        change24h: eth?.usd_24h_change ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ eth: { usd: 0, change24h: 0 } })
  }
}
