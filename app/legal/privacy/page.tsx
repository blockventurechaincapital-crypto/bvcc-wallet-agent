import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = { title: 'Privacy Policy — BVCC Wallet' }

export default function Page() {
  return <LegalPage slug="privacy" />
}
