// Mirrored from docs/contracts.md (monorepo, English canonical) — keep in sync
import type { LocalizedDoc } from '@/components/DocsPage'

const CODE_OWNER_FNS = `function authorizeAgent(AuthorizeParams calldata p) external; // re-auth PRESERVES spending history
function revokeAgent(address agent) external;                 // active = false, history kept
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgents() external;                              // emergency stop, blocks executeAsAgent
function unpauseAgents() external;`

const CODE_AGENT_FN =
  'function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // nonReentrant, whenNotPaused'

const CODE_GETTERS = `function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 dailySpent, uint128 totalSpent);
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent`

const CODE_FACTORY = `constructor(address owner_); // owner = kill-switch admin, separate from deployer and fee wallet

function getWalletAddress(uint256 pubKeyX, uint256 pubKeyY) public view returns (address);
function createWallet(uint256 pubKeyX, uint256 pubKeyY, address[3] memory guardians, string calldata credentialId)
    external returns (address wallet);
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: permanently blocks NEW wallet creation`

const ADDR_ROWS = [
  ['`BVCCSmartWalletFactoryV2`', '`0x230b7010529AB6977Dd8581B3eF018ef865BdEf1`'],
  ['`BVCCAgentWalletFactoryV2`', '`0x8D9e24022777173AD6336e00884b6C87c7EF054c`'],
  ['EntryPoint (OpenZeppelin v0.9)', '`0x433709009B8330FDa32311DF1C2AFA402eD8D009`'],
]

export const contracts: LocalizedDoc = {
  en: {
    title: 'Contract Reference',
    intro:
      'Solidity sources live in the `contracts/` folder of the monorepo. Built with Foundry + OpenZeppelin, `pragma ^0.8.27`, `via_ir = true`.',
    blocks: [
      { type: 'h2', text: 'Deployed addresses' },
      { type: 'p', text: 'Deterministic CREATE2 — same address on every network:' },
      { type: 'table', headers: ['Contract', 'Address'], rows: ADDR_ROWS },
      {
        type: 'p',
        text: 'Live on Arbitrum One, Base, BNB Chain, Ethereum, Polygon and Arbitrum Sepolia (testnet) — same addresses on every network.',
      },

      { type: 'h2', text: 'BVCCSmartWalletV2 — personal wallet (walletType 0)' },
      { type: 'p', text: 'One contract per user, deployed by the factory. No proxies, no upgradability.' },
      {
        type: 'list',
        items: [
          'Signer: WebAuthn / P-256 public key (passkey), fixed at deployment. Every `execute()` is authenticated via ERC-4337 UserOp signature validation.',
          'Execution: ERC-7821 batched execution (`execute(bytes32 mode, bytes executionData)` with `Execution[]` batches).',
          'Fee: 0.05% per operation to the BVCC fee wallet (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), three cases — (1) ETH send: fee deducted from the sent value; (2) ERC-20 transfer: fee charged on top, the wallet must hold `amount + fee`; (3) DeFi/swap: balance snapshot before/after, fee on detected token balance increases.',
          'Recovery: 3 guardian addresses, set once at creation. Replacing the WebAuthn signer requires 2-of-3 guardian signatures + a 48-hour timelock. Recovery functions bypass `execute()` and pay no fee.',
        ],
      },

      { type: 'h2', text: 'BVCCAgentWalletV2 — AI agent wallet (walletType 1)' },
      {
        type: 'p',
        text: 'Extends `BVCCSmartWalletV2`; adds delegated execution for authorized agent EOAs. Fee is 0.15%.',
      },

      { type: 'h3', text: 'AuthorizeParams (input to authorizeAgent)' },
      {
        type: 'table',
        headers: ['Field', 'Type', 'Meaning (`0` = unlimited/disabled)'],
        rows: [
          ['`agent`', '`address`', 'agent EOA (must have no code)'],
          ['`maxPerTxWei`', '`uint128`', 'max ETH per single `Execution` item'],
          ['`dailyLimitWei`', '`uint128`', 'max ETH per UTC day'],
          ['`totalBudgetWei`', '`uint128`', 'lifetime ETH budget'],
          ['`periodBudgetWei`', '`uint128`', 'max ETH per rolling period'],
          ['`periodDuration`', '`uint64`', 'period length in seconds'],
          ['`expiry`', '`uint64`', 'unix timestamp; agent disabled after'],
          ['`allowedTokens`', '`address[]`', 'ERC-20 whitelist; empty = deny all token ops'],
          ['`tokenMaxAmounts`', '`uint128[]`', 'parallel: token cap per batch'],
          ['`tokenDailyLimits`', '`uint128[]`', 'parallel: token cap per UTC day'],
          ['`tokenTotalBudgets`', '`uint128[]`', 'parallel: lifetime token budget'],
          ['`allowedProtocols`', '`address[]`', 'DeFi target whitelist; empty = deny all DeFi calls'],
          [
            '`allowedRecipients`',
            '`address[]`',
            'unified destination whitelist (ETH recipients, token recipients, approve spenders); empty = allow any',
          ],
        ],
      },
      { type: 'p', text: 'Whitelists max 20 entries each. The four token arrays must have equal length.' },

      { type: 'h3', text: 'Owner functions (callable only via the wallet’s own execute(), i.e. biometrics / WebAuthn)' },
      { type: 'code', lang: 'solidity', code: CODE_OWNER_FNS },

      { type: 'h3', text: 'Agent functions' },
      { type: 'code', lang: 'solidity', code: CODE_AGENT_FN },
      { type: 'p', text: 'See the Agent Integration Guide for call encoding, validation order and error reference.' },

      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },

      { type: 'h2', text: 'Factories' },
      { type: 'p', text: 'Both factories share the same shape:' },
      { type: 'code', lang: 'solidity', code: CODE_FACTORY },
      {
        type: 'list',
        items: [
          'Deterministic address: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derived only from the passkey’s P-256 public key. Same key → same wallet address on every network. Guardians don’t affect the address (set post-deploy via `setGuardians`, callable once).',
          'Counterfactual: `getWalletAddress` is a view — you can receive funds at the address before deploying.',
          'Idempotent: `createWallet` returns the existing wallet if already deployed.',
          'Kill switch: `kill()` stops new creations only; existing wallets are independent contracts and keep working with their funds.',
        ],
      },

      { type: 'h2', text: 'Security notes' },
      {
        type: 'list',
        items: [
          'Internal security review (bilingual report in the monorepo’s `audits/` folder): HIGH finding (approve cap-bypass) fixed; 131/131 Foundry tests pass; Slither clean of real findings.',
          'V2 (June 2026) fixed a gas-griefing edge on Arbitrum: balance probes are now capped at 100k gas (`PROBE_GAS_CAP`) so calldata that happens to contain a precompile address can’t burn the transaction’s gas.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'No external audit yet — this is experimental beta software.' },
    ],
  },

  es: {
    title: 'Referencia de contratos',
    intro:
      'El código Solidity vive en la carpeta `contracts/` del monorepo. Compilado con Foundry + OpenZeppelin, `pragma ^0.8.27`, `via_ir = true`.',
    blocks: [
      { type: 'h2', text: 'Direcciones desplegadas' },
      { type: 'p', text: 'CREATE2 determinista — misma dirección en todas las redes:' },
      { type: 'table', headers: ['Contrato', 'Dirección'], rows: ADDR_ROWS },
      {
        type: 'p',
        text: 'En vivo en Arbitrum One, Base, BNB Chain, Ethereum, Polygon y Arbitrum Sepolia (testnet) — mismas direcciones en todas las redes.',
      },

      { type: 'h2', text: 'BVCCSmartWalletV2 — wallet personal (walletType 0)' },
      { type: 'p', text: 'Un contrato por usuario, desplegado por la factory. Sin proxies, sin upgradability.' },
      {
        type: 'list',
        items: [
          'Signer: clave pública WebAuthn / P-256 (passkey), fijada en el despliegue. Cada `execute()` se autentica vía validación de firma de UserOp ERC-4337.',
          'Ejecución: batched execution ERC-7821 (`execute(bytes32 mode, bytes executionData)` con batches `Execution[]`).',
          'Comisión: 0,05% por operación a la fee wallet de BVCC (`0x3e3eb089169a7315a994947465ce5f5FC3A307D4`), tres casos — (1) envío de ETH: se descuenta del valor enviado; (2) transfer ERC-20: se cobra aparte, la wallet debe tener `amount + fee`; (3) DeFi/swap: snapshot de balances antes/después, comisión sobre los incrementos de balance detectados.',
          'Recovery: 3 direcciones guardian, fijadas una vez al crear. Reemplazar el signer WebAuthn requiere firmas 2-de-3 de guardians + timelock de 48 horas. Las funciones de recovery no pasan por `execute()` y no pagan comisión.',
        ],
      },

      { type: 'h2', text: 'BVCCAgentWalletV2 — wallet de agente IA (walletType 1)' },
      {
        type: 'p',
        text: 'Extiende `BVCCSmartWalletV2`; añade ejecución delegada para EOAs de agente autorizadas. La comisión es 0,15%.',
      },

      { type: 'h3', text: 'AuthorizeParams (input de authorizeAgent)' },
      {
        type: 'table',
        headers: ['Campo', 'Tipo', 'Significado (`0` = ilimitado/desactivado)'],
        rows: [
          ['`agent`', '`address`', 'EOA del agente (no debe tener código)'],
          ['`maxPerTxWei`', '`uint128`', 'máx. ETH por item `Execution` individual'],
          ['`dailyLimitWei`', '`uint128`', 'máx. ETH por día UTC'],
          ['`totalBudgetWei`', '`uint128`', 'presupuesto de ETH de por vida'],
          ['`periodBudgetWei`', '`uint128`', 'máx. ETH por periodo renovable'],
          ['`periodDuration`', '`uint64`', 'duración del periodo en segundos'],
          ['`expiry`', '`uint64`', 'timestamp unix; el agente queda desactivado después'],
          ['`allowedTokens`', '`address[]`', 'whitelist ERC-20; vacía = denegar toda operación con tokens'],
          ['`tokenMaxAmounts`', '`uint128[]`', 'paralelo: tope de token por batch'],
          ['`tokenDailyLimits`', '`uint128[]`', 'paralelo: tope de token por día UTC'],
          ['`tokenTotalBudgets`', '`uint128[]`', 'paralelo: presupuesto de token de por vida'],
          ['`allowedProtocols`', '`address[]`', 'whitelist de targets DeFi; vacía = denegar todas las llamadas DeFi'],
          [
            '`allowedRecipients`',
            '`address[]`',
            'whitelist unificada de destinos (destinatarios de ETH y tokens, spenders de approve); vacía = permitir cualquiera',
          ],
        ],
      },
      { type: 'p', text: 'Whitelists de máximo 20 entradas cada una. Los cuatro arrays de tokens deben tener la misma longitud.' },

      { type: 'h3', text: 'Funciones de dueño (solo llamables vía el execute() de la propia wallet, es decir biometría / WebAuthn)' },
      { type: 'code', lang: 'solidity', code: CODE_OWNER_FNS },

      { type: 'h3', text: 'Funciones de agente' },
      { type: 'code', lang: 'solidity', code: CODE_AGENT_FN },
      { type: 'p', text: 'Mira la guía de integración de agentes para el encoding de llamadas, el orden de validación y la referencia de errores.' },

      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },

      { type: 'h2', text: 'Factories' },
      { type: 'p', text: 'Ambas factories comparten la misma forma:' },
      { type: 'code', lang: 'solidity', code: CODE_FACTORY },
      {
        type: 'list',
        items: [
          'Dirección determinista: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derivada solo de la clave pública P-256 de la passkey. Misma clave → misma dirección de wallet en todas las redes. Los guardians no afectan a la dirección (se fijan post-deploy vía `setGuardians`, llamable una vez).',
          'Counterfactual: `getWalletAddress` es una view — puedes recibir fondos en la dirección antes de desplegarla.',
          'Idempotente: `createWallet` devuelve la wallet existente si ya está desplegada.',
          'Kill switch: `kill()` solo bloquea creaciones nuevas; las wallets existentes son contratos independientes y siguen funcionando con sus fondos.',
        ],
      },

      { type: 'h2', text: 'Notas de seguridad' },
      {
        type: 'list',
        items: [
          'Security review interna (informe bilingüe en la carpeta `audits/` del monorepo): finding HIGH (approve cap-bypass) corregido; 131/131 tests de Foundry en verde; Slither limpio de hallazgos reales.',
          'La V2 (junio 2026) corrigió un caso de gas-griefing en Arbitrum: las probes de balance van capadas a 100k de gas (`PROBE_GAS_CAP`) para que un calldata que casualmente contenga la dirección de un precompile no pueda quemar el gas de la transacción.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'Aún sin auditoría externa — es software experimental en beta.' },
    ],
  },
}
