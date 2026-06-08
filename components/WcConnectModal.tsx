'use client'
import { useState, useMemo } from 'react'
import { createPublicClient, http, encodeAbiParameters, encodeFunctionData, parseGwei, type Address, type Hex } from 'viem'
import type { PendingRequestTypes } from '@walletconnect/types'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

interface WcConnectModalProps {
  request: PendingRequestTypes.Struct
  onApprove: (result: string) => void
  onReject: () => void
  walletAddress: string
  credentialId: string | null
}

function truncateHex(hex: string, maxLen = 32): string {
  if (!hex || hex.length <= maxLen) return hex
  return hex.slice(0, maxLen) + '…'
}

function formatValue(value: string | undefined): string {
  if (!value) return '0'
  try {
    const wei = BigInt(value)
    const eth = Number(wei) / 1e18
    return eth.toFixed(6) + ' ETH'
  } catch {
    return value
  }
}

export default function WcConnectModal({
  request,
  onApprove,
  onReject,
  walletAddress,
  credentialId,
}: WcConnectModalProps) {
  const { network } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const { method, params } = request.params.request
  const origin =
    (request as any).verifyContext?.verified?.origin ||
    request.params.chainId ||
    'dApp desconocida'

  const txData = method === 'eth_sendTransaction' ? params[0] : null
  const signMessage = method === 'personal_sign' ? params[0] : null
  const typedData = method === 'eth_signTypedData_v4' ? params[1] : null

  async function handleApprove() {
    setLoading(true)
    setErrorMsg('')
    try {
      if (method === 'eth_sendTransaction') {
        // ── 1. Parse tx params ──────────────────────────────────────────────
        const execTarget = (txData.to ?? walletAddress) as Address
        const execValue = txData.value ? BigInt(txData.value) : 0n
        const execCallData = (txData.data && txData.data !== '0x') ? txData.data as Hex : '0x' as Hex

        // ── 2. Build execute callData ───────────────────────────────────────
        const executionData = encodeAbiParameters(
          [{ type: 'tuple[]', components: [
            { name: 'target', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'callData', type: 'bytes' },
          ]}],
          [[{ target: execTarget, value: execValue, callData: execCallData }]]
        )
        const callData = encodeFunctionData({
          abi: BVCC_WALLET_ABI,
          functionName: 'execute',
          args: [BATCH_MODE, executionData],
        })

        // ── 3. Nonce ────────────────────────────────────────────────────────
        setLoadingMsg(t('connect.fetchingNonce'))
        const nonce = await publicClient.readContract({
          address: walletAddress as Address,
          abi: BVCC_WALLET_ABI,
          functionName: 'getNonce',
          args: [],
        })

        // ── 4. Gas prices ───────────────────────────────────────────────────
        const feeData = await publicClient.estimateFeesPerGas()
        const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('2')
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')

        // ── 5. UserOp ───────────────────────────────────────────────────────
        const userOp = {
          sender: walletAddress as Address,
          nonce,
          initCode: '0x' as Hex,
          callData,
          accountGasLimits: packBytes32(400_000n, 400_000n),
          preVerificationGas: 80_000n,
          gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
          paymasterAndData: '0x' as Hex,
          signature: '0x' as Hex,
        }

        // ── 6. userOpHash ───────────────────────────────────────────────────
        setLoadingMsg(t('connect.computingHash'))
        const userOpHash = await publicClient.readContract({
          address: ENTRYPOINT_ADDRESS,
          abi: ENTRYPOINT_ABI,
          functionName: 'getUserOpHash',
          args: [userOp],
        }) as Hex

        // ── 7. Face ID ──────────────────────────────────────────────────────
        setLoadingMsg(t('connect.waitingFaceId'))
        const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
          await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))

        // ── 8. WebAuthn signature ───────────────────────────────────────────
        const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataHex))
        const challengeIndex = BigInt(clientDataStr.indexOf('"challenge":'))
        const typeIndex = BigInt(clientDataStr.indexOf('"type":'))

        const signature = encodeAbiParameters(
          [
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' },
            { name: 'challengeIndex', type: 'uint256' },
            { name: 'typeIndex', type: 'uint256' },
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
          ],
          [
            `0x${r.toString(16).padStart(64, '0')}` as Hex,
            `0x${s.toString(16).padStart(64, '0')}` as Hex,
            challengeIndex,
            typeIndex,
            authenticatorData,
            clientDataStr,
          ]
        )

        // ── 9. Submit via bundler (o fallback wallet conectada) ─────────────
        setLoadingMsg(t('connect.sendingTx'))
        const { txHash } = await submitUserOp({
          chainId: network.chainId,
          userOp: {
            ...userOp,
            nonce: (nonce as bigint).toString(),
            preVerificationGas: userOp.preVerificationGas.toString(),
            signature,
          },
        })

        onApprove(txHash)

      } else if (method === 'personal_sign') {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const sig = await (window as any).ethereum.request({
              method: 'personal_sign',
              params: [signMessage, walletAddress],
            })
            onApprove(sig)
          } catch {
            onReject()
          }
        } else {
          onApprove('0x')
        }
      } else if (method === 'eth_signTypedData_v4') {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          try {
            const sig = await (window as any).ethereum.request({
              method: 'eth_signTypedData_v4',
              params: [walletAddress, typedData],
            })
            onApprove(sig)
          } catch {
            onReject()
          }
        } else {
          onApprove('0x')
        }
      } else {
        onApprove('0x')
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#0d1117',
        border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: '12px',
        padding: '28px 24px 24px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
            backgroundColor: 'rgba(71,101,241,0.1)',
            border: '1px solid rgba(71,101,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="11" viewBox="0 0 40 25" fill="none">
              <path d="M8.19 4.88C13.45 -0.38 22.05 -0.38 27.31 4.88L27.93 5.50C28.21 5.78 28.21 6.22 27.93 6.50L25.76 8.67C25.62 8.81 25.39 8.81 25.25 8.67L24.39 7.81C20.77 4.19 14.73 4.19 11.11 7.81L10.19 8.73C10.05 8.87 9.82 8.87 9.68 8.73L7.51 6.56C7.23 6.28 7.23 5.84 7.51 5.56L8.19 4.88ZM31.77 9.38L33.70 11.31C33.98 11.59 33.98 12.03 33.70 12.31L24.51 21.50C24.23 21.78 23.79 21.78 23.51 21.50L17.08 15.07C17.01 15.00 16.89 15.00 16.82 15.07L10.39 21.50C10.11 21.78 9.67 21.78 9.39 21.50L0.20 12.31C-0.08 12.03 -0.08 11.59 0.20 11.31L2.13 9.38C2.41 9.10 2.85 9.10 3.13 9.38L9.56 15.81C9.63 15.88 9.75 15.88 9.82 15.81L16.25 9.38C16.53 9.10 16.97 9.10 17.25 9.38L23.68 15.81C23.75 15.88 23.87 15.88 23.94 15.81L30.37 9.38C30.65 9.10 31.09 9.10 31.37 9.38H31.77Z" fill="rgba(71,101,241,0.8)" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#f0f4f8' }}>
              {t('connect.dappRequest')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4a5568', fontFamily: 'IBM Plex Mono, monospace' }}>
              {origin}
            </p>
          </div>
        </div>

        {/* Method badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 9px', marginBottom: '16px',
          backgroundColor: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: '4px',
        }}>
          <span style={{ fontSize: '11px', color: '#D4AF37', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.03em' }}>
            {method}
          </span>
        </div>

        {/* Content */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: errorMsg ? '12px' : '20px',
          fontSize: '12px',
          fontFamily: 'IBM Plex Mono, monospace',
          color: '#8892a4',
          lineHeight: 1.7,
        }}>
          {txData && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#4a5568' }}>{t('connect.to')}</span>
                <span style={{ color: '#f0f4f8' }}>{truncateHex(txData.to ?? '', 20)}</span>
              </div>
              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: '#4a5568' }}>{t('connect.value')}</span>
                <span style={{ color: '#f0f4f8' }}>{formatValue(txData.value)}</span>
              </div>
              {txData.data && txData.data !== '0x' && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.04)', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#4a5568' }}>{t('connect.data')}</span>
                    <span style={{ color: '#8892a4', wordBreak: 'break-all' }}>{truncateHex(txData.data, 40)}</span>
                  </div>
                </>
              )}
            </>
          )}

          {signMessage && (
            <div style={{ wordBreak: 'break-all', color: '#f0f4f8' }}>
              {(() => {
                try {
                  if (signMessage.startsWith('0x')) {
                    const text = Buffer.from(signMessage.slice(2), 'hex').toString('utf8')
                    return text || signMessage
                  }
                  return signMessage
                } catch {
                  return signMessage
                }
              })()}
            </div>
          )}

          {typedData && !txData && !signMessage && (
            <div style={{ wordBreak: 'break-all', color: '#8892a4' }}>
              {truncateHex(typeof typedData === 'string' ? typedData : JSON.stringify(typedData), 120)}
            </div>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: '8px 12px', marginBottom: '16px',
            backgroundColor: 'rgba(252,129,129,0.06)',
            border: '1px solid rgba(252,129,129,0.2)',
            borderRadius: '5px',
            fontSize: '11px', color: '#fc8181', fontFamily: 'IBM Plex Mono, monospace',
            wordBreak: 'break-word',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onReject}
            disabled={loading}
            style={{
              flex: 1, padding: '11px 0',
              backgroundColor: 'transparent',
              border: '1px solid rgba(252,129,129,0.25)',
              borderRadius: '6px',
              color: '#fc8181',
              fontSize: '13px', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {t('connect.reject')}
          </button>

          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              flex: 1, padding: '11px 0',
              backgroundColor: loading ? 'rgba(212,175,55,0.4)' : '#D4AF37',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              fontSize: '13px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {loadingMsg || t('connect.processing')}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('connect.approveWithFaceId')}
              </>
            )}
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
