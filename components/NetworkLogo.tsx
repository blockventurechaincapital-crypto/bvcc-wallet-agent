'use client'
import { useState } from 'react'
import type { NetworkConfig } from '@/lib/networks'

// Logo redondeado de una red. Fallback al color de la red si la imagen falla.
export default function NetworkLogo({ network, size = 16, title }: { network: NetworkConfig; size?: number; title?: boolean }) {
  const [err, setErr] = useState(false)
  return (
    <span
      title={title ? network.shortName : undefined}
      style={{
        width: size, height: size, borderRadius: Math.round(size / 4), flexShrink: 0,
        overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: network.color,
      }}
    >
      {!err && (
        <img
          src={network.logo}
          alt={network.shortName}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'cover' }}
          onError={() => setErr(true)}
        />
      )}
    </span>
  )
}
