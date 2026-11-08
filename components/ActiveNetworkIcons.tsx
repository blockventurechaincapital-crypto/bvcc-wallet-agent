'use client'
import NetworkLogo from '@/components/NetworkLogo'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useActiveNetworks, explorerAddressUrl } from '@/lib/useActiveNetworks'

/**
 * One logo per network where the wallet exists. Each logo opens the wallet on that
 * network's explorer in a new tab. Renders nothing until the networks are known.
 */
export default function ActiveNetworkIcons({ address, size = 18 }: { address: string; size?: number }) {
  const { t } = useI18n()
  const { data } = useActiveNetworks(address)
  if (!data || data.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {data.map(n => (
        <a
          key={n.chainId}
          href={explorerAddressUrl(n, address)}
          target="_blank"
          rel="noopener noreferrer"
          title={t('nav.openOnExplorer', { network: n.name, explorer: n.blockExplorer.name })}
          className="net-icon-link"
          style={{ display: 'inline-flex', borderRadius: Math.round(size / 4), lineHeight: 0 }}
        >
          <NetworkLogo network={n} size={size} />
        </a>
      ))}
    </div>
  )
}
