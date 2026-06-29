import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { connectAi } from '@/lib/docs/connectAi'

export const metadata: Metadata = {
  title: 'Connect an AI Assistant (MCP) — BVCC Wallet Docs',
  description:
    'Connect Hermes, Claude, Cursor or LM Studio to a BVCC Agent Wallet over MCP. Install @bvcc/agent-mcp, configure, authorize the agent on-chain and verify.',
}

export default function Page() {
  return <DocsPage doc={connectAi} slug="connect-ai" />
}
