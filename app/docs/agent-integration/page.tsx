import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { agentIntegration } from '@/lib/docs/agentIntegration'

export const metadata: Metadata = {
  title: 'Agent Integration — BVCC Wallet Docs',
  description:
    'How an AI agent calls executeAsAgent on a BVCC Agent Wallet V5: batch encoding, the validators for Uniswap, Aave and wrapped ETH, limits that include the 0.15% fee, errors and events, with Foundry and viem examples.',
}

export default function Page() {
  return <DocsPage doc={agentIntegration} slug="agent-integration" />
}
