// Press / media kit page (/press).
// Structured content is read as dict[lang].press.<section> by components/PressPage.tsx,
// the same way LegalPage reads dict[lang].legal. Short UI labels go through t('press.…').
//
// Every number in here is mirrored in bvcc-press-kit/FACTS.md with its provenance.
// If you change one, change it in both places.

export const press = {
  en: {
    press: {
      metaTitle: 'Press Kit — BVCC Agent Wallet',
      metaDesc:
        'Press kit for BVCC Agent Wallet: one-page media kit, logos, screenshots, verified numbers, brand colors and boilerplate copy for journalists and creators.',

      back: '← Back to home',
      kicker: 'Press kit',
      title: 'Everything you need to write about this',
      lede:
        'Ready-to-paste copy, brand assets and numbers you can check yourself. Nothing here is a claim we cannot back with a file, an address, or a command you can run.',
      updated: 'Last updated 4 August 2026',

      dlMediaKit: 'Media kit (PDF)',
      dlMediaKitEs: 'Kit de prensa (PDF, ES)',
      dlAssets: 'Logos and screenshots',
      dlReport: 'Security report',
      watchDemo: 'Watch the 2-minute demo',

      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',

      // ── One-paragraph summary of what this is ─────────────
      whatHeading: 'What it is',
      whatBody: [
        'BVCC Agent Wallet is an open-source, non-custodial smart wallet built on ERC-4337 and passkeys. It lets you hand an AI agent its own wallet with limits written into the contract: a budget, which tokens it may touch, which protocols it may call, and where it may send funds.',
        'Any MCP client connects in one command and receives 53 tools for transfers, Uniswap swaps, Aave lending and liquidity positions. It runs on five mainnets plus a testnet, and the same wallet address exists on all of them.',
      ],

      // ── The pitch, in three beats ─────────────────────────
      problemHeading: 'The problem',
      problemBody: [
        'To let an AI agent transact today, you give it a private key. A private key has no ceiling. If the agent is prompt-injected, hallucinates a destination, or the key leaks out of a config file, everything in that wallet is gone, and nothing on-chain was in a position to stop it.',
        'The usual answer is a server in the middle that decides which transactions to sign. That works, and it moves the problem. Now you trust the server, and whoever runs it can sign whatever it likes.',
        'BVCC puts the limits in the contract instead. The agent holds its own key and can sign freely. The wallet refuses anything outside the envelope you set. A leaked agent key is worth its remaining budget, not the account.',
      ],

      diffHeading: 'What is actually different',
      diffBody: [
        'Most work on agent wallets stops at a spending cap. The harder problem is that a cap says nothing about intent. An agent authorized to swap on Uniswap with a $500 budget can route that swap so the output lands in an attacker’s address, and it never goes over $500.',
        'So the wallet inspects the call. For a swap through Uniswap’s Universal Router it pins the recipient argument to your own wallet and matches the command bytes exactly. Anything else reverts with PinnedArgMismatch(). The agent can trade. It cannot trade on someone else’s behalf. There are 34 adversarial tests and 42 validator tests behind that check.',
        'Adding a new protocol to that allowlist goes through a registry with a 48-hour timelock, so the change sits visible on-chain for two days before it can take effect.',
      ],

      // ── What an agent can do ──────────────────────────────
      capsHeading: 'What an agent can actually do',
      capsNote:
        'Not just swaps. The catalog is 53 tools, and the lending and liquidity halves are the larger part of it.',
      caps: [
        {
          h: 'Lending — Aave v3',
          b: 'Supply, borrow, repay, withdraw. Plus four planners that unwind a live position: deleverage, close, swap the collateral, swap the debt — each respecting a health-factor floor and aborting on oracle deviation.',
          n: '19 tools',
        },
        {
          h: 'Liquidity — Uniswap v3 and v4',
          b: 'Open a position at a chosen range, collect fees, reduce, close. v4 native ETH pools included, with hooks gated by a registry on a 48-hour timelock.',
          n: '14 tools',
        },
        {
          h: 'Swaps and transfers',
          b: 'Uniswap v3 and v4, native ETH in and out, ERC-20 and native sends, approvals.',
          n: '18 tools',
        },
        {
          h: 'Before it acts',
          b: 'Most writes have a matching dry-run that returns gas and the revert reason, so a model can check whether something will work before spending anything. Four operating guides it can read first.',
          n: '15 simulate tools',
        },
      ],
      capsProof:
        'A full Aave cycle and a full Uniswap v4 liquidity cycle have both been run end to end on Arbitrum mainnet by an agent, under its limits. Every call still had to pass the contract.',

      // ── Numbers ───────────────────────────────────────────
      statsHeading: 'By the numbers',
      statsNote: 'Each of these is checkable without asking us. The how is in the fact sheet.',
      stats: [
        { n: '312', l: 'Foundry tests on the contracts', s: 'unit, fork and fuzz' },
        { n: '53', l: 'tools exposed over MCP', s: '12 read · 15 simulate · 26 write' },
        { n: '27', l: 'tools in read-only mode', s: 'every write removed' },
        { n: '6', l: 'networks, one address', s: 'deterministic via CREATE2' },
        { n: '189', l: 'test cases in the SDK', s: 'vitest' },
        { n: '35', l: 'bytes of EIP-170 headroom', s: '24,541 of 24,576' },
        { n: '48h', l: 'timelock on recovery', s: 'and on adding protocols' },
        { n: '0', l: 'databases, emails, KYC forms', s: 'the passkey derives the address' },
      ],

      // ── Boilerplate ───────────────────────────────────────
      boilerHeading: 'Boilerplate',
      boilerNote:
        'Written to be pasted straight into an article. Pick the length that fits and copy it.',
      boilerplates: [
        {
          label: 'One line',
          meta: '14 words',
          text: 'A non-custodial wallet that gives an AI agent spending limits the contract itself enforces.',
        },
        {
          label: 'Short',
          meta: '46 words',
          text: 'BVCC Agent Wallet is an open-source, non-custodial smart wallet built on ERC-4337 and passkeys. It lets you hand an AI agent its own wallet with limits written into the contract: a budget, which tokens it may touch, which protocols it may call, and where it may send funds.',
        },
        {
          label: 'Medium',
          meta: '98 words',
          text: 'BVCC Agent Wallet is an open-source, non-custodial smart wallet that lets you delegate transactions to an AI agent without handing it a private key that can drain you. You sign in with a passkey. The agent gets its own keypair and a permission envelope enforced by the smart contract: period budget, allowed tokens, allowed protocols, recipient whitelist, expiry, and a pause switch. Any MCP client (Claude, Cursor, LM Studio, Hermes) connects in one command and receives 53 tools for transfers, Uniswap swaps, Aave lending and liquidity positions. It runs on five mainnets. It is in public beta.',
        },
        {
          label: 'Attribution',
          meta: 'required',
          text: 'BlockVenture Chain Capital is a Web3 brand and project. It is not an incorporated company, a bank, a broker, an exchange, a custodian, or a regulated financial institution. It does not hold, control, or recover user funds.',
        },
      ],

      quoteHeading: 'Founder quote',
      quote:
        'Every agent framework I looked at solves this off-chain. You run a server, the server decides what to sign, and now the server is the thing that can rob you. I didn’t want to be that server. So the budget and the destination checks live in the contract, where I can’t override them either. If the agent tries to send funds somewhere I never approved, the transaction just reverts. I like that I’m not in the loop.',
      quoteAttr: 'Founder, BlockVenture Chain Capital',

      // ── Try it ────────────────────────────────────────────
      tryHeading: 'Try it in a terminal',
      tryNote:
        'Read-only mode drops every write tool. It can read balances, quote swaps and simulate transactions, and it cannot move anything. Reasonable way to look around before pointing it at real funds.',
      tryCmd: 'BVCC_MCP_READONLY=true npx -y @bvcc/agent-mcp',
      tryOut1: '27 tools registered · all writes removed',
      tryOut2: 'read balances · quote swaps · simulate — cannot move funds',
      tryAfter:
        'Drop the flag and the same server exposes all 53 tools. Every one of them still has to pass the contract.',

      // ── Security ──────────────────────────────────────────
      secHeading: 'Security, in full',
      secIntro:
        'The review is internal, carried out by the developer on his own code. No independent party has audited it, and we would rather you write that than not. The whole findings register is published, including what is still open.',
      secRows: [
        ['Critical', '2', 'both fixed'],
        ['High', '3', '2 fixed · 1 open'],
        ['Medium', '5', '3 fixed · 1 open · 1 accepted'],
        ['Low', '1', 'fixed'],
        ['Informational', '2', '1 mitigated · 1 accepted'],
      ],
      secOpenHeading: 'The one that is still open',
      secOpenBody:
        'BVCC-03. Where the owner has already granted a token allowance to a protocol, anchoring a call’s destination does not bound its value, so a compromised agent key can be worth more than its budget. The mitigation is to hold zero standing allowances before authorizing an agent that can reach that protocol.',
      secUpgradeBody:
        'Also worth stating: a deployed wallet cannot be upgraded in place. Wallets still on V1, V2 or V3 run the older bytecode until their owners migrate.',
      secLinkEn: 'Full report (English, 44 pages)',
      secLinkEs: 'Informe completo (español, 46 páginas)',

      // ── Proof ─────────────────────────────────────────────
      proofHeading: 'Proof it works on mainnet',
      proofNote: 'All on Arbitrum One, all checkable on the explorer.',
      proofRows: [
        ['Swap', 'Agent swap through the Universal Router. Fee came out at 0.15% to the wei.'],
        ['Lending', 'A full Aave v3 cycle by the agent: supply, borrow, repay, withdraw. Position closed.'],
        ['Liquidity', 'Uniswap v4 ETH/USDC native pool: mint, collect, decrease, burn.'],
        ['Blocked', 'A swap redirected to another address reverted with PinnedArgMismatch().'],
      ],

      // ── Brand ─────────────────────────────────────────────
      brandHeading: 'Brand',
      brandLogoHeading: 'Logo',
      brandLogoNote:
        'Use the mark on dark backgrounds. Keep clear space of at least half the mark’s height on every side, do not recolor it, do not add effects, and do not place it on a busy photo. If you need it on light, ask and we will send a version rather than have you invert this one.',
      brandColorHeading: 'Colors',
      brandTypeHeading: 'Type',
      brandTypeBody:
        'Inter for everything readable, IBM Plex Mono for addresses, code, labels and numbers. Both are open source and on Google Fonts. Monospace is not decoration here: it marks anything a reader might need to copy or verify.',
      brandNameHeading: 'Naming',
      brandNameBody:
        'The product is BVCC Agent Wallet. Not "BVCC wallet", not "the BVCC". On second reference, "the wallet" is fine. The publisher is BlockVenture Chain Capital, shortened to BVCC after first use.',

      // ── Don't write ───────────────────────────────────────
      avoidHeading: 'Please avoid these words',
      avoidNote: 'Each one would be factually wrong, which is the only reason the list exists.',
      avoidRows: [
        ['"secure", "safe", "protected funds"', 'It is unaudited beta software.'],
        ['"audited"', 'The review is internal. "Internally reviewed" or "self-audited" is accurate.'],
        ['"company", "startup", "firm"', 'BVCC is a brand and project, not incorporated.'],
        ['"institutional-grade", "production-ready"', 'Public beta.'],
        ['"0.15% on everything"', 'The native side of a Uniswap v4 swap pays nothing.'],
        ['"your keys never leave the device"', 'Say passkeys/WebAuthn, and that BVCC never receives keys.'],
        ['"the AI can’t steal your money"', 'It can spend up to its budget. That is what the budget is for.'],
      ],

      // ── Facts ─────────────────────────────────────────────
      factsHeading: 'Fact sheet',
      factsRows: [
        ['Product', 'BVCC Agent Wallet'],
        ['Publisher', 'BlockVenture Chain Capital — a Web3 brand and project, not incorporated'],
        ['Status', 'Public beta · experimental · not externally audited'],
        ['License', 'GPL-3.0-or-later for the app and contracts · MIT for both npm packages'],
        ['Standards', 'ERC-4337 · ERC-7821 · ERC-7739 · WebAuthn P256 · Model Context Protocol'],
        ['Networks', 'Ethereum · Arbitrum One · Base · BNB Chain · Polygon · Arbitrum Sepolia (testnet)'],
        ['Smart wallet factory', '0xfd105197109244483b5f870501326E6faec9F93c'],
        ['Agent wallet factory', '0xf3A61F9d64d45362E149A111289546523BCd26a6'],
        ['Fees', '0.05% on personal transactions · 0.15% on agent transactions, charged on-chain'],
        ['Recovery', '2-of-3 guardians · 48-hour timelock · cancellable by the owner'],
        ['Languages', 'English and Spanish, full parity'],
      ],
      factsAddrNote:
        'The factory addresses are identical on all six networks. That is CREATE2 with a fixed salt, not a coincidence.',

      linksHeading: 'Links',
      links: [
        ['Site', 'https://bvccwallet.blockventurechaincapital.com'],
        ['Docs', 'https://bvccwallet.blockventurechaincapital.com/docs'],
        ['Connect an AI over MCP', 'https://bvccwallet.blockventurechaincapital.com/docs/connect-ai'],
        ['How agent permissions work', 'https://bvccwallet.blockventurechaincapital.com/docs/agent-permissions'],
        ['Wallet and contracts', 'https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent'],
        ['MCP server', 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-mcp'],
        ['SDK', 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-sdk'],
        ['npm — @bvcc/agent-mcp', 'https://www.npmjs.com/package/@bvcc/agent-mcp'],
        ['Demo video', 'https://www.youtube.com/watch?v=dWUTaWBk68A'],
        ['Machine-readable summary', 'https://bvccwallet.blockventurechaincapital.com/llms.txt'],
      ],

      contactHeading: 'Contact',
      contactBody:
        'One person answers this address, so expect a real reply rather than a form response. Happy to do interviews, walk through the contracts on a call, or set up a wallet with you so you can watch an agent hit a limit and bounce off it.',
      contactEmail: 'contact@blockventurechaincapital.com',
      contactLinkedIn: 'LinkedIn',
      contactGitHub: 'GitHub',
    },
  },

  es: {
    press: {
      metaTitle: 'Kit de prensa — BVCC Agent Wallet',
      metaDesc:
        'Kit de prensa de BVCC Agent Wallet: dosier de una página, logos, capturas, cifras verificables, colores de marca y textos listos para copiar.',

      back: '← Volver al inicio',
      kicker: 'Kit de prensa',
      title: 'Todo lo que necesitas para escribir sobre esto',
      lede:
        'Textos listos para pegar, material de marca y cifras que puedes comprobar por tu cuenta. Aquí no hay nada que no podamos respaldar con un archivo, una dirección o un comando que puedas ejecutar.',
      updated: 'Actualizado el 4 de agosto de 2026',

      dlMediaKit: 'Dosier (PDF, ES)',
      dlMediaKitEs: 'Media kit (PDF, EN)',
      dlAssets: 'Logos y capturas',
      dlReport: 'Informe de seguridad',
      watchDemo: 'Ver la demo de 2 minutos',

      copy: 'Copiar',
      copied: 'Copiado',
      download: 'Descargar',

      whatHeading: 'Qué es',
      whatBody: [
        'BVCC Agent Wallet es una smart wallet no custodial y de código abierto, construida sobre ERC-4337 y passkeys. Permite darle a un agente de IA su propia wallet con límites escritos en el contrato: un presupuesto, qué tokens puede tocar, a qué protocolos puede llamar y a dónde puede enviar fondos.',
        'Cualquier cliente MCP se conecta con un comando y recibe 53 herramientas para transferencias, swaps en Uniswap, préstamos en Aave y posiciones de liquidez. Funciona en cinco mainnets más una testnet, y la misma dirección de wallet existe en todas ellas.',
      ],

      problemHeading: 'El problema',
      problemBody: [
        'Hoy, para que un agente de IA pueda transaccionar, le das una clave privada. Una clave privada no tiene techo. Si al agente le cuelan un prompt injection, si alucina un destino o si la clave se escapa de un fichero de configuración, todo lo que hubiera en esa wallet se ha ido, y no había nada on-chain en posición de impedirlo.',
        'La respuesta habitual es meter un servidor en medio que decida qué transacciones firmar. Funciona, y desplaza el problema. Ahora confías en el servidor, y quien lo opere puede firmar lo que le apetezca.',
        'BVCC mete los límites en el contrato. El agente tiene su propia clave y puede firmar lo que quiera. La wallet rechaza cualquier cosa fuera del margen que hayas fijado. Una clave de agente filtrada vale lo que le quede de presupuesto, no la cuenta entera.',
      ],

      diffHeading: 'Qué es realmente distinto',
      diffBody: [
        'Casi todo el trabajo sobre wallets para agentes se queda en el tope de gasto. El problema difícil es que un tope no dice nada sobre la intención. Un agente autorizado a hacer swaps en Uniswap con 500 $ de presupuesto puede enrutar ese swap para que la salida acabe en la dirección de un atacante, y en ningún momento se pasa de 500 $.',
        'Así que la wallet inspecciona la llamada. En un swap por el Universal Router de Uniswap, fija el argumento del destinatario a tu propia wallet y exige que los bytes de comando coincidan exactamente. Cualquier otra cosa revierte con PinnedArgMismatch(). El agente puede operar. No puede operar en beneficio de otro. Detrás de esa comprobación hay 34 tests adversariales y 42 tests del validador.',
        'Añadir un protocolo nuevo a esa lista pasa por un registro con timelock de 48 horas, así que el cambio queda visible on-chain durante dos días antes de poder aplicarse.',
      ],

      capsHeading: 'Qué puede hacer de verdad un agente',
      capsNote:
        'No solo swaps. El catálogo son 53 herramientas, y la parte de préstamos y liquidez es la mayor.',
      caps: [
        {
          h: 'Préstamos — Aave v3',
          b: 'Depositar, pedir prestado, devolver, retirar. Más cuatro planificadores que deshacen una posición viva: desapalancar, cerrar, cambiar el colateral, cambiar la deuda — cada uno respetando un suelo de health factor y abortando si el oráculo se desvía.',
          n: '19 herramientas',
        },
        {
          h: 'Liquidez — Uniswap v3 y v4',
          b: 'Abrir una posición en el rango que elijas, cobrar comisiones, reducir, cerrar. Incluye pools de ETH nativo en v4, con los hooks controlados por un registro con timelock de 48 horas.',
          n: '14 herramientas',
        },
        {
          h: 'Swaps y transferencias',
          b: 'Uniswap v3 y v4, ETH nativo a la entrada y a la salida, envíos de ERC-20 y nativos, aprobaciones.',
          n: '18 herramientas',
        },
        {
          h: 'Antes de actuar',
          b: 'Casi toda escritura tiene su dry-run, que devuelve el gas y el motivo del revert, así que un modelo puede comprobar si algo va a funcionar antes de gastar nada. Y cuatro guías que puede leer primero.',
          n: '15 de simulación',
        },
      ],
      capsProof:
        'Un ciclo completo de Aave y otro completo de liquidez en Uniswap v4 se han ejecutado de principio a fin en Arbitrum mainnet por un agente, dentro de sus límites. Cada llamada tuvo que pasar por el contrato igualmente.',

      statsHeading: 'En cifras',
      statsNote: 'Todas se pueden comprobar sin preguntarnos. El cómo está en la ficha de datos.',
      stats: [
        { n: '312', l: 'tests de Foundry en los contratos', s: 'unit, fork y fuzz' },
        { n: '53', l: 'herramientas expuestas por MCP', s: '12 lectura · 15 simulación · 26 escritura' },
        { n: '27', l: 'herramientas en modo lectura', s: 'sin ninguna de escritura' },
        { n: '6', l: 'redes, una sola dirección', s: 'determinista con CREATE2' },
        { n: '189', l: 'casos de test en el SDK', s: 'vitest' },
        { n: '35', l: 'bytes de margen frente al EIP-170', s: '24.541 de 24.576' },
        { n: '48h', l: 'de timelock en la recuperación', s: 'y al añadir protocolos' },
        { n: '0', l: 'bases de datos, emails o KYC', s: 'la passkey deriva la dirección' },
      ],

      boilerHeading: 'Textos listos',
      boilerNote: 'Escritos para pegarse directamente en un artículo. Elige el largo que encaje y cópialo.',
      boilerplates: [
        {
          label: 'Una línea',
          meta: '',
          text: 'Una wallet no custodial que le pone a un agente de IA límites de gasto que hace cumplir el propio contrato.',
        },
        {
          label: 'Corto',
          meta: '48 palabras',
          text: 'BVCC Agent Wallet es una smart wallet no custodial y de código abierto, construida sobre ERC-4337 y passkeys. Permite darle a un agente de IA su propia wallet con límites escritos en el contrato: un presupuesto, qué tokens puede tocar, a qué protocolos puede llamar y a dónde puede enviar fondos.',
        },
        {
          label: 'Medio',
          meta: '101 palabras',
          text: 'BVCC Agent Wallet es una smart wallet no custodial y de código abierto que permite delegar transacciones en un agente de IA sin entregarle una clave privada capaz de vaciarte. Tú entras con una passkey. El agente recibe su propio par de claves y un margen de permisos que hace cumplir el contrato: presupuesto por periodo, tokens permitidos, protocolos permitidos, lista de destinatarios, caducidad y un botón de pausa. Cualquier cliente MCP (Claude, Cursor, LM Studio, Hermes) se conecta con un comando y recibe 53 herramientas para transferencias, swaps en Uniswap, préstamos en Aave y posiciones de liquidez. Funciona en cinco mainnets. Está en beta pública.',
        },
        {
          label: 'Atribución',
          meta: 'obligatoria',
          text: 'BlockVenture Chain Capital es una marca y proyecto Web3. No es una empresa constituida, ni un banco, ni un bróker, ni un exchange, ni un custodio, ni una entidad financiera regulada. No guarda, controla ni recupera fondos de usuarios.',
        },
      ],

      quoteHeading: 'Cita del fundador',
      quote:
        'Todos los frameworks de agentes que miré resuelven esto fuera de la cadena. Levantas un servidor, el servidor decide qué se firma, y ahora el servidor es lo que te puede robar. No quería ser ese servidor. Así que el presupuesto y las comprobaciones de destino viven en el contrato, donde tampoco yo puedo saltármelos. Si el agente intenta mandar fondos a un sitio que no aprobé, la transacción revierte y ya está. Me gusta no estar en medio.',
      quoteAttr: 'Fundador, BlockVenture Chain Capital',

      tryHeading: 'Pruébalo en una terminal',
      tryNote:
        'El modo de solo lectura quita todas las herramientas de escritura. Puede leer saldos, cotizar swaps y simular transacciones, y no puede mover nada. Es una forma razonable de echar un vistazo antes de apuntarlo a fondos reales.',
      tryCmd: 'BVCC_MCP_READONLY=true npx -y @bvcc/agent-mcp',
      tryOut1: '27 herramientas registradas · sin ninguna de escritura',
      tryOut2: 'lee saldos · cotiza swaps · simula — no puede mover fondos',
      tryAfter:
        'Quita la variable y el mismo servidor expone las 53 herramientas. Todas ellas siguen teniendo que pasar por el contrato.',

      secHeading: 'Seguridad, entera',
      secIntro:
        'La revisión es interna, hecha por el propio desarrollador sobre su código. Ningún tercero independiente la ha auditado, y preferimos que lo escribas a que no. El registro completo de hallazgos está publicado, incluido lo que sigue abierto.',
      secRows: [
        ['Críticos', '2', 'ambos corregidos'],
        ['Altos', '3', '2 corregidos · 1 abierto'],
        ['Medios', '5', '3 corregidos · 1 abierto · 1 aceptado'],
        ['Bajo', '1', 'corregido'],
        ['Informativos', '2', '1 mitigado · 1 aceptado'],
      ],
      secOpenHeading: 'El que sigue abierto',
      secOpenBody:
        'BVCC-03. Cuando el dueño ya ha concedido un allowance de token a un protocolo, fijar el destino de una llamada no acota su valor, así que una clave de agente comprometida puede valer más que su presupuesto. La mitigación es tener cero allowances previos antes de autorizar a un agente que pueda alcanzar ese protocolo.',
      secUpgradeBody:
        'Conviene decirlo también: una wallet desplegada no se puede actualizar en el sitio. Las wallets que sigan en V1, V2 o V3 ejecutan el bytecode antiguo hasta que sus dueños migren.',
      secLinkEn: 'Informe completo (inglés, 44 páginas)',
      secLinkEs: 'Informe completo (español, 46 páginas)',

      proofHeading: 'Prueba de que funciona en mainnet',
      proofNote: 'Todo en Arbitrum One y todo comprobable en el explorer.',
      proofRows: [
        ['Swap', 'Swap del agente por el Universal Router. La comisión salió al 0,15 % exacto, al wei.'],
        ['Préstamo', 'Ciclo completo en Aave v3 hecho por el agente: supply, borrow, repay, withdraw. Posición cerrada.'],
        ['Liquidez', 'Pool nativo ETH/USDC de Uniswap v4: mint, collect, decrease, burn.'],
        ['Bloqueado', 'Un swap redirigido a otra dirección revirtió con PinnedArgMismatch().'],
      ],

      brandHeading: 'Marca',
      brandLogoHeading: 'Logo',
      brandLogoNote:
        'Úsalo sobre fondos oscuros. Deja un espacio libre de al menos la mitad de su altura por cada lado, no lo recolorees, no le añadas efectos y no lo pongas sobre una foto cargada. Si lo necesitas sobre fondo claro, pídelo y te mandamos una versión en lugar de que inviertas esta.',
      brandColorHeading: 'Colores',
      brandTypeHeading: 'Tipografía',
      brandTypeBody:
        'Inter para todo lo que se lee, IBM Plex Mono para direcciones, código, etiquetas y cifras. Las dos son de código abierto y están en Google Fonts. Aquí la monoespaciada no es decoración: marca todo lo que alguien podría querer copiar o verificar.',
      brandNameHeading: 'Nombre',
      brandNameBody:
        'El producto es BVCC Agent Wallet. Ni «BVCC wallet», ni «el BVCC». En segunda mención vale «la wallet». Quien lo publica es BlockVenture Chain Capital, abreviado a BVCC después de la primera vez.',

      avoidHeading: 'Palabras que conviene evitar',
      avoidNote: 'Cada una sería falsa, y esa es la única razón por la que existe esta lista.',
      avoidRows: [
        ['«seguro», «fondos protegidos»', 'Es software en beta sin auditar.'],
        ['«auditado»', 'La revisión es interna. «Revisado internamente» o «autoauditado» sí es exacto.'],
        ['«empresa», «startup», «compañía»', 'BVCC es una marca y proyecto, no está constituida.'],
        ['«grado institucional», «listo para producción»', 'Beta pública.'],
        ['«0,15 % en todo»', 'El lado nativo de un swap en Uniswap v4 no paga comisión.'],
        ['«tus claves nunca salen del dispositivo»', 'Di passkeys/WebAuthn, y que BVCC nunca recibe claves.'],
        ['«la IA no puede robarte»', 'Puede gastar hasta su presupuesto. Para eso está el presupuesto.'],
      ],

      factsHeading: 'Ficha de datos',
      factsRows: [
        ['Producto', 'BVCC Agent Wallet'],
        ['Publica', 'BlockVenture Chain Capital — marca y proyecto Web3, no constituida'],
        ['Estado', 'Beta pública · experimental · sin auditoría externa'],
        ['Licencia', 'GPL-3.0-or-later para app y contratos · MIT para los dos paquetes npm'],
        ['Estándares', 'ERC-4337 · ERC-7821 · ERC-7739 · WebAuthn P256 · Model Context Protocol'],
        ['Redes', 'Ethereum · Arbitrum One · Base · BNB Chain · Polygon · Arbitrum Sepolia (testnet)'],
        ['Factory smart wallet', '0xfd105197109244483b5f870501326E6faec9F93c'],
        ['Factory agent wallet', '0xf3A61F9d64d45362E149A111289546523BCd26a6'],
        ['Comisiones', '0,05 % en transacciones personales · 0,15 % en las del agente, cobradas on-chain'],
        ['Recuperación', '2 de 3 guardianes · timelock de 48 h · cancelable por el dueño'],
        ['Idiomas', 'Inglés y español, con paridad completa'],
      ],
      factsAddrNote:
        'Las direcciones de las factories son idénticas en las seis redes. Eso es CREATE2 con un salt fijo, no una casualidad.',

      linksHeading: 'Enlaces',
      links: [
        ['Web', 'https://bvccwallet.blockventurechaincapital.com'],
        ['Documentación', 'https://bvccwallet.blockventurechaincapital.com/docs'],
        ['Conectar una IA por MCP', 'https://bvccwallet.blockventurechaincapital.com/docs/connect-ai'],
        ['Cómo funcionan los permisos', 'https://bvccwallet.blockventurechaincapital.com/docs/agent-permissions'],
        ['Wallet y contratos', 'https://github.com/blockventurechaincapital-crypto/bvcc-wallet-agent'],
        ['Servidor MCP', 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-mcp'],
        ['SDK', 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-sdk'],
        ['npm — @bvcc/agent-mcp', 'https://www.npmjs.com/package/@bvcc/agent-mcp'],
        ['Vídeo demo', 'https://www.youtube.com/watch?v=dWUTaWBk68A'],
        ['Resumen legible por máquinas', 'https://bvccwallet.blockventurechaincapital.com/llms.txt'],
      ],

      contactHeading: 'Contacto',
      contactBody:
        'Esta dirección la contesta una persona, así que espera una respuesta de verdad y no un formulario. Encantado de hacer entrevistas, repasar los contratos en una llamada o montar una wallet contigo para que veas a un agente chocar contra un límite.',
      contactEmail: 'contact@blockventurechaincapital.com',
      contactLinkedIn: 'LinkedIn',
      contactGitHub: 'GitHub',
    },
  },
}
