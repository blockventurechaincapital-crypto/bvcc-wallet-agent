'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletVersion } from '@/lib/useWalletVersion'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useNetwork } from '@/lib/NetworkContext'
import SendAllModal from '@/components/SendAllModal'

const GOLD = '#D4AF37'
const AMBER = '#e6b800'

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/**
 * Persistent banner plus a one-off modal for wallets on an older generation.
 *
 * The banner never goes away while the wallet is outdated — dismissing it only closes the
 * modal — because the wallet keeps holding funds on bytecode that a later release fixed.
 */
export default function OutdatedWalletNotice() {
  const { version, current, isOutdated, upgradeAddress, isLoading } = useWalletVersion()
  const { t } = useI18n()
  const { network } = useNetwork()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [showSendAll, setShowSendAll] = useState(false)

  useEffect(() => {
    if (!isOutdated || isLoading) return
    // Once per version per session: the banner carries the message from then on.
    const key = `bvcc_outdated_ack_v${version}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setShowModal(true)
  }, [isOutdated, isLoading, version])

  if (isLoading || !isOutdated) return null

  const title = t('wallet.outdatedTitle').replace('{version}', String(version))
  const body = t('wallet.outdatedBody')
    .replace('{version}', String(version))
    .replace('{current}', String(current))

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '9px 16px', backgroundColor: 'rgba(230,184,0,0.10)',
        borderBottom: '1px solid rgba(230,184,0,0.30)', fontSize: '12.5px', color: AMBER,
      }}>
        <span style={{ fontSize: '14px' }} aria-hidden>⚠</span>
        <span style={{ flex: 1, minWidth: '220px', lineHeight: 1.45 }}>
          <b>{title}</b> — {body}
        </span>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '6px 11px', fontSize: '11.5px', fontWeight: 600, color: GOLD,
            backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '5px',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {t('wallet.outdatedWhatChanges')}
        </button>
        <button
          onClick={() => setShowSendAll(true)}
          style={{
            padding: '6px 11px', fontSize: '11.5px', fontWeight: 600, color: GOLD,
            backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '5px',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {t('wallet.sendAllBtn')}
        </button>
        <button
          onClick={() => router.push(`/?migrate=1&chain=${network.chainId}`)}
          style={{
            padding: '6px 13px', fontSize: '11.5px', fontWeight: 600, color: '#06080f',
            backgroundColor: GOLD, border: 'none', borderRadius: '5px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('wallet.outdatedCta', { current })}
        </button>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '460px', width: '100%', padding: '24px', maxHeight: '90vh', overflowY: 'auto',
              backgroundColor: '#0d1117', border: '1px solid rgba(230,184,0,0.35)',
              borderRadius: '10px', color: '#f0f4f8',
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: AMBER }}>
              {title}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.6, color: '#c3cbd8' }}>
              {body}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.6, color: '#c3cbd8' }}>
              {t('wallet.outdatedHow', { current })}
            </p>
            <div style={{ margin: '0 0 16px', fontSize: '12.5px', fontWeight: 600, color: GOLD }}>
              {t('wallet.outdatedChangesTitle', { current })}
            </div>
            <ul style={{ margin: '-10px 0 16px', paddingLeft: '18px', fontSize: '12.5px', lineHeight: 1.55, color: '#c3cbd8' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <li key={i} style={{ marginTop: '4px' }}>{t(`wallet.outdatedChange${i}`)}</li>)}
            </ul>
            {upgradeAddress && (
              <div style={{
                padding: '10px 12px', marginBottom: '16px', borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.04)', fontSize: '12px', color: '#8892a4',
              }}>
                {t('wallet.outdatedNewAddress', { current })}{' '}
                <span style={{ fontFamily: 'monospace', color: '#f0f4f8' }}>
                  {shortAddr(upgradeAddress)}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push(`/?migrate=1&chain=${network.chainId}`)}
                style={{
                  flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600, color: '#06080f',
                  backgroundColor: GOLD, border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                {t('wallet.outdatedCta', { current })}
              </button>
              <a
                href="/docs/migrate"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: GOLD,
                  border: `1px solid ${GOLD}`, borderRadius: '6px', textDecoration: 'none',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}
              >
                {t('wallet.outdatedHowToMigrate')}
              </a>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 16px', fontSize: '13px', fontWeight: 600, color: '#8892a4',
                  backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px', cursor: 'pointer',
                }}
              >
                {t('wallet.outdatedLater')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendAll && <SendAllModal onClose={() => setShowSendAll(false)} />}
    </>
  )
}
