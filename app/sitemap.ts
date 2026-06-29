import type { MetadataRoute } from 'next'

const BASE = 'https://bvccwallet.blockventurechaincapital.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const pages = [
    '',
    '/docs',
    '/docs/connect-ai',
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
  return pages.map(path => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }))
}
