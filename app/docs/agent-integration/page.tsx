import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { agentIntegration } from '@/lib/docs/agentIntegration'

export const metadata: Metadata = { title: 'Agent Integration — BVCC Wallet Docs' }

export default function Page() {
  return <DocsPage doc={agentIntegration} slug="agent-integration" />
}
