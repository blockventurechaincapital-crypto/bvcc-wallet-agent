/**
 * Latest published SDK and MCP versions, shown on the agent cards in /wallet/agents.
 *
 * Set by hand: when a new version goes out on npm, add it at the TOP of
 * `RELEASE_HISTORY` with what it changes, and deploy the app. Keep the older entries:
 * an agent on an old version is shown the changes of every version after its own,
 * so the owner can decide whether to move it to the latest one.
 */

import { compareVersions } from './sourceTag'

/** One published version and what it changes, one short line each. */
export type VersionNotes = { version: string; en: string[]; es: string[] }

export type ToolRelease = {
  /** Latest version: the first entry of `history`. */
  version: string
  /** Command that installs or runs the latest version. */
  command: string
  /** Base URL of the GitHub releases; the version tag is appended. */
  releasesUrl: string
  /** Every published version, newest first. */
  history: VersionNotes[]
}

/**
 * SDK and MCP are released together with the same version number, so they share one
 * history. Newest first.
 */
const RELEASE_HISTORY: VersionNotes[] = [
  {
    version: '0.4.0',
    en: [
      'Fixes wrapping ETH into WETH: asking to swap ETH for WETH used to fail every time and waste gas. It now just wraps.',
      'New wrapNative and unwrapNative actions to move between ETH and WETH, with a dry-run for each.',
      'A swap from a token to itself is refused before spending any gas.',
    ],
    es: [
      'Arregla envolver ETH en WETH: pedir un swap de ETH a WETH fallaba siempre y gastaba gas. Ahora simplemente envuelve.',
      'Nuevas acciones wrapNative y unwrapNative para pasar de ETH a WETH y al revés, cada una con su simulación.',
      'Un swap de un token a sí mismo se rechaza antes de gastar gas.',
    ],
  },
  {
    version: '0.3.1',
    en: [
      'Tells the agent when a newer version is out: getAgentStatus reports it, and the agent passes it on to you once.',
    ],
    es: [
      'Avisa al agente cuando sale una versión nueva: getAgentStatus lo indica y el agente te lo cuenta una vez.',
    ],
  },
  {
    version: '0.3.0',
    en: [
      'Works with V5 wallets.',
      'Sends transactions with a 20% gas margin, so valid operations no longer run out of gas.',
      "Swap deadlines use the chain's clock instead of the computer's.",
      'Each failure says whether retrying can help.',
      'Liquidity ranges are given as prices, and it asks before opening a range outside the current price.',
      'Each transaction carries a tag with the tool and its version. This notice reads it.',
    ],
    es: [
      'Funciona con las wallets V5.',
      'Envía las operaciones con un 20% de margen de gas, así que las operaciones válidas ya no se quedan sin gas.',
      'Los plazos de los swaps usan la hora de la red en vez de la del ordenador.',
      'Cada fallo dice si sirve de algo reintentar.',
      'Los rangos de liquidez se indican en precios, y pregunta antes de abrir un rango fuera del precio actual.',
      'Cada operación lleva una etiqueta con la herramienta y su versión. Este aviso la lee.',
    ],
  },
]

export const AGENT_TOOL_RELEASES: Record<'sdk' | 'mcp', ToolRelease> = {
  sdk: {
    version: RELEASE_HISTORY[0].version,
    command: 'npm i @bvcc/agent-sdk@latest',
    releasesUrl: 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-sdk/releases/tag/v',
    history: RELEASE_HISTORY,
  },
  mcp: {
    version: RELEASE_HISTORY[0].version,
    command: 'npx -y @bvcc/agent-mcp@latest',
    releasesUrl: 'https://github.com/blockventurechaincapital-crypto/bvcc-agent-mcp/releases/tag/v',
    history: RELEASE_HISTORY,
  },
}

export function releaseUrl(r: ToolRelease): string {
  return `${r.releasesUrl}${r.version}`
}

/** The versions after `from`, newest first, with what each one changes. */
export function changesSince(r: ToolRelease, from: string): VersionNotes[] {
  return r.history.filter(v => compareVersions(v.version, from) > 0)
}
