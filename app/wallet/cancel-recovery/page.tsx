'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPublicClient, http,
  encodeAbiParameters, encodeFunctionData,
  parseGwei, type Address, type Hex,
} from 'viem'
import { loadCredential, authenticateWebAuthn } from '@/lib/webauthn'
import { BVCC_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { useNetwork } from '@/lib/NetworkContext'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

type Status = 'idle' | 'signing' | 'sending' | 'success' | 'error'

export default function CancelRecoveryPage() {
  const router = useRouter()
  const { network } = useNetwork()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [credentialId, setCredentialId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const cred = loadCredential()
    if (cred) {
      setWalletAddress(cred.walletAddress)
      setCredentialId(cred.credentialId)
    } else {
      const active = localStorage.getItem('bvcc_active_wallet')
      if (active) setWalletAddress(active)
    }
  }, [])

  async function handleCancel() {
    if (!walletAddress) return
    setStatus('signing')
    setErrorMsg(null)

    try {
      // 1. Nonce
      const nonce = await publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_WALLET_ABI,
        functionName: 'getNonce',
        args: [],
      }) as bigint

      // 2. Calldata: execute(BATCH_MODE, [[walletAddress, 0, cancelRecovery()]])
      const innerCallData = encodeFunctionData({
        abi: BVCC_WALLET_ABI,
        functionName: 'cancelRecovery',
      })

      const executionData = encodeAbiParameters(
        [{ type: 'tuple[]', components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ]}],
        [[{ target: walletAddress as Address, value: 0n, callData: innerCallData }]]
      )

      const callData = encodeFunctionData({
        abi: BVCC_WALLET_ABI,
        functionName: 'execute',
        args: [BATCH_MODE, executionData],
      })

      // 3. Gas
      const feeData = await publicClient.estimateFeesPerGas()
      const maxFeePerGas = feeData.maxFeePerGas ?? parseGwei('2')
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? parseGwei('0.1')

      // 4. UserOp
      const userOp = {
        sender: walletAddress as Address,
        nonce,
        initCode: '0x' as Hex,
        callData,
        accountGasLimits: packBytes32(300_000n, 300_000n),
        preVerificationGas: 80_000n,
        gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
        paymasterAndData: '0x' as Hex,
        signature: '0x' as Hex,
      }

      // 5. Hash
      const userOpHash = await publicClient.readContract({
        address: ENTRYPOINT_ADDRESS,
        abi: ENTRYPOINT_ABI,
        functionName: 'getUserOpHash',
        args: [userOp],
      }) as Hex

      // 6. Face ID
      const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
        await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))

      // 7. Signature
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

      // 8. Bundler (o fallback wallet conectada)
      setStatus('sending')
      const { txHash } = await submitUserOp({
        chainId: network.chainId,
        userOp: {
          ...userOp,
          nonce: nonce.toString(),
          preVerificationGas: userOp.preVerificationGas.toString(),
          signature,
        },
      })

      setTxHash(txHash)
      setStatus('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const C = {
    bg: '#06080f', card: '#0d1117',
    border: 'rgba(255,255,255,0.07)',
    text: '#f0f4f8', muted: '#8892a4', subtle: '#4a5568',
    error: '#fc8181', success: '#68d391',
  }

  if (status === 'success') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✓</div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 8px' }}>{t('recovery.successTitle')}</h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 8px' }}>
            {t('recovery.successDesc')}
          </p>
          {txHash && (
            <p style={{ fontSize: '11px', fontFamily: 'monospace', color: C.subtle, margin: '0 0 24px', wordBreak: 'break-all' }}>
              TX: {txHash}
            </p>
          )}
          <button
            onClick={() => router.push('/wallet')}
            style={{ padding: '12px 28px', backgroundColor: '#D4AF37', border: 'none', borderRadius: '6px', color: '#000', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
          >
            {t('recovery.backToDashboard')}
          </button>
        </div>
      </main>
    )
  }

  const isBusy = status === 'signing' || status === 'sending'

  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`* { box-sizing: border-box; }`}</style>
      <div style={{ maxWidth: '380px', width: '100%' }}>
        <button onClick={() => router.back()} style={{ marginBottom: '24px', fontSize: '13px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← {t('recovery.back')}
        </button>

        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(252,129,129,0.06)', border: '1px solid rgba(252,129,129,0.25)', borderRadius: '8px', marginBottom: '24px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#fc8181', fontWeight: '600' }}>{t('recovery.cancelWarningTitle')}</p>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
            {t('recovery.cancelWarningDesc')}
          </p>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {t('recovery.cancelTitle')}
        </h1>
        <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 28px', lineHeight: '1.6' }}>
          {t('recovery.cancelDesc')}
        </p>

        {walletAddress && (
          <div style={{ padding: '10px 14px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: C.subtle, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{t('recovery.walletLabel')}</p>
            <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: C.muted }}>{walletAddress}</p>
          </div>
        )}

        {errorMsg && (
          <p style={{ fontSize: '12px', color: C.error, marginBottom: '16px', lineHeight: '1.5' }}>
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleCancel}
          disabled={isBusy || !walletAddress}
          style={{
            width: '100%', padding: '14px',
            backgroundColor: isBusy ? 'rgba(252,129,129,0.4)' : 'rgba(252,129,129,0.15)',
            border: '1px solid rgba(252,129,129,0.4)',
            borderRadius: '6px', color: '#fc8181',
            fontSize: '14px', fontWeight: '600',
            cursor: isBusy ? 'wait' : 'pointer',
          }}
        >
          {status === 'signing' ? t('recovery.cancelBtnSigning') : status === 'sending' ? t('recovery.cancelBtnSending') : t('recovery.cancelBtn')}
        </button>

        {status === 'error' && (
          <button
            onClick={() => { setStatus('idle'); setErrorMsg(null) }}
            style={{ width: '100%', padding: '11px', marginTop: '10px', background: 'transparent', border: 'none', color: C.subtle, fontSize: '13px', cursor: 'pointer' }}
          >
            {t('recovery.retry')}
          </button>
        )}
      </div>
    </main>
  )
}
