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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.blockventurechaincapital.com/#organization',
      name: 'BlockVenture Chain Capital',
      url: 'https://www.blockventurechaincapital.com/',
      logo: 'https://www.blockventurechaincapital.com/assets/images/logo.png',
      email: 'contact@blockventurechaincapital.com',
      description: 'DeFi firm building a suite of Uniswap v4 products: the Dynamic Fee Hook (anti-bot protection for liquidity pools), the BVCC Agent Wallet (a non-custodial wallet for AI agents), and Hook Analytics (a real-time on-chain dashboard).',
      foundingDate: '2024-09',
      slogan: 'DeFi infrastructure for Uniswap v4 — anti-bot hooks, an agent wallet, and on-chain analytics.',
      knowsAbout: [
        'Uniswap v4 hooks',
        'MEV and sniper-bot protection',
        'Dynamic swap fees',
        'ERC-4337 account abstraction',
        'Non-custodial smart wallets for AI agents',
        'On-chain analytics',
      ],
      sameAs: [
        'https://x.com/BLOCVENCHAINCAP',
        'https://github.com/blockventurechaincapital-crypto',
        'https://www.linkedin.com/company/blockventure-chain-capital',
        'https://t.me/BVCC_Hook',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://bvccwallet.blockventurechaincapital.com/#website',
      name: 'BVCC Agent Wallet',
      url: 'https://bvccwallet.blockventurechaincapital.com/',
      inLanguage: ['en', 'es'],
      publisher: { '@id': 'https://www.blockventurechaincapital.com/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://bvccwallet.blockventurechaincapital.com/#app',
      name: 'BVCC Agent Wallet',
      datePublished: '2026',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web (ERC-4337 smart account on Ethereum, Arbitrum, Base, BNB Chain, Polygon)',
      url: 'https://bvccwallet.blockventurechaincapital.com/',
      description:
        'Experimental non-custodial smart wallet for WebAuthn account abstraction and permission-limited AI agent execution. Give an AI agent a wallet with on-chain limits it cannot cross: period budget, allowed tokens, recipient whitelist, and instant pause. Connect any MCP client (Hermes, Claude, Cursor, LM Studio).',
      featureList: [
        'Non-custodial self-custody with WebAuthn / passkeys (Face ID, fingerprint, security key)',
        'AI-agent permissions enforced on-chain: period budget, allowed tokens, recipient whitelist, instant pause',
        'MCP integration with Hermes, Claude, Cursor, and LM Studio',
        'ERC-4337 account abstraction and ERC-7821 batch execution',
        'No KYC, no email',
        'Open source and self-hostable',
      ],
      isAccessibleForFree: true,
      publisher: { '@id': 'https://www.blockventurechaincapital.com/#organization' },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://bvccwallet.blockventurechaincapital.com/#faq',
      inLanguage: 'en',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is the BVCC Agent Wallet?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The BVCC Agent Wallet is an experimental, non-custodial smart wallet (ERC-4337 account abstraction with WebAuthn passkeys) that lets you give an AI agent its own wallet with on-chain limits it cannot cross. You keep self-custody; the agent transacts only within the budget, tokens and recipients you allow.',
          },
        },
        {
          '@type': 'Question',
          name: 'What limits can I set on an AI agent?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You define four limits enforced on-chain: a spending budget per period, an allowed-tokens list, a recipient whitelist, and an instant pause. The agent holds its own keypair and can never exceed them — BVCC never sees the agent keys.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which AI agents and MCP clients can connect?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Any MCP (Model Context Protocol) client connects in one command, including Hermes, Claude, Cursor and LM Studio. The wallet exposes tools the agent calls to transact within its limits.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is it really non-custodial?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. BVCC never receives or stores your private keys, cannot recover wallets, and cannot reverse transactions. You authenticate with WebAuthn passkeys (Face ID, fingerprint or a security key), and Ethereum is the only record of your account.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need KYC or an email?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. There is no KYC, no email and no sign-up forms. You create a wallet directly with a passkey on your device.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which networks are supported?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The wallet runs on Ethereum, Arbitrum, Base, BNB Chain and Polygon, using ERC-4337 account abstraction and ERC-7821 batch execution. Arbitrum Sepolia is the active testnet.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is it open source?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. The BVCC Agent Wallet is open source and self-hostable, with its code on GitHub. Smart contracts may still contain bugs — it is Public Beta, so use it accordingly.',
          },
        },
      ],
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${inter.variable} ${plexMono.variable}`}
        style={{ backgroundColor: '#06080f', color: '#f0f4f8' }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
