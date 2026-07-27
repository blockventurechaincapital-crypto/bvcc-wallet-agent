import React from 'react'

/**
 * A full address rendered as a link into the block explorer.
 *
 * `tab="code"` appends the `#code` anchor so the link lands on the explorer's
 * **Contract** tab — the point being that anyone can click through and verify a
 * composed address really is the canonical contract (Uniswap, Aave, Permit2…),
 * not something slipped in. Opens in a new tab.
 *
 * Generalized from the copy previously inlined in WcConnectModal.tsx.
 */
export function ExplorerAddress({
  addr,
  explorerBase,
  tab,
  short = false,
  style: styleOverride,
}: {
  addr: string
  /** Explorer origin, e.g. https://arbiscan.io. */
  explorerBase?: string
  /** 'code' opens the Contract tab (#code). */
  tab?: 'code'
  /** Show a shortened 0x1234…abcd instead of the full address. */
  short?: boolean
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    color: '#7c93b5',
    fontFamily: 'monospace',
    fontSize: '11px',
    wordBreak: 'break-all',
    ...styleOverride,
  }
  const text = short && addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
  if (!explorerBase || !addr) return <span style={base}>{text || '—'}</span>
  const href = `${explorerBase}/address/${addr}${tab === 'code' ? '#code' : ''}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tab === 'code' ? 'Verify the contract on the explorer' : 'View on the explorer'}
      style={{
        ...base,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(124,147,181,0.4)',
        cursor: 'pointer',
      }}
    >
      {text} ↗
    </a>
  )
}

export default ExplorerAddress
