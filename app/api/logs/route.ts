import { NextRequest, NextResponse } from 'next/server'

// Proxy genérico a Etherscan v2 `getLogs` con filtros de topic. Lo usan el gestor
// de allowances (eventos Approval/ApprovalForAll del owner) y las posiciones LP
// v4 (Transfer del PositionManager → owner). La API key vive solo en el server.
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api'

export async function GET(req: NextRequest) {
  const apiKey = process.env.ARBISCAN_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'NO_API_KEY', result: [] })

  const sp = req.nextUrl.searchParams
  const chainId = sp.get('chainId')
  const topic0 = sp.get('topic0')
  const address = sp.get('address') // filtro opcional por contrato emisor
  const topic1 = sp.get('topic1')   // 1er indexed (p.ej. owner en Approval)
  const topic2 = sp.get('topic2')   // 2º indexed (p.ej. to en Transfer)

  if (!chainId || !topic0) return NextResponse.json({ error: 'BAD_PARAMS', result: [] })

  let url = `${ETHERSCAN_V2}?module=logs&action=getLogs&chainid=${chainId}&fromBlock=0&toBlock=latest&topic0=${topic0}`
  if (address) url += `&address=${address}`
  if (topic1) url += `&topic1=${topic1}&topic0_1_opr=and`
  if (topic2) url += `&topic2=${topic2}&topic0_2_opr=and`
  url += `&apikey=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json({ result: Array.isArray(data.result) ? data.result : [] })
  } catch {
    return NextResponse.json({ error: 'FETCH_FAILED', result: [] })
  }
}
