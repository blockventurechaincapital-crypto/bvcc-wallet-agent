import type { MetadataRoute } from 'next'

const BASE = 'https://bvccwallet.blockventurechaincapital.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const pages = [
    '',
    '/press',
    '/docs',
    '/docs/recovery',
    '/docs/migrate',
    '/docs/connect-ai',
    '/docs/agent-permissions',
    '/docs/agent-integration',
    '/docs/self-hosting',
    '/docs/contracts',
    '/docs/bundler-api',
    '/legal/terms',
    '/legal/risk-disclosure',
    '/legal/non-custodial',
    '/legal/agent-wallet',
    '/legal/swap-fast',
    '/legal/fees',
    '/legal/privacy',
  ]
  const entries: MetadataRoute.Sitemap = pages.map(path => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/press' ? 0.8 : 0.6,
  }))
  // Security report PDFs, so search and AI crawlers can find and cite them
  const reports = ['BVCC-Agent-Wallet-Security-Report.pdf', 'BVCC-Agent-Wallet-Informe-Seguridad.pdf'].map(f => ({
    url: `${BASE}/audits/${f}`,
    lastModified: new Date('2026-11-11'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  return [...entries, ...reports]
}
