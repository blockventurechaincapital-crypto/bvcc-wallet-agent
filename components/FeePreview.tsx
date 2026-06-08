'use client'
import { formatEther } from 'viem'
import { calculateFee } from '@/lib/send'
import { useI18n } from '@/lib/i18n/I18nContext'

interface FeePreviewProps {
  amount: bigint
  token: 'ETH' | 'USDC'
}

function formatAmount(wei: bigint, token: 'ETH' | 'USDC'): string {
  if (token === 'USDC') {
    // USDC uses 6 decimals
    const usdc = Number(wei) / 1_000_000
    return usdc.toFixed(4)
  }
  return parseFloat(formatEther(wei)).toFixed(6)
}

export default function FeePreview({ amount, token }: FeePreviewProps) {
  const { t } = useI18n()

  if (amount === 0n) return null

  const { fee, amountAfterFee } = calculateFee(amount)
  const symbol = token

  return (
    <div
      className="rounded p-3 text-xs flex flex-col gap-1"
      style={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4' }}
    >
      <div className="flex justify-between">
        <span>{t('components.feeSends')}</span>
        <span style={{ color: '#f0f4f8' }}>
          {formatAmount(amount, token)} {symbol}
        </span>
      </div>
      <div className="flex justify-between">
        <span>{t('components.feeBvcc')}</span>
        <span style={{ color: '#D4AF37' }}>
          {formatAmount(fee, token)} {symbol}
        </span>
      </div>
      <div
        className="flex justify-between pt-1 mt-1 font-semibold"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: '#f0f4f8' }}
      >
        <span>{t('components.feeReceives')}</span>
        <span>
          {formatAmount(amountAfterFee, token)} {symbol}
        </span>
      </div>
    </div>
  )
}
