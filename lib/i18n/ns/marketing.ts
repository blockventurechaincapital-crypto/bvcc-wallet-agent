export const marketing = {
  en: {
    marketing: {
      // Nav
      navAgents: 'Agents',
      navPhilosophy: 'Philosophy',
      navOpenSource: 'Open Source',
      navNetworks: 'Networks',
      navGithub: 'GitHub ↗',
      navEnter: 'Enter →',
      navAccess: 'Access',
      navCreateWallet: 'Create wallet',

      // Hero
      eyebrow: 'Public Beta · Non-Custodial · Open Source · AI Agent Permissions',
      heroLine1: 'BVCC Agent',
      heroLine2: '',
      heroLine3Part1: '',
      heroLine3Gold: 'Wallet',
      heroLine3Part2: '',
      lede: 'Experimental non-custodial smart wallet for WebAuthn account abstraction and permission-limited AI agent execution.',
      heroCreateBtn: 'Create beta wallet',
      heroRiskNotice: 'Use small amounts only. Smart contracts may contain bugs. BVCC does not custody funds, recover wallets, or reverse transactions.',
      heroIHaveOne: 'I already have one',
      recoverLine: 'Lost access?',
      recoverCta: 'Recover with your guardians',
      waitingBiometrics: 'Waiting for biometrics…',

      // Account card (hero aside)
      cardChip: 'Agent wallet',
      cardKicker: 'Agent permissions',
      cardBudgetLabel: 'Period budget',
      cardRecipients: 'Recipients',
      cardRecipientsValue: '3 allowed',
      cardRenewal: 'Renewal',
      cardRenewalValue: 'every 30 days',
      cardStatus: 'Status',
      cardStatusValue: '● Active',
      cardSealText: 'Authorised by\nyour Face ID',

      // Agents section
      sectionAgents: '§01 — AI Agents',
      agentsH2Part1: 'Delegate to an AI',
      agentsH2Gold: 'without',
      agentsH2Part2: 'giving up control.',
      agentsLede: 'The agent wallet lets an autonomous agent operate on your behalf within limits you define in detail. And if something is off, pause it instantly.',
      agentsCreateBtn: 'Create agent wallet',
      agentFeature1Title: 'Period budget',
      agentFeature1Body: 'Define how much it can spend and how often it renews.',
      agentFeature2Title: 'Recipient whitelist',
      agentFeature2Body: 'The agent only sends to addresses you authorise.',
      agentFeature3Title: 'Instant pause',
      agentFeature3Body: 'Freeze all agent activity with a single signature.',
      agentFeature4Title: 'EOA agents only',
      agentFeature4Body: 'External accounts only — never opaque contracts.',

      // Manifesto
      sectionPhilosophy: '§02 — Philosophy',
      quoteText: 'We do not hold your keys. We do not know your name. There is no server that',
      quoteGold: 'controls your wallet',
      quoteEnd: '. You hold the keys; the contract executes only what you sign.',
      quoteBy: '— Founding principle, BVCC',

      // Capabilities
      sectionCaps: '§03 — Capabilities',
      capsH2Part1: 'Built as a',
      capsH2Gold: 'security-focused smart account',
      capsH2Part2: ', not just an app.',

      cap01Title: 'WebAuthn / Passkeys',
      cap01Body: 'Authentication uses passkeys/WebAuthn through the device\'s secure authentication system when available. BVCC does not receive, store, or custody private keys.',
      cap01Tag: 'Face ID · WebAuthn · P256',

      cap02Title: 'Private by design',
      cap02Body: 'No emails, no KYC, no forms. There is no user database that can be leaked or subpoenaed. Ethereum is the only record of your account.',
      cap02Tag: 'Zero personal data',

      cap03Title: 'Sovereign recovery',
      cap03Body: 'You designate three trusted guardians. If you lose your device, two of them sign the key change — subject to a 48-hour timelock you can cancel.',
      cap03Tag: '2-of-3 · 48h timelock',

      cap04Title: 'Real smart account',
      cap04Body: 'ERC-4337 for account abstraction and ERC-7821 for batch execution. Connect to any dApp via WalletConnect and operate like a real smart account.',
      cap04Tag: 'ERC-4337 · ERC-7821',

      // How it works
      sectionHow: '§04 — The journey',
      step01Title: 'Register your face',
      step01Body: 'A single Face ID tap creates your key pair inside the device.',
      step02Title: 'Deploy your contract',
      step02Body: 'CREATE2 derives the address from your public key. Deterministic, no server.',
      step03Title: 'Operate freely',
      step03Body: 'Send, receive, swap and connect dApps. Your account, your rules.',
      step04Title: 'Recover if needed',
      step04Body: 'Your guardians restore access without anyone else touching your funds.',

      // Security
      sectionSecurity: '§05 — Security',
      secH2Part1: 'You self-custody',
      secH2Gold: 'your own funds',
      secH2Part2: ' — verifiable on-chain.',
      secLede: 'Your wallet address is derived from your public key via CREATE2: deterministic, verifiable, independent of any database. What you sign is exactly what gets executed. The code is open source so you can audit it yourself.',
      secStat1Title: 'WebAuthn / Passkeys',
      secStat1Body: 'Your passkey is managed by your device/browser. BVCC does not receive, store, or custody private keys.',
      secStat2Title: '2-of-3 guardians',
      secStat2Body: 'Social recovery without custodians or third parties.',
      secStat3Title: '48h timelock',
      secStat3Body: 'Every recovery is reversible while you wait.',
      secStat4Title: 'CREATE2',
      secStat4Body: 'Deterministic address, auditable on-chain.',

      // Open source
      sectionOss: '§06 — Open source',
      ossH2Part1: 'Don\'t trust us.',
      ossH2Gold: 'Verify it',
      ossH2Part2: ' — and run it yourself.',
      ossLede: 'The dashboard, contracts and bundler are open source. If the site goes down, if you prefer total sovereignty, or if you just want to audit every line: clone the repo and create and manage your wallets in your own local environment. Nothing depends on our servers.',
      ossGithubBtn: 'View on GitHub',
      termLocalDashboard: '▸ Local dashboard at http://localhost:3000',
      termKeysNote: '▸ BVCC does not receive, store, or custody private keys',

      // Fees & Networks
      sectionFees: '§07 — Fees',
      feePerTx: 'per transaction',
      feesNote: 'Transparent and on-chain. The fee travels in the same transaction — no hidden charges, no subscriptions.',
      sectionDeployed: 'Deployed on',
      testnetActive: '● Active testnet · Arbitrum Sepolia',

      // CTA
      ctaTitle1: 'Your key. Your wealth.',
      ctaTitle2Gold: 'Your rule.',
      ctaAccessBtn: 'Access',

      // Footer
      footerTagline: 'BlockVenture Chain Capital — experimental open-source non-custodial smart wallet.',
      footerProduct: 'Product',
      footerCreateWallet: 'Create wallet',
      footerAccess: 'Access',
      footerRecover: 'Recover',
      footerBvcc: 'BVCC',
      footerMainSite: 'Main site',
      footerAnalytics: 'Analytics',
      footerStandards: 'Standards',
      footerEthereum: 'Ethereum is the database.',
    },
  },
  es: {
    marketing: {
      // Nav
      navAgents: 'Agentes',
      navPhilosophy: 'Filosofía',
      navOpenSource: 'Código abierto',
      navNetworks: 'Redes',
      navGithub: 'GitHub ↗',
      navEnter: 'Entrar →',
      navAccess: 'Acceder',
      navCreateWallet: 'Crear wallet',

      // Hero
      eyebrow: 'Beta pública · Sin custodia · Open Source · Permisos para agentes IA',
      heroLine1: 'BVCC Agent',
      heroLine2: '',
      heroLine3Part1: '',
      heroLine3Gold: 'Wallet',
      heroLine3Part2: '',
      lede: 'Smart wallet experimental y sin custodia para abstracción de cuenta con WebAuthn y ejecución de agentes IA con permisos limitados.',
      heroCreateBtn: 'Crear wallet beta',
      heroRiskNotice: 'Usa solo cantidades pequeñas. Los contratos inteligentes pueden contener errores. BVCC no custodia fondos, no recupera wallets ni revierte transacciones.',
      heroIHaveOne: 'Ya tengo una',
      recoverLine: '¿Perdiste el acceso?',
      recoverCta: 'Recupera con tus guardianes',
      waitingBiometrics: 'Esperando biometría…',

      // Account card (hero aside)
      cardChip: 'Agent wallet',
      cardKicker: 'Permisos del agente',
      cardBudgetLabel: 'Presupuesto del periodo',
      cardRecipients: 'Destinatarios',
      cardRecipientsValue: '3 permitidos',
      cardRenewal: 'Renovación',
      cardRenewalValue: 'cada 30 días',
      cardStatus: 'Estado',
      cardStatusValue: '● Activo',
      cardSealText: 'Autorizado por\ntu Face ID',

      // Agents section
      sectionAgents: '§01 — Agentes IA',
      agentsH2Part1: 'Delega en una IA',
      agentsH2Gold: 'sin',
      agentsH2Part2: 'ceder el control.',
      agentsLede: 'La agent wallet permite que un agente autónomo opere por ti dentro de límites que tú defines al detalle. Y si algo no encaja, lo pausas al instante.',
      agentsCreateBtn: 'Crear agent wallet',
      agentFeature1Title: 'Presupuesto por periodo',
      agentFeature1Body: 'Define cuánto puede gastar y cada cuánto se renueva.',
      agentFeature2Title: 'Lista de destinatarios',
      agentFeature2Body: 'El agente solo envía a direcciones que tú autorizas.',
      agentFeature3Title: 'Pausa instantánea',
      agentFeature3Body: 'Congela toda actividad del agente con una sola firma.',
      agentFeature4Title: 'Agentes EOA',
      agentFeature4Body: 'Solo cuentas externas, nunca contratos opacos.',

      // Manifesto
      sectionPhilosophy: '§02 — Filosofía',
      quoteText: 'No guardamos tus claves. No conocemos tu nombre. No existe un servidor que',
      quoteGold: 'controle tu wallet',
      quoteEnd: '. Tú tienes las claves; el contrato ejecuta solo lo que firmas.',
      quoteBy: '— Principio fundacional, BVCC',

      // Capabilities
      sectionCaps: '§03 — Capacidades',
      capsH2Part1: 'Construida como una',
      capsH2Gold: 'cuenta inteligente con foco en seguridad',
      capsH2Part2: ', no solo como una app.',

      cap01Title: 'WebAuthn / Passkeys',
      cap01Body: 'La autenticación se realiza mediante passkeys/WebAuthn usando el sistema seguro del dispositivo cuando está disponible. BVCC no recibe, almacena ni custodia claves privadas.',
      cap01Tag: 'Face ID · WebAuthn · P256',

      cap02Title: 'Anónimo por diseño',
      cap02Body: 'Sin correos, sin KYC, sin formularios. No existe una base de datos de usuarios que pueda filtrarse o ser citada. Ethereum es el único registro de tu cuenta.',
      cap02Tag: 'Cero datos personales',

      cap03Title: 'Recuperación soberana',
      cap03Body: 'Designas tres guardianes de confianza. Si pierdes el dispositivo, dos de ellos firman el cambio de clave — sujeto a un timelock de 48 horas que tú puedes cancelar.',
      cap03Tag: '2-de-3 · timelock 48h',

      cap04Title: 'Cuenta inteligente real',
      cap04Body: 'ERC-4337 para abstracción de cuenta y ERC-7821 para ejecución por lotes. Conecta con cualquier dApp vía WalletConnect y opera como una cuenta inteligente real.',
      cap04Tag: 'ERC-4337 · ERC-7821',

      // How it works
      sectionHow: '§04 — El recorrido',
      step01Title: 'Registra tu rostro',
      step01Body: 'Una sola pulsación de Face ID crea tu par de claves dentro del dispositivo.',
      step02Title: 'Despliega tu contrato',
      step02Body: 'CREATE2 deriva la dirección desde tu clave pública. Determinista, sin servidor.',
      step03Title: 'Opera con libertad',
      step03Body: 'Envía, recibe, intercambia y conecta dApps. Tu cuenta, tus reglas.',
      step04Title: 'Recupera si hace falta',
      step04Body: 'Tus guardianes restauran el acceso sin que nadie más toque tus fondos.',

      // Security
      sectionSecurity: '§05 — Seguridad',
      secH2Part1: 'Tú auto-custodias',
      secH2Gold: 'tus propios fondos',
      secH2Part2: ' — verificable on-chain.',
      secLede: 'La dirección de tu wallet se deriva de tu clave pública mediante CREATE2: determinista, verificable, sin depender de ninguna base de datos. Lo que firmas es exactamente lo que se ejecuta. El código es open source para que puedas auditarlo tú mismo.',
      secStat1Title: 'WebAuthn / Passkeys',
      secStat1Body: 'Tu passkey se gestiona por el dispositivo/navegador. BVCC no recibe, almacena ni custodia claves privadas.',
      secStat2Title: '2-de-3 guardianes',
      secStat2Body: 'Recuperación social sin custodios ni terceros.',
      secStat3Title: 'Timelock 48h',
      secStat3Body: 'Toda recuperación es reversible mientras esperas.',
      secStat4Title: 'CREATE2',
      secStat4Body: 'Dirección determinista, auditable on-chain.',

      // Open source
      sectionOss: '§06 — Código abierto',
      ossH2Part1: 'No confíes en nosotros.',
      ossH2Gold: 'Verifícalo',
      ossH2Part2: ' — y córrelo tú mismo.',
      ossLede: 'El dashboard, los contratos y el bundler son código abierto. Si la web cae, si prefieres soberanía total o si solo quieres auditar cada línea: clona el repo y crea y gestiona tus wallets en tu propio entorno local. Nada depende de nuestros servidores.',
      ossGithubBtn: 'Ver en GitHub',
      termLocalDashboard: '▸ Dashboard local en http://localhost:3000',
      termKeysNote: '▸ BVCC no recibe, almacena ni custodia claves privadas',

      // Fees & Networks
      sectionFees: '§07 — Comisiones',
      feePerTx: 'por transacción',
      feesNote: 'Transparente y on-chain. La comisión viaja en la misma transacción — sin cargos ocultos, sin suscripciones.',
      sectionDeployed: 'Desplegada en',
      testnetActive: '● Testnet activa · Arbitrum Sepolia',

      // CTA
      ctaTitle1: 'Tu llave. Tu patrimonio.',
      ctaTitle2Gold: 'Tu regla.',
      ctaAccessBtn: 'Acceder',

      // Footer
      footerTagline: 'BlockVenture Chain Capital — smart wallet experimental, open-source y sin custodia.',
      footerProduct: 'Producto',
      footerCreateWallet: 'Crear wallet',
      footerAccess: 'Acceder',
      footerRecover: 'Recuperar',
      footerBvcc: 'BVCC',
      footerMainSite: 'Web principal',
      footerAnalytics: 'Analytics',
      footerStandards: 'Estándares',
      footerEthereum: 'Ethereum es la base de datos.',
    },
  },
}
