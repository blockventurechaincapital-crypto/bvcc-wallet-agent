import type { Metadata } from 'next'
import DocsIndex from '@/components/DocsIndex'

export const metadata: Metadata = { title: 'Developer Docs — BVCC Wallet' }

export default function Page() {
  return <DocsIndex />
}
