// Mirrored from docs/contracts.md (monorepo, English canonical) — keep in sync
import type { LocalizedDoc } from '@/components/DocsPage'

const CODE_OWNER_FNS = `function authorizeAgent(AuthorizeParams calldata p) external; // re-auth PRESERVES spending history
function revokeAgent(address agent) external;                 // active = false, history kept
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgents() external;                              // emergency stop, blocks executeAsAgent
function unpauseAgents() external;
function setCallPolicy(address target, bytes4 selector, uint256 policy) external; // per-selector Case-3 policy`

const CODE_AGENT_FN =
  'function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // nonReentrant, whenNotPaused'

const CODE_GETTERS = `function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 dailySpent, uint128 totalSpent);
function getCallPolicy(address target, bytes4 selector) external view returns (uint256); // V3
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent`

const CODE_FACTORY = `constructor(address owner_); // owner = kill-switch admin, separate from deployer and fee wallet

function getWalletAddress(uint256 pubKeyX, uint256 pubKeyY) public view returns (address);
function createWallet(uint256 pubKeyX, uint256 pubKeyY, address[3] memory guardians, string calldata credentialId)
    external returns (address wallet);
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: permanently blocks NEW wallet creation`

const ADDR_ROWS = [
  ['`BVCCSmartWalletFactoryV4`', '`0xfd105197109244483b5f870501326E6faec9F93c`'],
  ['`BVCCAgentWalletFactoryV4`', '`0xf3A61F9d64d45362E149A111289546523BCd26a6`'],
  ['`BVCCValidatorRegistry`', '`0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2`'],
  ['`BVCCHookRegistry`', '`0x551C6e7ABdA04a110790888e711198f25621b066`'],
  ['EntryPoint (OpenZeppelin v0.9)', '`0x433709009B8330FDa32311DF1C2AFA402eD8D009`'],
]

export const contracts: LocalizedDoc = {
  en: {
    title: 'Contract Reference',
    intro:
      'Solidity sources live in the `contracts/` folder of the monorepo. Built with Foundry + OpenZeppelin; the V4 line uses a frozen toolchain (solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true`) so the CREATE2 addresses stay deterministic.',
    blocks: [
      { type: 'h2', text: 'Deployed addresses' },
      { type: 'p', text: 'Deterministic CREATE2 — the factories and both registries have the same address on every network:' },
      { type: 'table', headers: ['Contract', 'Address'], rows: ADDR_ROWS },
      {
        type: 'p',
        text: 'Live on Arbitrum One, Base, BNB Chain, Ethereum, Polygon and Arbitrum Sepolia (testnet). The per-chain validators (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`) are bound to each chain’s router / position manager, so their addresses differ per network — see the monorepo’s `contracts/deployments/`. Previous V2 factories (`0x230b…BdEf1` / `0x8D9e…054c`) are deprecated.',
      },

      { type: 'h2', text: 'BVCCSmartWalletV4 — personal wallet (walletType 0)' },
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

      { type: 'h2', text: 'BVCCAgentWalletV4 — AI agent wallet (walletType 1)' },
      {
        type: 'p',
        text: 'Extends `BVCCSmartWalletV4`; adds delegated execution for authorized agent EOAs. Fee is 0.15%. On top of the whitelists below, V3 introduced per-selector call policies for DeFi calls (see Call policies).',
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
          ['`allowedProtocols`', '`address[]`', 'DeFi target whitelist; empty reverts (`NoProtocolsWhitelisted`)'],
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

      { type: 'h3', text: 'Call policies' },
      {
        type: 'p',
        text: 'For DeFi calls (case 3), whitelisting a protocol in `allowedProtocols` is necessary but no longer sufficient: the call’s selector must also have a policy registered by the owner, or it reverts with `SelectorNotAllowed`. A policy is a packed `uint256`:',
      },
      {
        type: 'list',
        items: [
          'PIN_WALLET — a fixed calldata word must equal the wallet (recipient at a known offset: SwapRouter02, Aave Pool supply/withdraw/borrow/repay). A mismatch reverts with `PinnedArgMismatch`.',
          'PIN_PROTOCOL — a calldata word must be an already-whitelisted protocol (e.g. the spender in `Permit2.approve`).',
          'DEEP — defers to the on-chain validator registry, which decodes variable-length calldata and checks every recipient (Universal Router `execute`, v4 PositionManager `modifyLiquidities`). Fail-closed: no validator, false, or a revert denies the call (`PolicyValidationFailed`).',
        ],
      },
      {
        type: 'p',
        text: 'Allowing a validator is timelocked 48h; denying one is immediate. The biometric owner is never subject to call policies — they apply only to agents. Policies are set with `setCallPolicy`, usually bundled into the same biometric signature that authorizes the agent.',
      },

      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },

      { type: 'h2', text: 'Factories' },
      { type: 'p', text: 'Both factories share the same shape:' },
      { type: 'code', lang: 'solidity', code: CODE_FACTORY },
      {
        type: 'list',
        items: [
          'Deterministic address: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derived only from the passkey’s P-256 public key. Same key → same wallet address on every network. Guardians don’t affect the address: the factory only deploys, and the owner registers them afterwards with `setGuardians`, callable only by the wallet itself (a passkey-signed self-call). Whoever deploys an address therefore cannot choose who can rotate its owner. The set is replaceable by the owner, except while a recovery is in flight.',
          'Counterfactual: `getWalletAddress` is a view — you can receive funds at the address before deploying.',
          'Idempotent: `createWallet` returns the existing wallet if already deployed.',
          'Kill switch: `kill()` stops new creations only; existing wallets are independent contracts and keep working with their funds.',
          'V4 addresses differ from V3: the wallet bytecode changed, so the same passkey resolves to a different address. V3 users recreate their wallet and move funds (same playbook as every generation before). The app shows a banner on wallets that are behind.',
        ],
      },

      { type: 'h2', text: 'Registries & validators' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistry` — fixed dispatch point, compiled as a constant inside the wallet so a forged validator can’t be injected. Maps a protocol target to its validator.',
          '`BVCCUniversalRouterValidator` / `BVCCPositionManagerValidator` — per-chain, each bound to that chain’s router / position manager; addresses differ per network (see `contracts/deployments/`).',
          '`BVCCHookRegistry` — allowlist of approved Uniswap v4 hooks, gated by the same 48h governance.',
          '`IBVCCValidator` — the shared `validate(...)` view interface. It is an interface, not a deployed contract; the concrete validators implement it and are staticcalled fail-closed.',
        ],
      },

      { type: 'h2', text: 'Security notes' },
      {
        type: 'list',
        items: [
          'Internal security review, bilingual report in the monorepo’s `audits/` folder and linked from these docs. Four review rounds so far: seven high-severity findings, all fixed and shipped in V4 — including a cross-function reentrancy that let a compromised agent bypass every limit, and guardian squatting through the factory. Two issues stay open by decision and are documented with their mitigations. The V4 suite is 303 Foundry tests (unit, fork & fuzz). No external audit yet.',
          'V2 (June 2026) fixed a gas-griefing edge on Arbitrum: balance probes are capped at 100k gas (`PROBE_GAS_CAP`) so calldata that happens to contain a precompile address can’t burn the transaction’s gas. V3 keeps this fix.',
          'V3 (July 2026) closes an agent fund-exfiltration path: a stolen agent key could previously name its own address as the recipient/`to` of a swap or `Pool.withdraw` and move funds without touching the ETH/token budget. V3 makes case-3 calls default-deny per selector and pins the recipient to the wallet (or validates it on-chain). The owner’s biometric path is unaffected.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'No external audit yet — this is experimental beta software.' },
    ],
  },

  es: {
    title: 'Referencia de contratos',
    intro:
      'El código Solidity vive en la carpeta `contracts/` del monorepo. Compilado con Foundry + OpenZeppelin; la línea V4 usa un toolchain congelado (solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true`) para que las direcciones CREATE2 sean deterministas.',
    blocks: [
      { type: 'h2', text: 'Direcciones desplegadas' },
      { type: 'p', text: 'CREATE2 determinista — las factories y ambos registries tienen la misma dirección en todas las redes:' },
      { type: 'table', headers: ['Contrato', 'Dirección'], rows: ADDR_ROWS },
      {
        type: 'p',
        text: 'En vivo en Arbitrum One, Base, BNB Chain, Ethereum, Polygon y Arbitrum Sepolia (testnet). Los validators por red (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`) van ligados al router / position manager de cada cadena, así que su dirección difiere por red — ver `contracts/deployments/` del monorepo. Las factories V2 anteriores (`0x230b…BdEf1` / `0x8D9e…054c`) quedan obsoletas.',
      },

      { type: 'h2', text: 'BVCCSmartWalletV4 — wallet personal (walletType 0)' },
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

      { type: 'h2', text: 'BVCCAgentWalletV4 — wallet de agente IA (walletType 1)' },
      {
        type: 'p',
        text: 'Extiende `BVCCSmartWalletV4`; añade ejecución delegada para EOAs de agente autorizadas. La comisión es 0,15%. Además de las whitelists de abajo, V3 añade call policies por selector para las llamadas DeFi (ver Call policies).',
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
          ['`allowedProtocols`', '`address[]`', 'whitelist de targets DeFi; vacía revierte (`NoProtocolsWhitelisted`)'],
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

      { type: 'h3', text: 'Call policies' },
      {
        type: 'p',
        text: 'Para las llamadas DeFi (caso 3), tener el protocolo en `allowedProtocols` es necesario pero ya no basta: el selector de la llamada también debe tener una policy registrada por el dueño, o revierte con `SelectorNotAllowed`. Una policy es un `uint256` empaquetado:',
      },
      {
        type: 'list',
        items: [
          'PIN_WALLET — una palabra fija del calldata debe ser la wallet (destinatario en un offset conocido: SwapRouter02, Aave Pool supply/withdraw/borrow/repay). Si no coincide, revierte con `PinnedArgMismatch`.',
          'PIN_PROTOCOL — una palabra del calldata debe ser un protocolo ya whitelisteado (p. ej. el spender en `Permit2.approve`).',
          'DEEP — delega en el validator registry on-chain, que decodifica calldata de longitud variable y comprueba cada destinatario (Universal Router `execute`, v4 PositionManager `modifyLiquidities`). Fail-closed: sin validator, false o un revert deniegan la llamada (`PolicyValidationFailed`).',
        ],
      },
      {
        type: 'p',
        text: 'Permitir un validator lleva timelock de 48h; denegarlo es inmediato. El dueño biométrico nunca está sujeto a call policies — solo aplican a los agentes. Las policies se fijan con `setCallPolicy`, normalmente en la misma firma biométrica que autoriza al agente.',
      },

      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },

      { type: 'h2', text: 'Factories' },
      { type: 'p', text: 'Ambas factories comparten la misma forma:' },
      { type: 'code', lang: 'solidity', code: CODE_FACTORY },
      {
        type: 'list',
        items: [
          'Dirección determinista: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))` — derivada solo de la clave pública P-256 de la passkey. Misma clave → misma dirección de wallet en todas las redes. Los guardians no afectan a la dirección: la factory solo despliega, y el propietario los registra después con `setGuardians`, que solo puede llamar la propia wallet (auto-llamada firmada con la passkey). Quien despliegue una dirección no puede, por tanto, elegir quién puede rotar a su dueño. El conjunto es reemplazable por el propietario, salvo con una recuperación en vuelo.',
          'Counterfactual: `getWalletAddress` es una view — puedes recibir fondos en la dirección antes de desplegarla.',
          'Idempotente: `createWallet` devuelve la wallet existente si ya está desplegada.',
          'Kill switch: `kill()` solo bloquea creaciones nuevas; las wallets existentes son contratos independientes y siguen funcionando con sus fondos.',
          'Las direcciones V3 difieren de V2: el bytecode del wallet cambió, así que la misma passkey resuelve a otra dirección. Los usuarios de V2 recrean su wallet y mueven los fondos (mismo playbook que V1 → V2).',
        ],
      },

      { type: 'h2', text: 'Registries y validators (V3)' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistry` — punto de despacho fijo, compilado como constante dentro del wallet para que no se pueda colar un validator falso. Mapea un target de protocolo a su validator.',
          '`BVCCUniversalRouterValidator` / `BVCCPositionManagerValidator` — por red, cada uno ligado al router / position manager de esa cadena; las direcciones difieren por red (ver `contracts/deployments/`).',
          '`BVCCHookRegistry` — allowlist de hooks Uniswap v4 aprobados, con la misma gobernanza de 48h.',
          '`IBVCCValidator` — la interfaz view `validate(...)` compartida. Es una interfaz, no un contrato desplegado; los validators concretos la implementan y se llaman por staticcall en modo fail-closed.',
        ],
      },

      { type: 'h2', text: 'Notas de seguridad' },
      {
        type: 'list',
        items: [
          'Security review interna, informe bilingüe en la carpeta `audits/` del monorepo y enlazado desde esta documentación. Cuatro rondas hasta ahora: siete hallazgos de severidad alta, todos corregidos y publicados en V4 — entre ellos una reentrada cruzada que permitía a un agente comprometido saltarse todos los límites, y la apropiación de guardianes vía la factory. Dos quedan abiertos por decisión, documentados con sus mitigaciones. La suite V4 son 303 tests de Foundry (unit, fork y fuzz). Sin auditoría externa todavía.',
          'La V2 (junio 2026) corrigió un caso de gas-griefing en Arbitrum: las probes de balance van capadas a 100k de gas (`PROBE_GAS_CAP`) para que un calldata que casualmente contenga la dirección de un precompile no pueda quemar el gas de la transacción. V3 mantiene este fix.',
          'La V3 (julio 2026) cierra una vía de exfiltración de fondos del agente: una clave de agente robada podía antes poner su propia dirección como recipient/`to` de un swap o `Pool.withdraw` y mover fondos sin tocar el presupuesto de ETH/token. V3 hace las llamadas del caso 3 default-deny por selector y ancla el destinatario a la wallet (o lo valida on-chain). El camino biométrico del dueño no se ve afectado.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'Aún sin auditoría externa — es software experimental en beta.' },
    ],
  },
}
