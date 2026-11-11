import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { migrate } from '@/lib/docs/migrate'

export const metadata: Metadata = {
  title: 'Move to Wallet V5 — BVCC Wallet Docs',
  description:
    'Create a V5 wallet with the same passkey, move your funds and positions across, deploy it on other networks and authorize your agents again.',
}

export default function Page() {
  return <DocsPage doc={migrate} slug="migrate" />
}
