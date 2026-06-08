// Legal / disclosure pages (Terms, Risk, Non-Custodial, Agent Wallet, Fees, Privacy).
// Reference page content as dict[lang].legal.<slug>; footer/nav labels as t('legal.nav.<key>').
export const legal = {
  en: {
    legal: {
      footerHeading: 'Legal',
      readMore: 'Full disclosures:',
      back: '← Back to home',
      kicker: 'BVCC Agent Wallet · Experimental public beta',
      moreHeading: 'More disclosures',
      note: 'The BlockVenture Chain Capital brand/project is a Web3 brand/project — not an incorporated company, bank, broker, exchange, custodian, investment firm, or regulated financial institution. BVCC Wallet is experimental, open-source, non-custodial public beta software.',
      nav: {
        terms: 'Terms',
        risk: 'Risk Disclosure',
        nonCustodial: 'Non-Custodial',
        agent: 'Agent Wallet',
        swap: 'Swap Fast',
        fees: 'Fees',
        privacy: 'Privacy',
      },
      terms: {
        title: 'Terms of Use',
        intro:
          'These terms govern your use of BVCC Wallet, an experimental, open-source, non-custodial public beta smart wallet published by the BlockVenture Chain Capital brand/project.',
        body: [
          'BVCC Wallet is experimental public beta software, provided "as is" and "as available", without warranties of any kind.',
          'BVCC does not guarantee uninterrupted access, error-free or bug-free operation, or absolute security. The software may change, break, or be discontinued at any time.',
          'You use BVCC Wallet entirely at your own risk and are solely responsible for your wallet, assets, permissions, agents, and transactions.',
          'BVCC does not provide financial, investment, tax, or legal advice. Nothing in the app is a recommendation to buy, sell, or hold any asset.',
          'BVCC Wallet is non-custodial. The BlockVenture Chain Capital brand/project does not custody, control, manage, recover, or reverse user funds or transactions.',
          'The BlockVenture Chain Capital brand/project is currently a Web3 brand/project. It is not an incorporated company, bank, broker, exchange, custodian, investment firm, or regulated financial institution.',
          'You are responsible for understanding how blockchains, smart contracts, account abstraction, and AI agent permissions work before using the app.',
          'To the maximum extent permitted by law, BVCC and its contributors are not liable for any loss arising from your use of the software.',
        ],
      },
      risk: {
        title: 'Risk Disclosure',
        intro: 'Using BVCC Wallet involves significant risk. Please read the following before using the app.',
        body: [
          'Smart contracts may contain bugs or vulnerabilities, even after internal testing. BVCC Wallet has not been externally audited.',
          'Blockchain transactions are irreversible. Once confirmed they cannot be undone, cancelled, or refunded.',
          'You may lose funds due to mistakes, software bugs, compromised or lost devices, malicious or misconfigured agents, phishing, bad configuration, protocol failures, network issues, or market volatility.',
          'Third-party protocols, RPC providers, bridges, swaps, dApps, wallets, and on-ramp providers carry their own independent risks that BVCC does not control.',
          'During the public beta you should use small amounts only, and never use funds you cannot afford to lose.',
        ],
      },
      nonCustodial: {
        title: 'Non-Custodial Disclaimer',
        intro: 'BVCC Wallet is non-custodial software. You — and only you — control your wallet.',
        body: [
          'The BlockVenture Chain Capital brand/project does not hold your private keys.',
          'BVCC does not custody your assets.',
          'BVCC cannot recover wallets or restore lost access on your behalf.',
          'BVCC cannot reverse, cancel, or modify blockchain transactions.',
          'BVCC cannot move, freeze, or access funds on your behalf.',
          'You control your wallet through WebAuthn/passkeys and the guardians you configure. Keeping your device and guardians secure is your responsibility.',
        ],
      },
      agent: {
        title: 'Agent Wallet Disclaimer',
        intro:
          'Agent Wallet lets you delegate on-chain execution to an external address within limits you define. Review this before authorizing any agent.',
        body: [
          'Agent Wallet allows you to authorize an external wallet address to act as an agent.',
          'The agent may execute transactions only within the limits you configure.',
          'The BlockVenture Chain Capital brand/project does not operate, control, monitor, or guarantee the behavior of any agent you authorize.',
          'You are responsible for reviewing the agent address, max per transaction, daily limit, total budget, period budget, allowed tokens, allowed protocols, allowed recipients, and expiry before approving.',
          'Incorrect or overly permissive configuration may lead to loss of funds.',
          'You can pause or revoke agent permissions where supported by the wallet.',
        ],
      },
      swap: {
        title: 'Swap Fast Disclaimer',
        intro:
          'Swap Fast is a convenience interface that lets you swap tokens directly from your wallet. BVCC does not operate an exchange and does not execute, price, route, or settle your swaps — the Uniswap v3 protocol does.',
        body: [
          'Swaps are executed entirely by the Uniswap v3 protocol — independent, third-party, decentralized smart contracts deployed on each blockchain. BVCC Wallet only builds the transaction and submits it on your behalf.',
          'The BlockVenture Chain Capital brand/project is not Uniswap, is not affiliated with, endorsed by, or partnered with Uniswap, and does not control the Uniswap protocol, its smart contracts, liquidity, pools, prices, or routing.',
          'BVCC is not a broker, dealer, exchange, market maker, or liquidity provider. It does not match orders, hold order books, or take custody of funds at any point during a swap.',
          'Prices, quotes, the selected pool fee tier, and the "minimum received" are estimates derived on-chain from the Uniswap protocol at quote time. The final executed price is determined by the protocol and on-chain liquidity at execution and may differ.',
          'You set your own slippage tolerance. A swap may fail, partially execute as governed by the protocol, or return less than expected due to slippage, price movement, low liquidity, or MEV. BVCC does not guarantee any price, rate, or outcome.',
          'The BVCC interface fee (see Fee Disclosure) is separate from, and additional to, the Uniswap protocol/liquidity-provider fee and blockchain gas costs. BVCC does not receive the Uniswap or LP fees.',
          'Token contracts you swap may be malicious, illiquid, or worthless. You are solely responsible for verifying any token before swapping. Blockchain transactions are irreversible.',
          'Swap Fast availability depends on the Uniswap protocol being deployed on the selected network and is provided "as is", without warranties. Use at your own risk.',
        ],
      },
      fees: {
        title: 'Fee Disclosure',
        intro:
          'BVCC Wallet applies a small protocol fee on certain value-moving transactions, collected automatically on-chain.',
        body: [
          'Standard Wallet fee: 0.05% per applicable transaction.',
          'Agent Wallet fee: 0.15% per applicable transaction.',
          'Fees are collected automatically on-chain when applicable, within the same transaction.',
          'Fees may apply differently depending on the transaction type: native ETH transfer, ERC-20 transfer, or DeFi/swap balance increase.',
          'Blockchain gas fees and any third-party protocol fees are separate from, and additional to, BVCC Wallet fees.',
        ],
        feeWalletLabel: 'Fee wallet address',
        address: '0x3e3eb089169a7315a994947465ce5f5FC3A307D4',
      },
      privacy: {
        title: 'Privacy Policy',
        intro:
          'BVCC Wallet is designed to minimize data collection. There are no traditional accounts and no user database.',
        body: [
          'BVCC Wallet does not require traditional user accounts.',
          'BVCC Wallet does not require KYC or personal identity verification.',
          'BVCC Wallet does not intentionally collect your private keys or seed phrases.',
          'Some preferences (such as language, selected network, or disclaimer acceptance) may be stored locally in your browser using localStorage.',
          'Blockchain activity is public by nature; addresses and transactions are visible on-chain to anyone.',
          'Third-party services — including WalletConnect, RPC providers, dApps, analytics providers, and on-ramp providers — may process data according to their own privacy policies, which BVCC does not control.',
          'Never enter seed phrases or private keys into BVCC Wallet or any website. BVCC Wallet will never ask for them.',
        ],
      },
    },
  },
  es: {
    legal: {
      footerHeading: 'Legal',
      readMore: 'Divulgaciones completas:',
      back: '← Volver al inicio',
      kicker: 'BVCC Agent Wallet · Beta pública experimental',
      moreHeading: 'Más avisos',
      note: 'BlockVenture Chain Capital es una marca/proyecto Web3 — no una empresa constituida, banco, bróker, exchange, custodio, firma de inversión ni institución financiera regulada. BVCC Wallet es software experimental, de código abierto y no custodial, en beta pública.',
      nav: {
        terms: 'Términos',
        risk: 'Divulgación de riesgos',
        nonCustodial: 'No custodial',
        agent: 'Agent Wallet',
        swap: 'Swap Fast',
        fees: 'Comisiones',
        privacy: 'Privacidad',
      },
      terms: {
        title: 'Términos de uso',
        intro:
          'Estos términos regulan tu uso de BVCC Wallet, una smart wallet experimental, de código abierto y no custodial, en beta pública, publicada por la marca/proyecto BlockVenture Chain Capital.',
        body: [
          'BVCC Wallet es software experimental en beta pública, ofrecido "tal cual" y "según disponibilidad", sin garantías de ningún tipo.',
          'BVCC no garantiza el acceso ininterrumpido, el funcionamiento libre de errores o de fallos, ni la seguridad absoluta. El software puede cambiar, fallar o descontinuarse en cualquier momento.',
          'Usas BVCC Wallet completamente bajo tu propio riesgo y eres el único responsable de tu wallet, activos, permisos, agentes y transacciones.',
          'BVCC no ofrece asesoramiento financiero, de inversión, fiscal ni legal. Nada en la app es una recomendación para comprar, vender o mantener ningún activo.',
          'BVCC Wallet es no custodial. La marca/proyecto BlockVenture Chain Capital no custodia, controla, gestiona, recupera ni revierte fondos o transacciones de los usuarios.',
          'BlockVenture Chain Capital es actualmente una marca/proyecto Web3. No es una empresa constituida, banco, bróker, exchange, custodio, firma de inversión ni institución financiera regulada.',
          'Eres responsable de entender cómo funcionan las blockchains, los contratos inteligentes, la abstracción de cuenta y los permisos de agentes IA antes de usar la app.',
          'En la máxima medida permitida por la ley, BVCC y sus colaboradores no son responsables de ninguna pérdida derivada de tu uso del software.',
        ],
      },
      risk: {
        title: 'Divulgación de riesgos',
        intro: 'Usar BVCC Wallet conlleva riesgos importantes. Lee lo siguiente antes de usar la app.',
        body: [
          'Los contratos inteligentes pueden contener errores o vulnerabilidades, incluso tras pruebas internas. BVCC Wallet no ha sido auditada externamente.',
          'Las transacciones en blockchain son irreversibles. Una vez confirmadas no se pueden deshacer, cancelar ni reembolsar.',
          'Puedes perder fondos por errores, fallos de software, dispositivos comprometidos o perdidos, agentes maliciosos o mal configurados, phishing, mala configuración, fallos de protocolos, problemas de red o volatilidad del mercado.',
          'Los protocolos de terceros, proveedores RPC, bridges, swaps, dApps, wallets y proveedores de on-ramp tienen sus propios riesgos independientes que BVCC no controla.',
          'Durante la beta pública debes usar solo cantidades pequeñas y nunca fondos que no puedas permitirte perder.',
        ],
      },
      nonCustodial: {
        title: 'Aviso de no custodia',
        intro: 'BVCC Wallet es software no custodial. Tú — y solo tú — controlas tu wallet.',
        body: [
          'La marca/proyecto BlockVenture Chain Capital no guarda tus claves privadas.',
          'BVCC no custodia tus activos.',
          'BVCC no puede recuperar wallets ni restaurar el acceso perdido en tu nombre.',
          'BVCC no puede revertir, cancelar ni modificar transacciones en blockchain.',
          'BVCC no puede mover, congelar ni acceder a los fondos en tu nombre.',
          'Controlas tu wallet mediante WebAuthn/passkeys y los guardians que configures. Mantener seguros tu dispositivo y tus guardians es tu responsabilidad.',
        ],
      },
      agent: {
        title: 'Aviso de Agent Wallet',
        intro:
          'Agent Wallet te permite delegar la ejecución on-chain a una dirección externa dentro de los límites que definas. Revisa esto antes de autorizar cualquier agente.',
        body: [
          'Agent Wallet te permite autorizar una dirección de wallet externa para actuar como agente.',
          'El agente solo puede ejecutar transacciones dentro de los límites que configures.',
          'La marca/proyecto BlockVenture Chain Capital no opera, controla, supervisa ni garantiza el comportamiento de ningún agente que autorices.',
          'Eres responsable de revisar la dirección del agente, el máximo por transacción, el límite diario, el presupuesto total, el presupuesto por periodo, los tokens permitidos, los protocolos permitidos, los destinatarios permitidos y la expiración antes de aprobar.',
          'Una configuración incorrecta o demasiado permisiva puede provocar la pérdida de fondos.',
          'Puedes pausar o revocar los permisos del agente cuando la wallet lo permita.',
        ],
      },
      swap: {
        title: 'Aviso de Swap Fast',
        intro:
          'Swap Fast es una interfaz de conveniencia que te permite intercambiar tokens directamente desde tu wallet. BVCC no opera un exchange ni ejecuta, valora, enruta o liquida tus swaps — lo hace el protocolo Uniswap v3.',
        body: [
          'Los swaps los ejecuta íntegramente el protocolo Uniswap v3 — contratos inteligentes independientes, de terceros y descentralizados, desplegados en cada blockchain. BVCC Wallet solo construye la transacción y la envía en tu nombre.',
          'La marca/proyecto BlockVenture Chain Capital no es Uniswap, no está afiliada, respaldada ni asociada con Uniswap, y no controla el protocolo Uniswap, sus contratos, liquidez, pools, precios ni enrutamiento.',
          'BVCC no es un bróker, dealer, exchange, creador de mercado ni proveedor de liquidez. No casa órdenes, no mantiene libros de órdenes ni custodia fondos en ningún momento del swap.',
          'Los precios, las cotizaciones, el fee tier del pool seleccionado y el "mínimo a recibir" son estimaciones obtenidas on-chain del protocolo Uniswap en el momento de la cotización. El precio final lo determina el protocolo y la liquidez on-chain en el momento de la ejecución, y puede diferir.',
          'Tú defines tu tolerancia de slippage. Un swap puede fallar, ejecutarse parcialmente según gobierne el protocolo, o devolver menos de lo esperado por slippage, movimiento de precio, baja liquidez o MEV. BVCC no garantiza ningún precio, tasa ni resultado.',
          'La comisión de interfaz de BVCC (ver Divulgación de comisiones) es independiente y adicional a la comisión del protocolo Uniswap/proveedores de liquidez y al gas de la blockchain. BVCC no recibe las comisiones de Uniswap ni de los LP.',
          'Los contratos de los tokens que intercambies pueden ser maliciosos, ilíquidos o sin valor. Eres el único responsable de verificar cualquier token antes de intercambiarlo. Las transacciones en blockchain son irreversibles.',
          'La disponibilidad de Swap Fast depende de que el protocolo Uniswap esté desplegado en la red seleccionada y se ofrece "tal cual", sin garantías. Úsalo bajo tu propia responsabilidad.',
        ],
      },
      fees: {
        title: 'Divulgación de comisiones',
        intro:
          'BVCC Wallet aplica una pequeña comisión de protocolo en ciertas transacciones que mueven valor, cobrada automáticamente on-chain.',
        body: [
          'Comisión de Standard Wallet: 0,05 % por transacción aplicable.',
          'Comisión de Agent Wallet: 0,15 % por transacción aplicable.',
          'Las comisiones se cobran automáticamente on-chain cuando aplican, en la misma transacción.',
          'Las comisiones pueden aplicarse de forma distinta según el tipo de transacción: transferencia de ETH nativo, transferencia ERC-20, o incremento de saldo por DeFi/swap.',
          'Las comisiones de gas de la blockchain y cualquier comisión de protocolos de terceros son independientes y adicionales a las comisiones de BVCC Wallet.',
        ],
        feeWalletLabel: 'Dirección del wallet de comisiones',
        address: '0x3e3eb089169a7315a994947465ce5f5FC3A307D4',
      },
      privacy: {
        title: 'Política de privacidad',
        intro:
          'BVCC Wallet está diseñada para minimizar la recopilación de datos. No tiene cuentas tradicionales ni base de datos de usuarios.',
        body: [
          'BVCC Wallet no requiere cuentas de usuario tradicionales.',
          'BVCC Wallet no requiere KYC ni verificación de identidad personal.',
          'BVCC Wallet no recopila intencionadamente tus claves privadas ni frases semilla.',
          'Algunas preferencias (como el idioma, la red seleccionada o la aceptación de avisos) pueden guardarse localmente en tu navegador mediante localStorage.',
          'La actividad en blockchain es pública por naturaleza; las direcciones y transacciones son visibles on-chain para cualquiera.',
          'Servicios de terceros — incluidos WalletConnect, proveedores RPC, dApps, proveedores de analítica y proveedores de on-ramp — pueden procesar datos según sus propias políticas de privacidad, que BVCC no controla.',
          'Nunca introduzcas frases semilla ni claves privadas en BVCC Wallet ni en ningún sitio web. BVCC Wallet nunca te las pedirá.',
        ],
      },
    },
  },
}
