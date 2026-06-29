// Docs navigation tree (Uniswap-docs style sidebar) — shared by sidebar, index and prev/next.
// Docs content is localized EN/ES via { en, es } objects (not the ns dict system:
// article blocks are structured data, not flat UI strings).
export type DocSlug =
  | 'index'
  | 'connect-ai'
  | 'agent-integration'
  | 'self-hosting'
  | 'contracts'
  | 'bundler-api'

export interface Localized {
  en: string
  es: string
}

export interface DocNavItem {
  slug: DocSlug
  href: string
  label: Localized
  blurb: Localized
}

export interface DocNavGroup {
  title: Localized
  items: DocNavItem[]
}

export const DOC_NAV: DocNavGroup[] = [
  {
    title: { en: 'Getting Started', es: 'Primeros pasos' },
    items: [
      {
        slug: 'index',
        href: '/docs',
        label: { en: 'Overview', es: 'Visión general' },
        blurb: {
          en: 'What BVCC Wallet is and where to start.',
          es: 'Qué es BVCC Wallet y por dónde empezar.',
        },
      },
      {
        slug: 'self-hosting',
        href: '/docs/self-hosting',
        label: { en: 'Setup & Self-Hosting', es: 'Instalación y self-hosting' },
        blurb: {
          en: 'Clone, configure .env.local, optional bundler, PM2 + nginx deployment.',
          es: 'Clonar, configurar .env.local, bundler opcional, despliegue con PM2 + nginx.',
        },
      },
    ],
  },
  {
    title: { en: 'AI Agents', es: 'Agentes IA' },
    items: [
      {
        slug: 'connect-ai',
        href: '/docs/connect-ai',
        label: { en: 'Connect an AI Assistant (MCP)', es: 'Conecta un asistente IA (MCP)' },
        blurb: {
          en: 'Connect Hermes, Claude, Cursor or LM Studio over MCP — install, configure, authorize, verify.',
          es: 'Conecta Hermes, Claude, Cursor o LM Studio vía MCP — instalar, configurar, autorizar, verificar.',
        },
      },
      {
        slug: 'agent-integration',
        href: '/docs/agent-integration',
        label: { en: 'Agent Integration', es: 'Integración de agentes' },
        blurb: {
          en: 'How an AI agent calls executeAsAgent — encoding, limits, whitelists, errors, Foundry + viem examples.',
          es: 'Cómo un agente IA llama executeAsAgent — encoding, límites, whitelists, errores, ejemplos Foundry + viem.',
        },
      },
    ],
  },
  {
    title: { en: 'Reference', es: 'Referencia' },
    items: [
      {
        slug: 'contracts',
        href: '/docs/contracts',
        label: { en: 'Contract Reference', es: 'Referencia de contratos' },
        blurb: {
          en: 'Wallets, factories, AuthorizeParams, deployed addresses, security notes.',
          es: 'Wallets, factories, AuthorizeParams, direcciones desplegadas, notas de seguridad.',
        },
      },
      {
        slug: 'bundler-api',
        href: '/docs/bundler-api',
        label: { en: 'Bundler API', es: 'API del bundler' },
        blurb: {
          en: 'POST /api/send-userop spec, sender validation, fallback behavior.',
          es: 'Spec de POST /api/send-userop, validación del sender, comportamiento del fallback.',
        },
      },
    ],
  },
]

export const DOC_FLAT: DocNavItem[] = DOC_NAV.flatMap((g) => g.items)

// Small UI strings for the docs shell (sidebar / TOC / prev-next / index)
export const DOCS_UI = {
  kicker: { en: 'Developer Docs', es: 'Docs para desarrolladores' },
  links: { en: 'Links', es: 'Enlaces' },
  securityReport: { en: 'Security Report (PDF) ↗', es: 'Informe de seguridad (PDF) ↗' },
  backToWallet: { en: '← Back to BVCC Wallet', es: '← Volver a BVCC Wallet' },
  onThisPage: { en: 'On this page', es: 'En esta página' },
  previous: { en: '← Previous', es: '← Anterior' },
  next: { en: 'Next →', es: 'Siguiente →' },
  read: { en: 'Read →', es: 'Leer →' },
} satisfies Record<string, Localized>

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Spanish headings)
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
