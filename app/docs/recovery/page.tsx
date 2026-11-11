import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { recovery } from '@/lib/docs/recovery'

export const metadata: Metadata = {
  title: 'Recover Your Wallet — BVCC Wallet Docs',
  description:
    'Move a BVCC wallet to a new passkey with two of its three guardians: on V5, create the passkey, two guardians vote for it, wait 48 hours, execute and get back in — on each network. The older V4 flow is included.',
}

export default function Page() {
  return <DocsPage doc={recovery} slug="recovery" />
}
