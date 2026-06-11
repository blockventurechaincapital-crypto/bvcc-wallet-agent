import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { bundlerApi } from '@/lib/docs/bundlerApi'

export const metadata: Metadata = { title: 'Bundler API — BVCC Wallet Docs' }

export default function Page() {
  return <DocsPage doc={bundlerApi} slug="bundler-api" />
}
