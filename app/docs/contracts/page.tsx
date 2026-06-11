import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { contracts } from '@/lib/docs/contracts'

export const metadata: Metadata = { title: 'Contract Reference — BVCC Wallet Docs' }

export default function Page() {
  return <DocsPage doc={contracts} slug="contracts" />
}
