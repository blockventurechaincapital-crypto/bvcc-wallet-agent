'use client'
import { useAccountStatus } from '@/lib/useAccountStatus'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'

function Item({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: '10px', color: '#4a5568', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontSize: '13px', fontWeight: 500,
        color: accent ? '#D4AF37' : '#f0f4f8',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>{value}</span>
    </div>
  )
}

export default function AccountStatusCard({ address }: { address: string }) {
  const { network } = useNetwork()
  const { t } = useI18n()
  const { data, isLoading } = useAccountStatus(address || null, network)

  if (!address) return null

  const deployed = data?.deployed ?? false

  return (
    <div className="fade-in" style={{
      backgroundColor: '#0d1117',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '8px',
      padding: '16px 20px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#8892a4' }}>{t('dashboard.accountTitle')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: deployed ? '#48bb78' : '#D4AF37', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 500, color: deployed ? '#48bb78' : '#D4AF37' }}>
            {isLoading ? '…' : deployed ? t('dashboard.statusActive') : t('dashboard.statusPending')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 16px' }}>
        <Item label={t('dashboard.accountType')} value={isLoading ? '…' : data?.walletType === 1 ? t('dashboard.typeAgent') : t('dashboard.typeSmart')} accent={data?.walletType === 1} />
        <Item label={t('dashboard.accountOps')} value={isLoading ? '…' : String(data?.nonce ?? 0)} />
        <Item label={t('dashboard.accountGuardians')} value={isLoading ? '…' : `${data?.guardianCount ?? 0} / 3`} />
      </div>
    </div>
  )
}
