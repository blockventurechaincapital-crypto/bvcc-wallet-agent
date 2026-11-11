import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { agentPermissions } from '@/lib/docs/agentPermissions'

export const metadata: Metadata = {
  title: 'How Agent Permissions Work — BVCC Wallet Docs',
  description:
    'How BVCC Agent Wallet V5 limits an AI agent on-chain: the wallet measures every token that leaves and charges it, 0.15% fee included, against the agent\'s limits; 0 or empty allows nothing; every DeFi call is checked by a validator; agents expire within a year and can be paused one by one.',
}

export default function Page() {
  return <DocsPage doc={agentPermissions} slug="agent-permissions" />
}
