// Docs navigation tree (Uniswap-docs style sidebar) — shared by sidebar, index and prev/next
export type DocSlug = 'index' | 'agent-integration' | 'self-hosting' | 'contracts' | 'bundler-api'

export interface DocNavItem {
  slug: DocSlug
  href: string
  label: string
  blurb: string
}

export interface DocNavGroup {
  title: string
  items: DocNavItem[]
}

export const DOC_NAV: DocNavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      {
        slug: 'index',
        href: '/docs',
        label: 'Overview',
        blurb: 'What BVCC Wallet is and where to start.',
      },
      {
        slug: 'self-hosting',
        href: '/docs/self-hosting',
        label: 'Setup & Self-Hosting',
        blurb: 'Clone, configure .env.local, optional bundler, PM2 + nginx deployment.',
      },
    ],
  },
  {
    title: 'AI Agents',
    items: [
      {
        slug: 'agent-integration',
        href: '/docs/agent-integration',
        label: 'Agent Integration',
        blurb: 'How an AI agent calls executeAsAgent — encoding, limits, whitelists, errors, Foundry + viem examples.',
      },
    ],
  },
  {
    title: 'Reference',
    items: [
      {
        slug: 'contracts',
        href: '/docs/contracts',
        label: 'Contract Reference',
        blurb: 'Wallets, factories, AuthorizeParams, deployed addresses, security notes.',
      },
      {
        slug: 'bundler-api',
        href: '/docs/bundler-api',
        label: 'Bundler API',
        blurb: 'POST /api/send-userop spec, sender validation, fallback behavior.',
      },
    ],
  },
]

export const DOC_FLAT: DocNavItem[] = DOC_NAV.flatMap((g) => g.items)

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
