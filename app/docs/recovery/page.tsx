import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { recovery } from '@/lib/docs/recovery'

export const metadata: Metadata = {
  title: 'Recover Your Wallet — BVCC Wallet Docs',
  description:
    'Move a BVCC wallet to a new passkey with two of its three guardians: generate the new passkey, start and approve the recovery, the 48-hour timelock, execute, and get back in — on each network.',
}

export default function Page() {
  return <DocsPage doc={recovery} slug="recovery" />
}
