import type { MetadataRoute } from 'next'

const BASE = 'https://bvccwallet.blockventurechaincapital.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/wallet/', '/api/', '/recover'],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
