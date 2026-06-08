import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Swap Fast Disclaimer — BVCC Wallet' }

export default function Page() {
  return <LegalPage slug="swap" />
}
