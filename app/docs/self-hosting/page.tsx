import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { selfHosting } from '@/lib/docs/selfHosting'

export const metadata: Metadata = { title: 'Setup & Self-Hosting — BVCC Wallet Docs' }

export default function Page() {
  return <DocsPage doc={selfHosting} slug="self-hosting" />
}
