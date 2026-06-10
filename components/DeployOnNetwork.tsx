'use client'
import { useEffect, useState } from 'react'
import { useAccount, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useDeploySeed } from '@/lib/useCrossChainDeploy'
import { BVCC_WALLET_FACTORY_ABI, BVCC_AGENT_WALLET_FACTORY_ABI } from '@/lib/abis'

const GOLD = '#D4AF37'
const GOLD_GRADIENT = 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)'

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

// Botón "Desplegar en esta red" + modal. Se muestra en el dashboard cuando la
// wallet existe en otra red pero no en la activa. La wallet conectada
// (MetaMask/WC) paga el gas del createWallet, igual que en la creación.
export default function DeployOnNetwork({ address }: { address: string }) {
  const { network } = useNetwork()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const { address: connected, chainId: connectedChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { data: seed, isLoading: seedLoading } = useDeploySeed(address, network, open)
  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash, chainId: network.chainId })
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries({ queryKey: ['accountStatus'] })
  }, [isSuccess, queryClient])

  const factoryAddr = seed?.walletType === 1 ? network.contracts.agentFactory : network.contracts.factory
  const isOnTargetChain = connectedChainId === network.chainId
  const isProcessing = isWriting || isConfirming

  function handleDeploy() {
    if (!seed || !factoryAddr) return
    const args = [seed.pubKeyX, seed.pubKeyY, seed.guardians, seed.credentialId] as const
    if (seed.walletType === 1) {
      writeContract({
        address: factoryAddr,
        abi: BVCC_AGENT_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    } else {
      writeContract({
        address: factoryAddr,
        abi: BVCC_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    }
  }

  function close() {
    setOpen(false)
    reset()
  }

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }
  const lbl: React.CSSProperties = { fontSize: '11px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }
  const val: React.CSSProperties = { fontSize: '12px', color: '#f0f4f8', fontFamily: 'IBM Plex Mono, monospace', textAlign: 'right' }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#06080f',
          background: GOLD_GRADIENT,
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 0 14px rgba(212,175,55,0.25)',
        }}
      >
        {t('dashboard.depBtn')}
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '420px',
              backgroundColor: '#0d1117',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '12px',
              padding: '22px 24px',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#f0f4f8' }}>
              {t('dashboard.depTitle')} — {network.name}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#8892a4', lineHeight: 1.5 }}>
              {t('dashboard.depDesc')}
            </p>

            {seedLoading && (
              <p style={{ fontSize: '12px', color: '#8892a4' }}>{t('dashboard.depLoading')}</p>
            )}

            {!seedLoading && !seed && (
              <p style={{ fontSize: '12px', color: '#fc8181' }}>{t('dashboard.depNoSource')}</p>
            )}

            {!seedLoading && seed && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.depSameAddr')}</span>
                    <span style={{ ...val, color: GOLD }}>{shortAddr(address)}</span>
                  </div>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.accountType')}</span>
                    <span style={val}>{seed.walletType === 1 ? t('dashboard.typeAgent') : t('dashboard.typeSmart')}</span>
                  </div>
                  <div style={row}>
                    <span style={lbl}>{t('dashboard.depSource')}</span>
                    <span style={val}>{seed.sourceName}</span>
                  </div>
                  <div style={{ ...row, borderBottom: 'none' }}>
                    <span style={lbl}>{t('dashboard.accountGuardians')}</span>
                    <span style={val}>{seed.guardians.map(shortAddr).join('  ')}</span>
                  </div>
                </div>

                {isSuccess ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#48bb78', fontWeight: 600 }}>
                      ✓ {t('dashboard.depSuccess')}
                    </p>
                    <button onClick={close} style={{ padding: '9px 18px', fontSize: '12px', fontWeight: 600, color: '#06080f', background: GOLD_GRADIENT, border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      {t('common.close')}
                    </button>
                  </div>
                ) : !factoryAddr ? (
                  <p style={{ fontSize: '12px', color: '#fc8181' }}>{t('dashboard.depAgentMissing')}</p>
                ) : !connected ? (
                  <p style={{ fontSize: '12px', color: '#8892a4' }}>{t('dashboard.depConnect')}</p>
                ) : !isOnTargetChain ? (
                  <button
                    onClick={() => switchChain({ chainId: network.chainId })}
                    disabled={isSwitching}
                    style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 600, color: GOLD, backgroundColor: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '6px', cursor: 'pointer', opacity: isSwitching ? 0.6 : 1 }}
                  >
                    {t('dashboard.depSwitch')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDeploy}
                      disabled={isProcessing}
                      style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 600, color: '#06080f', background: GOLD_GRADIENT, border: 'none', borderRadius: '6px', cursor: isProcessing ? 'wait' : 'pointer', opacity: isProcessing ? 0.7 : 1, boxShadow: '0 0 18px rgba(212,175,55,0.3)' }}
                    >
                      {isProcessing ? t('dashboard.depDeploying') : t('dashboard.depAction')}
                    </button>
                    {writeError && (
                      <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#fc8181', wordBreak: 'break-word' }}>
                        {(writeError as Error).message.split('\n')[0].slice(0, 160)}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
