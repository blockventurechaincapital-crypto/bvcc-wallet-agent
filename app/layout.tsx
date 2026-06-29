import type { Metadata } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
})

const OG_DESC =
  'Give your AI agent (Hermes, Claude, Cursor, LM Studio) a non-custodial wallet with limits it can\'t cross: period budget, allowed tokens, recipient whitelist and instant pause — enforced on-chain. Connect via MCP in one command. Self-custody with Face ID, no KYC.'

export const metadata: Metadata = {
  metadataBase: new URL('https://bvccwallet.blockventurechaincapital.com'),
  title: 'BVCC Agent Wallet — A non-custodial wallet for your AI agent',
  description:
    'Non-custodial smart wallet for AI agents. Connect Hermes, Claude, Cursor or LM Studio over MCP and let your agent transact within on-chain limits: budget, allowed tokens, recipients, instant pause. Self-custody, Face ID, no KYC. ERC-4337.',
  alternates: { canonical: 'https://bvccwallet.blockventurechaincapital.com' },
  keywords: [
    'AI agent wallet',
    'wallet for AI agents',
    'MCP wallet',
    'MCP crypto wallet',
    'Hermes agent wallet',
    'Claude agent wallet',
    'LM Studio wallet',
    'autonomous agent wallet',
    'non-custodial agent wallet',
    'agentic payments',
    'agent wallet',
    'smart wallet',
    'self-custody wallet',
    'ERC-4337',
    'WebAuthn',
    'Face ID wallet',
    'open source wallet',
    'self-hosted wallet',
    'BVCC',
  ],
  openGraph: {
    type: 'website',
    url: 'https://bvccwallet.blockventurechaincapital.com',
    siteName: 'BVCC Agent Wallet',
    title: 'BVCC Agent Wallet — A non-custodial wallet for your AI agent',
    description: OG_DESC,
    images: [{ url: '/bvcc_wallet.png', width: 1254, height: 1254, alt: 'BVCC Agent Wallet' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BVCC Agent Wallet — A non-custodial wallet for your AI agent',
    description: OG_DESC,
    images: ['/bvcc_wallet.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${inter.variable} ${plexMono.variable}`}
        style={{ backgroundColor: '#06080f', color: '#f0f4f8' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
