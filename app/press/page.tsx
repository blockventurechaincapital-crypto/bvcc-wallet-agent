import type { Metadata } from 'next'
import PressPage from '@/components/PressPage'

const TITLE = 'Press Kit — BVCC Agent Wallet'
const DESC =
  'Press kit for BVCC Agent Wallet: one-page media kit, logos, screenshots, verified numbers, brand colors and boilerplate copy for journalists and creators.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/press' },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: '/press',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
}

export default function Page() {
  return <PressPage />
}
