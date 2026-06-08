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
  'Da una wallet a tu agente IA con límites que no puede cruzar: presupuesto por periodo, lista de destinatarios y pausa instantánea. Auto-custodia con Face ID, sin KYC.'

export const metadata: Metadata = {
  metadataBase: new URL('https://wallet.blockventurechaincapital.com'),
  title: 'BVCC Wallet — Smart wallet para ti y tu agente IA',
  description:
    'Smart wallet auto-custodiada con Face ID. Entrega una agent wallet a tu IA con límites reales: presupuesto, lista de destinatarios y pausa instantánea. Sin KYC, ERC-4337.',
  keywords: [
    'wallet para agentes IA',
    'agent wallet',
    'smart wallet biométrica',
    'self-custody wallet',
    'ERC-4337',
    'WebAuthn',
    'Face ID wallet',
    'agentes autónomos on-chain',
    'agentic payments',
    'open source wallet',
    'self-hosted wallet',
    'BVCC',
  ],
  openGraph: {
    type: 'website',
    url: 'https://wallet.blockventurechaincapital.com',
    siteName: 'BVCC Wallet',
    title: 'BVCC Wallet — Smart wallet para ti y tu agente IA',
    description: OG_DESC,
    images: [{ url: '/bvcc_wallet.png', width: 1254, height: 1254, alt: 'BVCC Wallet' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BVCC Wallet — Smart wallet para ti y tu agente IA',
    description: OG_DESC,
    images: ['/bvcc_wallet.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${inter.className} ${inter.variable} ${plexMono.variable}`}
        style={{ backgroundColor: '#06080f', color: '#f0f4f8' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
