// Connect an AI assistant over MCP. Mirrors bvcc-agent-mcp/QUICKSTART.md
// (https://github.com/blockventurechaincapital-crypto/bvcc-agent-mcp) + adds Hermes.
import type { LocalizedDoc } from '@/components/DocsPage'

// Code blocks are shared between languages (code is not translated)
const CODE_NEW_EOA = `cast wallet new        # foundry; or any wallet / viem generatePrivateKey()`

const CODE_ENV = `AGENT_PRIVATE_KEY=0xYOUR_AGENT_KEY
WALLET_ADDRESS=0xYOUR_WALLET
CHAIN_ID=42161
# optional RPC failover (comma-separated):
# RPC_URL_42161=https://arb1.arbitrum.io/rpc,https://arbitrum-one-rpc.publicnode.com`

const CODE_CLAUDE_CODE = `claude mcp add bvcc-agent-wallet \\
  --env BVCC_ENV_FILE=/secure/agent.env \\
  -- npx -y @bvcc/agent-mcp`

const CODE_MCP_JSON = `{
  "mcpServers": {
    "bvcc-agent-wallet": {
      "command": "npx",
      "args": ["-y", "@bvcc/agent-mcp"],
      "env": { "BVCC_ENV_FILE": "/secure/agent.env" }
    }
  }
}`

const CODE_HERMES_JSON = `{
  "command": "npx",
  "args": ["-y", "@bvcc/agent-mcp"],
  "env": { "BVCC_ENV_FILE": "C:\\\\Users\\\\you\\\\agent.env" }
}`

export const connectAi: LocalizedDoc = {
  en: {
    title: 'Connect an AI Assistant (MCP)',
    intro:
      'Connect Hermes, Claude, Cursor or LM Studio to a BVCC Agent Wallet over MCP. One command exposes 53 tools — transfers, swaps, Aave v3 lending and Uniswap v3/v4 liquidity — that the assistant calls on your behalf; every spend limit, allowed token and recipient is enforced on-chain, not by the MCP. The MCP adds no powers: the agent can only do what you authorized in the dashboard.',
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        text: 'You do **not** install `@bvcc/agent-sdk` separately — the MCP (`@bvcc/agent-mcp`) bundles it. The SDK is only for building your own bot in code. See the [SDK on npm](https://www.npmjs.com/package/@bvcc/agent-sdk).',
      },

      { type: 'h2', text: 'How it works' },
      {
        type: 'list',
        items: [
          'Your assistant speaks **MCP** natively (Hermes, Claude Code, the Claude app, Cursor, LM Studio).',
          '`npx -y @bvcc/agent-mcp` registers the tools — no plugin to install, no adapter to write.',
          'The agent is a normal EOA with its **own keypair** that signs `executeAsAgent` and pays its own gas.',
          'The **contract** is the source of truth: a blocked action reverts and the tool returns a `humanMessage` + `suggestedAction`.',
        ],
      },

      { type: 'h2', text: 'What the tools cover' },
      {
        type: 'table',
        headers: ['Group', 'Tools', 'What it does'],
        rows: [
          ['`core`', '18', 'Agent status and remaining limits, balances, native and token transfers, approvals, Uniswap v3/v4 swaps.'],
          ['`aave`', '19', 'Aave v3: supply, borrow, repay, collateral and e-mode — plus close, deleverage, collateral swap and debt swap.'],
          ['`lp`', '14', 'Uniswap v3 & v4 liquidity: open a position, collect fees, reduce and burn.'],
          ['`meta`', '2', '`listGuides` / `getGuide` — operating playbooks per area. Always exposed.'],
        ],
      },
      {
        type: 'p',
        text: 'Each tool is tagged by class: 🟢 read (12), 🟡 simulate (15), 🔴 write (26). Most writes have a matching `dryRun*` / `*Plan*` tool that reports what would happen without sending anything — ask for that first. Writes carry the MCP `destructiveHint` annotation, so clients that support it can ask you to confirm.',
      },

      { type: 'h2', text: 'Before you connect (on-chain, once)' },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Two steps are easy to miss and the agent does **nothing** without them: authorizing the agent on-chain (step 3) and funding its EOA with gas (step 4).',
      },
      { type: 'h3', text: '1. Create the Agent Wallet' },
      {
        type: 'p',
        text: 'Create it from the BVCC dashboard. Its `WALLET_ADDRESS` is the **same on every chain** (deterministic CREATE2).',
      },
      { type: 'h3', text: '2. Generate a dedicated agent EOA' },
      {
        type: 'p',
        text: 'The agent is its own keypair — never your wallet owner key. Keep the **private key** (for the MCP config) and the **public address** (you authorize it next).',
      },
      { type: 'code', lang: 'bash', code: CODE_NEW_EOA },
      { type: 'h3', text: '3. ⚠️ Authorize the agent on-chain — with limits' },
      {
        type: 'p',
        text: 'In the dashboard, authorize the agent **address** on **each chain** you will use, and set: `allowedTokens`, `allowedProtocols` (for swaps, the router **and** Permit2), optional `allowedRecipients`, spend caps (per-tx / daily / period / total, native + per-token) and an optional `expiry`. Without this the contract reverts with `NotAuthorizedAgent`. Keep limits **tight** — a leaked agent key is only worth what you authorized. Full detail in [Agent Integration](/docs/agent-integration).',
      },
      { type: 'h3', text: '4. ⚠️ Fund the agent EOA with gas' },
      {
        type: 'p',
        text: 'The agent pays its **own gas** to sign `executeAsAgent`. Send a small amount of the native token (ETH/BNB) to the **agent EOA address** on each chain. The funds it *operates* live in the wallet — the EOA only needs gas.',
      },

      { type: 'h2', text: 'Configuration' },
      {
        type: 'p',
        text: 'Provide these as environment variables. **Recommended:** keep them in a dedicated file and point the server at it with `BVCC_ENV_FILE`, so the key stays out of the host config (which often gets shared or synced). `chmod 600` it and keep it out of any cloud-synced folder.',
      },
      {
        type: 'table',
        headers: ['Variable', 'Required', 'What it is'],
        rows: [
          ['`AGENT_PRIVATE_KEY`', '✅', 'The agent EOA private key from step 2 (`0x` + 64 hex).'],
          ['`WALLET_ADDRESS`', '✅', 'The Agent Wallet from step 1.'],
          ['`CHAIN_ID`', '✅', 'Default chain: `1` Ethereum · `56` BNB · `42161` Arbitrum One · `8453` Base · `137` Polygon · `421614` Arbitrum Sepolia.'],
          ['`RPC_URL` / `RPC_URL_<id>`', '—', 'Your own RPC(s). Comma-separate several for failover. Else public defaults are used.'],
          ['`BVCC_MCP_READONLY`', '—', '`true` exposes only the 27 read/simulate tools (never moves funds).'],
          ['`BVCC_MCP_MODULES`', '—', 'Comma-separated groups to expose: `core`, `aave`, `lp`. Unset = all.'],
        ],
      },
      { type: 'p', text: 'Example `agent.env`:' },
      { type: 'code', lang: 'bash', code: CODE_ENV },
      {
        type: 'p',
        text: 'The server is **multi-network**: every tool takes an optional `network` (chain id or name), so you can say "swap on bsc" without restarting — provided the agent is authorized on that chain. Ethereum, BNB, Arbitrum and Base ship with a backup public RPC, so basic failover works with zero config.',
      },

      { type: 'h2', text: 'Register it in your assistant' },

      { type: 'h3', text: 'Claude Code' },
      { type: 'code', lang: 'bash', code: CODE_CLAUDE_CODE },

      { type: 'h3', text: 'Cursor · Claude app · LM Studio' },
      {
        type: 'p',
        text: 'Add the server to the client `mcp.json` (Cursor: Settings → MCP; LM Studio: Program → Edit mcp.json):',
      },
      { type: 'code', lang: 'json', code: CODE_MCP_JSON },
      {
        type: 'p',
        text: 'You can also put `AGENT_PRIVATE_KEY` / `WALLET_ADDRESS` / `CHAIN_ID` directly in the `env` block instead of `BVCC_ENV_FILE`, but a separate file is safer.',
      },

      { type: 'h3', text: 'Hermes' },
      {
        type: 'p',
        text: 'Hermes speaks MCP natively, so it needs no custom plugin. In the **MCP** tab → **New server**, set a **Name** and paste into **Server JSON** — but here Hermes expects **only the server object**, *without* the `{ "mcpServers": { … } }` wrapper:',
      },
      { type: 'code', lang: 'json', code: CODE_HERMES_JSON },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Pasting the full `{ "mcpServers": { … } }` wrapper here gives `MCP server has no \'command\' in config`. Paste only `{ command, args, env }`. Then **Save server → Reload MCP**. The first launch is slow (npx downloads the package). The tools won\'t appear under "Skills & Tools" — that tab is for built-in tools — but the model has them (the log shows `registered 53 tool(s)`).',
      },

      { type: 'h2', text: 'Narrowing the surface' },
      {
        type: 'p',
        text: 'Set `BVCC_MCP_READONLY=true` to expose only the 27 read/simulate tools (status, balances, quotes, dry-runs) and hide the 26 that move funds. Good for a first connection, dashboards, or untrusted models. To let the model actually swap or send, use the full entry **without** that variable.',
      },
      {
        type: 'p',
        text: '`BVCC_MCP_MODULES` narrows it by feature and combines with the above: `core` alone is 20 tools, `aave` 21, `lp` 16, and `core` + read-only leaves 13. If an agent will never touch lending, leaving those tools out is one less thing it can get wrong. The two guide tools are always exposed on top, so a restricted agent can still read how to use what it has.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Neither variable is a security boundary — the contract is. They only reduce what a confused model can reach for.',
      },

      { type: 'h2', text: 'Verify' },
      {
        type: 'p',
        text: 'Restart the client and ask the model to **check the agent status** (`getAgentStatus`). You want `isAuthorized: true`, `isPaused: false`, and the expected `allowedTokens` / `allowedProtocols`. Then try a read, a plan (`buildSwapPlan` with `quote: true`), and finally a write. Good first prompt:',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Check the agent status and my balances, then swap 10 USDC to WBTC with 1% slippage.',
      },

      { type: 'h2', text: 'Troubleshooting' },
      {
        type: 'table',
        headers: ['Symptom', 'Cause', 'Fix'],
        rows: [
          ['`NotAuthorizedAgent`', 'Agent not authorized on this chain', 'Authorize the agent address on that chain (step 3).'],
          ['Tx fails / "out of funds for gas"', 'Agent EOA has no native balance', 'Send gas to the agent EOA (step 4).'],
          ['`TokenNotAllowed` / `ProtocolNotAllowed`', 'Token/router not whitelisted', 'Add it to allowedTokens / allowedProtocols.'],
          ['`EnforcedPause`', 'Agents paused on the wallet', 'Unpause from the dashboard.'],
          ['Action on the wrong chain', '`network` omitted / wrong', 'Pass `network` explicitly, or set `CHAIN_ID`.'],
          ['Hermes: `no \'command\' in config`', 'Pasted the `mcpServers` wrapper', 'Paste only the server object `{ command, args, env }`.'],
          ['Stale version via `npx`', 'npx cache', 'Pin `@bvcc/agent-mcp@latest` or run `npx clear-npx-cache`.'],
        ],
      },
    ],
  },
  es: {
    title: 'Conecta un asistente IA (MCP)',
    intro:
      'Conecta Hermes, Claude, Cursor o LM Studio a una BVCC Agent Wallet vía MCP. Un solo comando expone 53 tools — transferencias, swaps, préstamos en Aave v3 y liquidez en Uniswap v3/v4 — que el asistente llama por ti; cada límite de gasto, token permitido y destinatario se impone on-chain, no en el MCP. El MCP no añade poderes: el agente solo puede hacer lo que autorizaste en el dashboard.',
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        text: '**No** instalas `@bvcc/agent-sdk` por separado — el MCP (`@bvcc/agent-mcp`) lo lleva dentro. El SDK es solo para construir tu propio bot en código. Mira el [SDK en npm](https://www.npmjs.com/package/@bvcc/agent-sdk).',
      },

      { type: 'h2', text: 'Cómo funciona' },
      {
        type: 'list',
        items: [
          'Tu asistente habla **MCP** de forma nativa (Hermes, Claude Code, la app de Claude, Cursor, LM Studio).',
          '`npx -y @bvcc/agent-mcp` registra las tools — sin plugins que instalar ni adaptadores que escribir.',
          'El agente es una EOA normal con su **propio par de claves** que firma `executeAsAgent` y paga su propio gas.',
          'El **contrato** es la fuente de verdad: una acción bloqueada revierte y la tool devuelve `humanMessage` + `suggestedAction`.',
        ],
      },

      { type: 'h2', text: 'Qué cubren las tools' },
      {
        type: 'table',
        headers: ['Grupo', 'Tools', 'Qué hace'],
        rows: [
          ['`core`', '18', 'Estado del agente y límites restantes, saldos, envíos de nativo y tokens, approvals, swaps en Uniswap v3/v4.'],
          ['`aave`', '19', 'Aave v3: depositar, pedir prestado, repagar, colateral y e-mode — más cerrar posición, desapalancar y cambiar colateral o deuda.'],
          ['`lp`', '14', 'Liquidez en Uniswap v3 y v4: abrir posición, cobrar comisiones, reducir y quemar.'],
          ['`meta`', '2', '`listGuides` / `getGuide` — guías de uso por área. Siempre expuestas.'],
        ],
      },
      {
        type: 'p',
        text: 'Cada tool va etiquetada por clase: 🟢 lectura (12), 🟡 simulación (15), 🔴 escritura (26). Casi todas las escrituras tienen su `dryRun*` / `*Plan*` que cuenta lo que pasaría sin enviar nada — pídelo primero. Las escrituras llevan la anotación MCP `destructiveHint`, así que los clientes que la soportan pueden pedirte confirmación.',
      },

      { type: 'h2', text: 'Antes de conectar (on-chain, una vez)' },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Dos pasos son fáciles de olvidar y sin ellos el agente **no hace nada**: autorizar al agente on-chain (paso 3) y darle gas a su EOA (paso 4).',
      },
      { type: 'h3', text: '1. Crea la Agent Wallet' },
      {
        type: 'p',
        text: 'Créala desde el dashboard de BVCC. Su `WALLET_ADDRESS` es la **misma en todas las redes** (CREATE2 determinista).',
      },
      { type: 'h3', text: '2. Genera una EOA dedicada para el agente' },
      {
        type: 'p',
        text: 'El agente es su propio par de claves — nunca la clave del dueño de tu wallet. Guarda la **clave privada** (para la config del MCP) y la **dirección pública** (la autorizas a continuación).',
      },
      { type: 'code', lang: 'bash', code: CODE_NEW_EOA },
      { type: 'h3', text: '3. ⚠️ Autoriza el agente on-chain — con límites' },
      {
        type: 'p',
        text: 'En el dashboard, autoriza la **dirección** del agente en **cada red** que vayas a usar, y define: `allowedTokens`, `allowedProtocols` (para swaps, el router **y** Permit2), `allowedRecipients` opcional, topes de gasto (por-tx / diario / periodo / total, nativo + por-token) y un `expiry` opcional. Sin esto el contrato revierte con `NotAuthorizedAgent`. Mantén los límites **ajustados** — una clave de agente filtrada solo vale lo que autorizaste. Detalle completo en [Integración de agentes](/docs/agent-integration).',
      },
      { type: 'h3', text: '4. ⚠️ Dale gas a la EOA del agente' },
      {
        type: 'p',
        text: 'El agente paga su **propio gas** para firmar `executeAsAgent`. Envía una pequeña cantidad del token nativo (ETH/BNB) a la **dirección de la EOA del agente** en cada red. Los fondos que *opera* viven en la wallet — la EOA solo necesita gas.',
      },

      { type: 'h2', text: 'Configuración' },
      {
        type: 'p',
        text: 'Pásalas como variables de entorno. **Recomendado:** guárdalas en un archivo dedicado y apunta el servidor a él con `BVCC_ENV_FILE`, para que la clave quede fuera de la config del host (que suele compartirse o sincronizarse). Hazle `chmod 600` y mantenlo fuera de carpetas sincronizadas a la nube.',
      },
      {
        type: 'table',
        headers: ['Variable', 'Obligatoria', 'Qué es'],
        rows: [
          ['`AGENT_PRIVATE_KEY`', '✅', 'La clave privada de la EOA del agente del paso 2 (`0x` + 64 hex).'],
          ['`WALLET_ADDRESS`', '✅', 'La Agent Wallet del paso 1.'],
          ['`CHAIN_ID`', '✅', 'Red por defecto: `1` Ethereum · `56` BNB · `42161` Arbitrum One · `8453` Base · `137` Polygon · `421614` Arbitrum Sepolia.'],
          ['`RPC_URL` / `RPC_URL_<id>`', '—', 'Tus propios RPC. Separa varios por comas para failover. Si no, se usan los públicos por defecto.'],
          ['`BVCC_MCP_READONLY`', '—', '`true` expone solo las 27 tools de lectura/simulación (nunca mueve fondos).'],
          ['`BVCC_MCP_MODULES`', '—', 'Grupos a exponer, separados por comas: `core`, `aave`, `lp`. Sin definir = todos.'],
        ],
      },
      { type: 'p', text: 'Ejemplo de `agent.env`:' },
      { type: 'code', lang: 'bash', code: CODE_ENV },
      {
        type: 'p',
        text: 'El servidor es **multi-red**: cada tool acepta un `network` opcional (id o nombre), así que puedes decir "haz swap en bsc" sin reiniciar — siempre que el agente esté autorizado en esa red. Ethereum, BNB, Arbitrum y Base traen un RPC público de respaldo, así que el failover básico funciona sin configurar nada.',
      },

      { type: 'h2', text: 'Regístralo en tu asistente' },

      { type: 'h3', text: 'Claude Code' },
      { type: 'code', lang: 'bash', code: CODE_CLAUDE_CODE },

      { type: 'h3', text: 'Cursor · app de Claude · LM Studio' },
      {
        type: 'p',
        text: 'Añade el servidor al `mcp.json` del cliente (Cursor: Ajustes → MCP; LM Studio: Program → Edit mcp.json):',
      },
      { type: 'code', lang: 'json', code: CODE_MCP_JSON },
      {
        type: 'p',
        text: 'También puedes poner `AGENT_PRIVATE_KEY` / `WALLET_ADDRESS` / `CHAIN_ID` directamente en el bloque `env` en vez de `BVCC_ENV_FILE`, pero un archivo aparte es más seguro.',
      },

      { type: 'h3', text: 'Hermes' },
      {
        type: 'p',
        text: 'Hermes habla MCP de forma nativa, así que no necesita plugin propio. En la pestaña **MCP** → **New server**, pon un **Name** y pega en **Server JSON** — pero aquí Hermes espera **solo el objeto del server**, *sin* el envoltorio `{ "mcpServers": { … } }`:',
      },
      { type: 'code', lang: 'json', code: CODE_HERMES_JSON },
      {
        type: 'callout',
        tone: 'warn',
        text: 'Pegar el envoltorio completo `{ "mcpServers": { … } }` aquí da `MCP server has no \'command\' in config`. Pega solo `{ command, args, env }`. Luego **Save server → Reload MCP**. El primer arranque tarda (npx descarga el paquete). Las tools no aparecen en "Skills & Tools" — esa pestaña es para tools integradas — pero el modelo las tiene (el log muestra `registered 53 tool(s)`).',
      },

      { type: 'h2', text: 'Reducir la superficie' },
      {
        type: 'p',
        text: 'Pon `BVCC_MCP_READONLY=true` para exponer solo las 27 tools de lectura/simulación (estado, saldos, cotizaciones, dry-runs) y ocultar las 26 que mueven fondos. Útil para una primera conexión, dashboards o modelos no confiables. Para que el modelo pueda hacer swaps o enviar de verdad, usa la entrada completa **sin** esa variable.',
      },
      {
        type: 'p',
        text: '`BVCC_MCP_MODULES` recorta por funcionalidad y se combina con lo anterior: `core` solo son 20 tools, `aave` 21, `lp` 16, y `core` + solo-lectura deja 13. Si un agente no va a tocar préstamos, dejar esas tools fuera es una cosa menos que puede hacer mal. Las dos tools de guías se exponen siempre por encima, así que un agente restringido sigue pudiendo leer cómo usar lo que tiene.',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Ninguna de las dos variables es la frontera de seguridad — esa es el contrato. Solo reducen a qué puede echar mano un modelo confundido.',
      },

      { type: 'h2', text: 'Verificar' },
      {
        type: 'p',
        text: 'Reinicia el cliente y pídele al modelo que **compruebe el estado del agente** (`getAgentStatus`). Quieres `isAuthorized: true`, `isPaused: false`, y los `allowedTokens` / `allowedProtocols` esperados. Luego prueba una lectura, un plan (`buildSwapPlan` con `quote: true`), y por fin una escritura. Buen primer prompt:',
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Comprueba el estado del agente y mis saldos, luego haz swap de 10 USDC a WBTC con 1% de slippage.',
      },

      { type: 'h2', text: 'Solución de problemas' },
      {
        type: 'table',
        headers: ['Síntoma', 'Causa', 'Solución'],
        rows: [
          ['`NotAuthorizedAgent`', 'Agente no autorizado en esta red', 'Autoriza la dirección del agente en esa red (paso 3).'],
          ['Tx falla / "out of funds for gas"', 'La EOA del agente no tiene saldo nativo', 'Envía gas a la EOA del agente (paso 4).'],
          ['`TokenNotAllowed` / `ProtocolNotAllowed`', 'Token/router no whitelisteado', 'Añádelo a allowedTokens / allowedProtocols.'],
          ['`EnforcedPause`', 'Agentes pausados en la wallet', 'Despausa desde el dashboard.'],
          ['Acción en la red equivocada', '`network` omitido / incorrecto', 'Pasa `network` explícito, o ajusta `CHAIN_ID`.'],
          ['Hermes: `no \'command\' in config`', 'Pegaste el envoltorio `mcpServers`', 'Pega solo el objeto del server `{ command, args, env }`.'],
          ['Versión vieja vía `npx`', 'Caché de npx', 'Fija `@bvcc/agent-mcp@latest` o ejecuta `npx clear-npx-cache`.'],
        ],
      },
    ],
  },
}
