'use client'
import { useState, type CSSProperties } from 'react'
import { useConnect, useAccount } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '@/lib/i18n/I18nContext'

/**
 * "Connect with WalletConnect" button plus its QR modal. The walletConnect
 * connector runs with showQrModal:false, so the QR is drawn here from the
 * connector's display_uri event. Renders nothing if the connector is missing.
 */
export default function WcQrConnect({ label, style }: { label: string; style?: CSSProperties }) {
  const { t } = useI18n()
  const { connect, connectors } = useConnect()
  const { address } = useAccount()
  const [uri, setUri] = useState<string | null>(null)
  const wc = connectors.find(c => c.id === 'walletConnect')

  if (!wc) return null

  return (
    <>
      <button
        style={style}
        onClick={() => {
          const handler = (msg: { type: string; data?: unknown }) => {
            if (msg.type === 'display_uri') {
              setUri(msg.data as string)
              wc.emitter.off('message', handler)
            }
          }
          wc.emitter.on('message', handler)
          connect({ connector: wc })
        }}
      >
        {label}
      </button>

      {/* Hidden as soon as the wallet connects. */}
      {uri && !address && (
        <div
          onClick={() => setUri(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#0d1117',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: '14px',
              padding: '28px 28px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
              maxWidth: '340px', width: '90%',
            }}
          >
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#f0f4f8' }}>{t('connect.wcScanTitle')}</p>
            <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
              <QRCodeSVG value={uri} size={220} />
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#4a5568', textAlign: 'center' }}>
              {t('connect.wcScanHint')}
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(uri) }}
              style={{
                padding: '7px 16px', borderRadius: '6px',
                border: '1px solid rgba(212,175,55,0.3)',
                background: 'transparent', color: '#D4AF37',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              {t('connect.wcCopyUri')}
            </button>
            <button
              onClick={() => setUri(null)}
              style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '12px', cursor: 'pointer' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
