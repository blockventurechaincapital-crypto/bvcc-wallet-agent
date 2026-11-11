import type { Metadata } from 'next'
import DocsPage from '@/components/DocsPage'
import { contracts } from '@/lib/docs/contracts'

export const metadata: Metadata = {
  title: 'Contract Reference — BVCC Wallet Docs',
  description:
    'BVCC Wallet V5 smart contracts: addresses on Ethereum, Arbitrum, Base, BNB Chain, Polygon and Arbitrum Sepolia, the 30 validators, functions, AuthorizeParams, errors and security notes. V4 as the previous generation.',
}

export default function Page() {
  return <DocsPage doc={contracts} slug="contracts" />
}
