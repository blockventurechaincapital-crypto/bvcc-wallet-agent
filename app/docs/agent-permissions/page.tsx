import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { agentPermissions } from '@/lib/docs/agentPermissions'

export const metadata: Metadata = {
  title: 'How Agent Permissions Work — BVCC Wallet Docs',
  description:
    'Understand a BVCC Agent Wallet: capabilities vs raw addresses, the four permission layers, call policies that pin funds to your wallet, what 0/empty limits mean, and verifying each contract on the explorer.',
}

export default function Page() {
  return <DocsPage doc={agentPermissions} slug="agent-permissions" />
}
