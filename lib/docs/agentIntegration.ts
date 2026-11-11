// Mirrored from docs/agent-integration.md (monorepo, English canonical) — keep in sync
// Wallet V5 is the current generation; V4 differences are in the last section.
import type { LocalizedDoc } from '@/components/DocsPage'

// Code blocks are shared between languages (code is not translated)
const CODE_SIG = 'function executeAsAgent(bytes32 mode, bytes calldata executionData) external;'

const CODE_BATCH_MODE = 'BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000'

const CODE_EXECUTION = `struct Execution {
    address target;   // contract or recipient to call
    uint256 value;    // native value (wei) to send with the call
    bytes   callData; // calldata; empty for pure native sends
}

// executionData = abi.encode(Execution[])  — a single call is a batch of one`

const CODE_GETTERS = `// Permissions, including the agent's own pause flag and expiry
function getAgentPermission(address agent) external view returns (AgentPermission memory);
// Native spending counters (total, period)
function getAgentSpending(address agent) external view returns (AgentSpending memory);
// Native spent in the current UTC day
function getDailySpent(address agent) external view returns (uint128);
// Token spent: current UTC day + lifetime (charges include the fee)
function getTokenSpent(address agent, address token) external view returns (uint128 daily, uint128 total);
// Policy and value set for one function of one contract
function getAgentCallPolicy(address agent, address target, bytes4 selector) external view returns (uint256);
function getAgentValueSet(address agent, address target, bytes4 selector) external view returns (bytes32[] memory);
function isTargetBlocked(address target) external view returns (bool);
function paused() external view returns (bool); // all agents paused
function getAgents() external view returns (address[] memory);`

const CODE_EVENTS = `// Charges include the fees
event AgentExecution(address indexed agent, uint256 ethCharged, uint256 ethFee,
                     address[] tokens, uint256[] tokenCharges, uint256[] tokenFees);
event AgentAuthorized(address indexed agent, uint128 maxPerTxWei, uint128 dailyLimitWei,
                      uint128 totalBudgetWei, uint128 periodBudgetWei, uint64 periodDuration, uint64 expiry);
event AgentRevoked(address indexed agent);
event AgentRenewed(address indexed agent, uint64 expiry);
event AgentPausedSet(address indexed agent, bool paused);
event AgentsPaused();
event AgentsUnpaused();
event AgentBudgetIncreased(address indexed agent, uint128 additionalWei, uint128 newTotalBudget);
event AgentCallPolicySet(address indexed agent, address indexed target, bytes4 indexed selector, uint256 policy);
event TargetBlocked(address indexed target, bool blocked);`

const CODE_FOUNDRY = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Execution} from "openzeppelin-contracts/contracts/account/utils/draft-ERC7579Utils.sol";

interface IAgentWallet {
    function executeAsAgent(bytes32 mode, bytes calldata executionData) external;
}

contract AgentSendEth is Script {
    bytes32 constant BATCH_MODE = 0x0100000000000000000000000000000000000000000000000000000000000000;

    function run() external {
        address agentWallet = 0xYourAgentWalletAddress;
        address recipient   = 0xRecipientAddress;

        Execution[] memory execs = new Execution[](1);
        execs[0] = Execution({ target: recipient, value: 0.001 ether, callData: "" });

        vm.startBroadcast(); // broadcasts with the agent's private key
        IAgentWallet(agentWallet).executeAsAgent(BATCH_MODE, abi.encode(execs));
        vm.stopBroadcast();
    }
}`

const CODE_FORGE_CMD = `forge script script/AgentSendEth.s.sol \\
  --rpc-url https://arb1.arbitrum.io/rpc \\
  --private-key $AGENT_PRIVATE_KEY \\
  --broadcast`

const CODE_VIEM = `import { createWalletClient, createPublicClient, http, parseEther,
         parseUnits, encodeAbiParameters, encodeFunctionData, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const AGENT_WALLET = '0xYourAgentWalletAddress'
const USDC         = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' // USDC on Arbitrum One
const BATCH_MODE   = '0x0100000000000000000000000000000000000000000000000000000000000000'

const agent = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`)
const wallet = createWalletClient({ account: agent, chain: arbitrum, transport: http() })
const client = createPublicClient({ chain: arbitrum, transport: http() })

const walletAbi = parseAbi([
  'function executeAsAgent(bytes32 mode, bytes executionData)',
  'function getDailySpent(address agent) view returns (uint128)',
])

// Optional: check remaining budget before sending
const spentToday = await client.readContract({
  address: AGENT_WALLET, abi: walletAbi,
  functionName: 'getDailySpent', args: [agent.address],
})

// Build the batch: Execution { target, value, callData }
const executions = [
  { // 1. send 0.001 ETH
    target: '0xRecipientAddress' as \`0x\${string}\`,
    value: parseEther('0.001'),
    callData: '0x' as \`0x\${string}\`,
  },
  { // 2. transfer 5 USDC (token must be in allowedTokens)
    target: USDC as \`0x\${string}\`,
    value: 0n,
    callData: encodeFunctionData({
      abi: parseAbi(['function transfer(address to, uint256 amount)']),
      args: ['0xRecipientAddress', parseUnits('5', 6)],
    }),
  },
]

// executionData = abi.encode(Execution[]) — same encoding as the Foundry script
const executionData = encodeAbiParameters(
  [{ type: 'tuple[]', components: [
    { name: 'target',   type: 'address' },
    { name: 'value',    type: 'uint256' },
    { name: 'callData', type: 'bytes'   },
  ]}],
  [executions],
)

const hash = await wallet.writeContract({
  address: AGENT_WALLET,
  abi: walletAbi,
  functionName: 'executeAsAgent',
  args: [BATCH_MODE, executionData],
})
console.log('tx:', hash)`

export const agentIntegration: LocalizedDoc = {
  en: {
    title: 'Agent Integration Guide',
    intro:
      'How an external AI agent (or any automated system) executes transactions through a BVCC Agent Wallet V5 (`BVCCAgentWalletV5`), the current generation. All permissions, limits and checks are enforced on-chain: the agent cannot exceed them, whatever its code does. Differences on older V4 wallets are at the end.',
    blocks: [
      { type: 'h2', text: 'How it works' },
      {
        type: 'list',
        items: [
          'The wallet owner authorizes an agent address from the app (`/wallet/agents`), signing with their passkey. This calls `authorizeAgent()` on the wallet with the agent’s limits and policies.',
          'The agent calls `executeAsAgent()` on the wallet directly, as a normal EVM transaction: no ERC-4337 UserOp, no bundler, no passkey signature.',
          'The agent pays gas from its own EOA. The funds it moves come from the wallet.',
          'The wallet measures what leaves during the batch and charges it, plus a 0.15% agent fee, against the agent’s limits.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'The TypeScript SDK (`@bvcc/agent-sdk`) and the MCP server (`@bvcc/agent-mcp`) do all of this for you: they read the wallet version, build the batch, check the limits first and decode the errors. See Connect an AI. This page is for integrating by hand.',
      },
      { type: 'p', text: 'Requirements for the agent account:' },
      {
        type: 'list',
        items: [
          'It must be a plain EOA, at authorization and at every call. An address with code, including an EIP-7702 delegation added later, is rejected (`AgentMustBeEOA`).',
          'It must be authorized, not expired, not paused on its own, and agents must not be paused globally.',
        ],
      },

      { type: 'h2', text: 'The entrypoint: executeAsAgent' },
      { type: 'code', lang: 'solidity', code: CODE_SIG },
      { type: 'p', text: '`mode` must be the ERC-7579 batch mode; anything else reverts with `UnsupportedExecutionMode`:' },
      { type: 'code', lang: 'text', code: CODE_BATCH_MODE },
      { type: 'p', text: '`executionData` is an ABI-encoded array of `Execution` structs:' },
      { type: 'code', lang: 'solidity', code: CODE_EXECUTION },
      { type: 'p', text: 'Limits are checked over the whole batch: the native value of all items added up, and the net outflow of each token.' },

      { type: 'h2', text: 'What the wallet checks on each item' },
      {
        type: 'table',
        headers: ['Item', 'Shape', 'Checks'],
        rows: [
          ['Native send', '`value > 0`, empty `callData`', '`target` in `allowedRecipients`'],
          ['ERC-20 transfer', '`transfer(address,uint256)`, no value', 'token in `allowedTokens`, recipient in `allowedRecipients`'],
          ['ERC-20 approve', '`approve(address,uint256)`, no value', 'token in `allowedTokens`, spender in `allowedProtocols`; reset after the batch'],
          ['Protocol call', 'anything else', '`target` in `allowedProtocols`, a policy with `ALLOWED` and `DEEP` for that agent and selector, the owner’s anchors, and a yes from the target’s validator'],
        ],
      },
      {
        type: 'list',
        items: [
          'The agent can never call the wallet itself (`AgentCannotCallWallet`), nor a contract the owner has blocked (`TargetIsBlocked`).',
          'Policies are set by the owner, in the app. You only need to know what passes.',
        ],
      },

      { type: 'h2', text: 'Protocol calls and validators' },
      {
        type: 'p',
        text: 'Every protocol call is checked by the validator registered for that contract on that network. A validator answers yes or no and tells the wallet which tokens to measure. What passes:',
      },
      {
        type: 'list',
        items: [
          'Universal Router `execute`: v3 exact-in / exact-out and v4 swaps between ERC-20 tokens. Every recipient must be the wallet (or the router’s "message sender" placeholder). v4 hooks must be none or approved. No native value: to swap native ETH, wrap it first.',
          'Uniswap v4 PositionManager `modifyLiquidities`: positions owned by the wallet only. Adding liquidity needs a position with no individual approval. One call cannot both remove and add liquidity; use two items. Hooks none or approved.',
          'Aave v3 Pool: `supply`, `withdraw`, `borrow` (variable rate), `repay`, `setUserUseReserveAsCollateral`, `setUserEMode`, always with the wallet as beneficiary. The asset must be an allowed token. A loan is charged against the budget, and after the batch the health factor must be at least 1.2 (`PostCheckFailed` otherwise).',
          'Uniswap v3 NonfungiblePositionManager: `mint` to the wallet; `increaseLiquidity`, `decreaseLiquidity`, `burn` and `collect` on the wallet’s own positions; `collect` to the wallet exactly.',
          'Wrapped native (WETH, WBNB, WPOL): `deposit()` with value, `withdraw(uint256)` without.',
        ],
      },
      {
        type: 'p',
        text: 'A validator that is not active on that network denies the call (`PolicyValidationFailed`). Withdrawals from Aave and from Uniswap positions are charged as they come into the wallet, so they count against the token’s budget too.',
      },

      { type: 'h2', text: 'Spending limits' },
      {
        type: 'p',
        text: 'Set per agent in `authorizeAgent`. `0` means nothing allowed; "unlimited" is `type(uint128).max`. Every charge includes the 0.15% fee.',
      },
      {
        type: 'table',
        headers: ['Limit', 'Scope', 'Error on violation'],
        rows: [
          ['`maxPerTxWei`', 'native value of the whole batch, plus fee', '`ExceedsPerTxLimit`'],
          ['`dailyLimitWei`', 'native per UTC day', '`DailyLimitExceeded`'],
          ['`totalBudgetWei`', 'native lifetime', '`TotalBudgetExceeded`'],
          ['`periodBudgetWei` + `periodDuration`', 'native per rolling period (only if duration > 0)', '`PeriodBudgetExceeded`'],
          ['`tokenMaxAmounts[i]`', 'token outflow + costs + fee, per batch', '`TokenBatchLimitExceeded`'],
          ['`tokenDailyLimits[i]`', 'per token, per UTC day', '`TokenDailyLimitExceeded`'],
          ['`tokenTotalBudgets[i]`', 'per token, lifetime', '`TokenTotalBudgetExceeded`'],
          ['`expiry`', 'required, at most 365 days ahead; renewable with `renewAgent`', '`AgentPermissionsExpired`'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'Spending history is kept when the owner re-authorizes an agent, so changing limits does not reset what was already spent.',
      },

      { type: 'h2', text: 'Fees and measurement' },
      {
        type: 'list',
        items: [
          'The 0.15% agent fee is charged on what leaves the wallet, in the same asset, on top of the amount. A transfer of 100 USDC costs the wallet 100.15 USDC and counts 100.15 against the limits.',
          'To move a whole balance, leave room for the fee: send at most `balance / 1.0015`. Otherwise the batch reverts.',
          'What comes into the wallet from a swap pays nothing. Withdrawals from Aave or a liquidity position are charged as inflows.',
          'Every token on the agent’s list, every token found in the calldata and every token a validator declares is measured, up to 60. A balance that cannot be read reverts the batch (`MeasurementFailed`).',
          'Tokens that charge the sender a tax cannot be moved by agents: the fee payment would take more than the fee.',
          'Approvals the agent makes are set back to their previous value when the batch ends. Permit2 allowances for the Universal Router and the PositionManager come from the owner, not from the agent.',
        ],
      },

      { type: 'h2', text: 'Reading agent state' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },
      { type: 'p', text: 'A well-behaved agent reads these before submitting and sizes its batch to fit what is left, fee included.' },

      { type: 'h2', text: 'Error reference' },
      {
        type: 'table',
        headers: ['Error', 'Cause'],
        rows: [
          ['`NotAuthorizedAgent()`', 'caller is not an active agent (never authorized, or revoked)'],
          ['`AgentPermissionsExpired()`', 'the expiry has passed; the owner can renew'],
          ['`AgentPaused()` / `EnforcedPause()`', 'this agent is paused / every agent is paused'],
          ['`AgentMustBeEOA()`', 'the agent address has code (for example an EIP-7702 delegation)'],
          ['`UnsupportedExecutionMode()`', '`mode` is not the batch mode'],
          ['`AgentCannotCallWallet()` / `TargetIsBlocked()`', 'an item targets the wallet itself / a contract the owner blocked'],
          ['`RecipientNotAllowed()`', 'native or token destination not in `allowedRecipients`'],
          ['`TokenNotAllowed()`', 'token not in `allowedTokens`, or an unlisted token left the wallet'],
          ['`ProtocolNotAllowed()`', 'protocol call target, or approve spender, not in `allowedProtocols`'],
          ['`TokenCallWithValue()`', 'a transfer or approve carried native value'],
          ['`SelectorNotAllowed()` / `CallNeedsValidator()`', 'no policy for this function / a policy without `DEEP`'],
          ['`PinnedArgMismatch()` / `CalldataTooShort()`', 'an anchored calldata word does not match / calldata under 4 bytes'],
          ['`PolicyValidationFailed()`', 'the validator said no, reverted, or is not active on this network'],
          ['`PostCheckFailed()`', 'a validator’s check after the batch failed (Aave health factor below 1.2)'],
          ['`ExceedsPerTxLimit()` / `DailyLimitExceeded()` / `PeriodBudgetExceeded()` / `TotalBudgetExceeded()`', 'native limits'],
          ['`TokenBatchLimitExceeded()` / `TokenDailyLimitExceeded()` / `TokenTotalBudgetExceeded()`', 'token limits'],
          ['`MeasurementFailed()` / `TooManyMeasuredTokens()`', 'a balance could not be read / more than 60 tokens to measure'],
          ['`FeeTransferFailed()`', 'the fee could not be paid exactly (for example a sender-taxed token)'],
        ],
      },
      {
        type: 'p',
        text: 'Owner-side errors (`OnlyWallet`, `InvalidAgent`, `InvalidExpiry`, `InvalidPolicy`, `ArrayLengthMismatch`, `TooManyTokens/Protocols/Recipients/Values`, `UnknownAgent`, `ZeroAmount`) only appear when authorizing or managing agents.',
      },

      { type: 'h2', text: 'Events' },
      { type: 'code', lang: 'solidity', code: CODE_EVENTS },
      { type: 'p', text: '`AgentExecution` is the one to index to follow agent activity off-chain. Its charges include the fees.' },

      { type: 'h2', text: 'Example A — Foundry script (Solidity)' },
      { type: 'p', text: 'Send ETH from the agent wallet, signed by the agent EOA. The recipient must be on the agent’s list, and the fee is added on top:' },
      { type: 'code', lang: 'solidity', code: CODE_FOUNDRY },
      { type: 'code', lang: 'bash', code: CODE_FORGE_CMD },

      { type: 'h2', text: 'Example B — TypeScript / viem' },
      { type: 'p', text: 'The same call from Node.js: an ETH send plus a USDC transfer in one batch:' },
      { type: 'code', lang: 'typescript', code: CODE_VIEM },
      {
        type: 'p',
        text: 'If the call reverts, simulate it first (`client.simulateContract` with the same arguments). viem decodes the custom error name, which maps to the error reference above.',
      },

      { type: 'h2', text: 'Older wallets (V4)' },
      {
        type: 'p',
        text: 'The entrypoint, the batch encoding and the examples are the same on V4 agent wallets. What differs:',
      },
      {
        type: 'list',
        items: [
          '`0` means unlimited and an empty `allowedRecipients` means any destination. `maxPerTxWei` applies to each item, not to the batch.',
          'Protocol calls need a policy per selector, but only the Universal Router and the Uniswap v4 PositionManager go through a validator; other policies pin the recipient to the wallet (`PinnedArgMismatch`). SwapRouter02 is available. `approve` spenders are checked against `allowedRecipients`.',
          'The wallet does not measure outflows: token budgets count transfers and approvals only, so spending through an approval the owner gave earlier is not counted. Agent approvals are not reset.',
          'Expiry is optional, there is no per-agent pause and no target blocking. The lifetime native error is `AgentBudgetExceeded`; `getAgentPermission` includes the spending counters.',
          'The 0.15% fee follows the owner’s three cases: taken from native sends, added on top of token transfers, and computed on balance increases for other calls.',
        ],
      },
      { type: 'callout', tone: 'info', text: 'New agent wallets are V5. To move an existing one, see Move to wallet V5.' },
    ],
  },

  es: {
    title: 'Guía de integración de agentes',
    intro:
      'Cómo un agente IA externo (o cualquier sistema automatizado) ejecuta transacciones a través de una BVCC Agent Wallet V5 (`BVCCAgentWalletV5`), la generación actual. Todos los permisos, límites y comprobaciones se aplican en cadena: el agente no puede superarlos, haga lo que haga su código. Las diferencias de las wallets V4, más antiguas, están al final.',
    blocks: [
      { type: 'h2', text: 'Cómo funciona' },
      {
        type: 'list',
        items: [
          'El dueño de la wallet autoriza una dirección de agente desde la app (`/wallet/agents`), firmando con su passkey. Eso llama a `authorizeAgent()` en la wallet con los límites y las policies del agente.',
          'El agente llama a `executeAsAgent()` en la wallet directamente, como una transacción EVM normal: sin UserOp ERC-4337, sin bundler y sin firma de passkey.',
          'El agente paga el gas desde su propia EOA. Los fondos que mueve salen de la wallet.',
          'La wallet mide lo que sale durante el lote y lo carga, más una comisión de agente del 0,15 %, contra los límites del agente.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'El SDK de TypeScript (`@bvcc/agent-sdk`) y el servidor MCP (`@bvcc/agent-mcp`) hacen todo esto por ti: leen la versión de la wallet, montan el lote, comprueban antes los límites y traducen los errores. Ver Conectar una IA. Esta página es para integrar a mano.',
      },
      { type: 'p', text: 'Requisitos de la cuenta del agente:' },
      {
        type: 'list',
        items: [
          'Debe ser una EOA normal, al autorizarla y en cada llamada. Una dirección con código, incluida una delegación EIP-7702 añadida después, se rechaza (`AgentMustBeEOA`).',
          'Debe estar autorizada, sin caducar, sin pausa propia, y los agentes no deben estar en pausa global.',
        ],
      },

      { type: 'h2', text: 'El punto de entrada: executeAsAgent' },
      { type: 'code', lang: 'solidity', code: CODE_SIG },
      { type: 'p', text: '`mode` debe ser el modo lote de ERC-7579; cualquier otro revierte con `UnsupportedExecutionMode`:' },
      { type: 'code', lang: 'text', code: CODE_BATCH_MODE },
      { type: 'p', text: '`executionData` es un array de structs `Execution` codificado en ABI:' },
      { type: 'code', lang: 'solidity', code: CODE_EXECUTION },
      { type: 'p', text: 'Los límites se comprueban sobre todo el lote: el valor nativo de todas las operaciones sumado, y la salida neta de cada token.' },

      { type: 'h2', text: 'Qué comprueba la wallet en cada operación' },
      {
        type: 'table',
        headers: ['Operación', 'Forma', 'Comprobaciones'],
        rows: [
          ['Envío nativo', '`value > 0`, `callData` vacío', '`target` en `allowedRecipients`'],
          ['Transferencia ERC-20', '`transfer(address,uint256)`, sin valor', 'token en `allowedTokens`, destinatario en `allowedRecipients`'],
          ['Approve ERC-20', '`approve(address,uint256)`, sin valor', 'token en `allowedTokens`, spender en `allowedProtocols`; se restaura al terminar el lote'],
          ['Llamada a protocolo', 'cualquier otra', '`target` en `allowedProtocols`, una policy con `ALLOWED` y `DEEP` para ese agente y función, las anclas del dueño y un sí del validador del contrato'],
        ],
      },
      {
        type: 'list',
        items: [
          'El agente nunca puede llamar a la propia wallet (`AgentCannotCallWallet`), ni a un contrato que el dueño haya bloqueado (`TargetIsBlocked`).',
          'Las policies las pone el dueño, en la app. Tú solo necesitas saber qué pasa.',
        ],
      },

      { type: 'h2', text: 'Llamadas a protocolos y validadores' },
      {
        type: 'p',
        text: 'Toda llamada a un protocolo la comprueba el validador registrado para ese contrato en esa red. Un validador responde sí o no y le dice a la wallet qué tokens medir. Lo que pasa:',
      },
      {
        type: 'list',
        items: [
          'Universal Router `execute`: swaps v3 exact-in / exact-out y swaps v4 entre tokens ERC-20. Todo destinatario debe ser la wallet (o el marcador de «quien llama» del router). Los hooks v4 deben ser ninguno o aprobados. Sin valor nativo: para cambiar ETH nativo, envuélvelo antes.',
          'PositionManager de Uniswap v4 `modifyLiquidities`: solo posiciones de la wallet. Añadir liquidez exige una posición sin aprobación individual. Una llamada no puede retirar y añadir liquidez a la vez; usa dos operaciones. Hooks ninguno o aprobados.',
          'Pool de Aave v3: `supply`, `withdraw`, `borrow` (tipo variable), `repay`, `setUserUseReserveAsCollateral`, `setUserEMode`, siempre con la wallet como beneficiaria. El activo debe ser un token permitido. Un préstamo se carga al presupuesto, y tras el lote el factor de salud debe ser al menos 1,2 (si no, `PostCheckFailed`).',
          'NonfungiblePositionManager de Uniswap v3: `mint` hacia la wallet; `increaseLiquidity`, `decreaseLiquidity`, `burn` y `collect` en posiciones de la propia wallet; `collect` exactamente hacia la wallet.',
          'Nativo envuelto (WETH, WBNB, WPOL): `deposit()` con valor, `withdraw(uint256)` sin él.',
        ],
      },
      {
        type: 'p',
        text: 'Un validador que no esté activo en esa red deniega la llamada (`PolicyValidationFailed`). Las retiradas de Aave y de posiciones de Uniswap se cobran al entrar en la wallet, así que también cuentan contra el presupuesto del token.',
      },

      { type: 'h2', text: 'Límites de gasto' },
      {
        type: 'p',
        text: 'Se fijan por agente en `authorizeAgent`. `0` significa nada permitido; «sin límite» es `type(uint128).max`. Todo cargo incluye la comisión del 0,15 %.',
      },
      {
        type: 'table',
        headers: ['Límite', 'Alcance', 'Error si se supera'],
        rows: [
          ['`maxPerTxWei`', 'valor nativo de todo el lote, más comisión', '`ExceedsPerTxLimit`'],
          ['`dailyLimitWei`', 'nativo por día UTC', '`DailyLimitExceeded`'],
          ['`totalBudgetWei`', 'nativo total', '`TotalBudgetExceeded`'],
          ['`periodBudgetWei` + `periodDuration`', 'nativo por periodo móvil (solo si la duración es > 0)', '`PeriodBudgetExceeded`'],
          ['`tokenMaxAmounts[i]`', 'salida + costes + comisión del token, por lote', '`TokenBatchLimitExceeded`'],
          ['`tokenDailyLimits[i]`', 'por token, por día UTC', '`TokenDailyLimitExceeded`'],
          ['`tokenTotalBudgets[i]`', 'por token, total', '`TokenTotalBudgetExceeded`'],
          ['`expiry`', 'obligatoria, como mucho a 365 días; renovable con `renewAgent`', '`AgentPermissionsExpired`'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        text: 'El historial de gasto se conserva cuando el dueño vuelve a autorizar un agente, así que cambiar los límites no reinicia lo ya gastado.',
      },

      { type: 'h2', text: 'Comisiones y medición' },
      {
        type: 'list',
        items: [
          'La comisión de agente del 0,15 % se cobra sobre lo que sale de la wallet, en el mismo activo y encima del importe. Una transferencia de 100 USDC le cuesta a la wallet 100,15 USDC y cuenta 100,15 contra los límites.',
          'Para mover un saldo entero, deja sitio para la comisión: envía como mucho `saldo / 1,0015`. Si no, el lote revierte.',
          'Lo que entra en la wallet por un swap no paga. Las retiradas de Aave o de una posición de liquidez se cobran como entradas.',
          'Se mide todo token de la lista del agente, todo token encontrado en los datos y todo token que declare un validador, hasta 60. Un saldo que no se puede leer revierte el lote (`MeasurementFailed`).',
          'Los tokens que cobran un impuesto al emisor no los pueden mover los agentes: pagar la comisión costaría más que la comisión.',
          'Las aprobaciones que hace el agente vuelven a su valor anterior al terminar el lote. Las allowances de Permit2 para el Universal Router y el PositionManager las da el dueño, no el agente.',
        ],
      },

      { type: 'h2', text: 'Leer el estado del agente' },
      { type: 'code', lang: 'solidity', code: CODE_GETTERS },
      { type: 'p', text: 'Un agente bien hecho los lee antes de enviar y ajusta su lote a lo que le queda, comisión incluida.' },

      { type: 'h2', text: 'Referencia de errores' },
      {
        type: 'table',
        headers: ['Error', 'Causa'],
        rows: [
          ['`NotAuthorizedAgent()`', 'quien llama no es un agente activo (nunca autorizado, o revocado)'],
          ['`AgentPermissionsExpired()`', 'pasó la caducidad; el dueño puede renovar'],
          ['`AgentPaused()` / `EnforcedPause()`', 'este agente está en pausa / todos los agentes están en pausa'],
          ['`AgentMustBeEOA()`', 'la dirección del agente tiene código (por ejemplo, una delegación EIP-7702)'],
          ['`UnsupportedExecutionMode()`', '`mode` no es el modo lote'],
          ['`AgentCannotCallWallet()` / `TargetIsBlocked()`', 'una operación apunta a la propia wallet / a un contrato bloqueado por el dueño'],
          ['`RecipientNotAllowed()`', 'destino nativo o de token fuera de `allowedRecipients`'],
          ['`TokenNotAllowed()`', 'token fuera de `allowedTokens`, o salió de la wallet un token no permitido'],
          ['`ProtocolNotAllowed()`', 'destino de una llamada a protocolo, o spender de un approve, fuera de `allowedProtocols`'],
          ['`TokenCallWithValue()`', 'un transfer o approve llevaba valor nativo'],
          ['`SelectorNotAllowed()` / `CallNeedsValidator()`', 'no hay policy para esa función / la policy no tiene `DEEP`'],
          ['`PinnedArgMismatch()` / `CalldataTooShort()`', 'una palabra anclada de los datos no coincide / datos de menos de 4 bytes'],
          ['`PolicyValidationFailed()`', 'el validador dijo que no, revirtió o no está activo en esta red'],
          ['`PostCheckFailed()`', 'falló la comprobación posterior de un validador (salud de Aave por debajo de 1,2)'],
          ['`ExceedsPerTxLimit()` / `DailyLimitExceeded()` / `PeriodBudgetExceeded()` / `TotalBudgetExceeded()`', 'límites nativos'],
          ['`TokenBatchLimitExceeded()` / `TokenDailyLimitExceeded()` / `TokenTotalBudgetExceeded()`', 'límites de token'],
          ['`MeasurementFailed()` / `TooManyMeasuredTokens()`', 'no se pudo leer un saldo / más de 60 tokens que medir'],
          ['`FeeTransferFailed()`', 'la comisión no se pudo pagar exacta (por ejemplo, un token con impuesto al emisor)'],
        ],
      },
      {
        type: 'p',
        text: 'Los errores del lado del dueño (`OnlyWallet`, `InvalidAgent`, `InvalidExpiry`, `InvalidPolicy`, `ArrayLengthMismatch`, `TooManyTokens/Protocols/Recipients/Values`, `UnknownAgent`, `ZeroAmount`) solo aparecen al autorizar o gestionar agentes.',
      },

      { type: 'h2', text: 'Eventos' },
      { type: 'code', lang: 'solidity', code: CODE_EVENTS },
      { type: 'p', text: '`AgentExecution` es el que hay que indexar para seguir la actividad del agente fuera de la cadena. Sus cargos incluyen las comisiones.' },

      { type: 'h2', text: 'Ejemplo A — Script de Foundry (Solidity)' },
      { type: 'p', text: 'Enviar ETH desde la wallet de agente, firmado por la EOA del agente. El destinatario debe estar en la lista del agente, y la comisión se suma encima:' },
      { type: 'code', lang: 'solidity', code: CODE_FOUNDRY },
      { type: 'code', lang: 'bash', code: CODE_FORGE_CMD },

      { type: 'h2', text: 'Ejemplo B — TypeScript / viem' },
      { type: 'p', text: 'La misma llamada desde Node.js: un envío de ETH más una transferencia de USDC en un lote:' },
      { type: 'code', lang: 'typescript', code: CODE_VIEM },
      {
        type: 'p',
        text: 'Si la llamada revierte, simúlala antes (`client.simulateContract` con los mismos argumentos). viem decodifica el nombre del error, que corresponde a la referencia de errores de arriba.',
      },

      { type: 'h2', text: 'Wallets antiguas (V4)' },
      {
        type: 'p',
        text: 'El punto de entrada, la codificación del lote y los ejemplos son iguales en las wallets de agente V4. Lo que cambia:',
      },
      {
        type: 'list',
        items: [
          '`0` significa ilimitado y un `allowedRecipients` vacío significa cualquier destino. `maxPerTxWei` se aplica a cada operación, no al lote.',
          'Las llamadas a protocolos necesitan una policy por función, pero solo el Universal Router y el PositionManager de Uniswap v4 pasan por un validador; las demás policies anclan el destinatario a la wallet (`PinnedArgMismatch`). SwapRouter02 está disponible. Los spender de `approve` se comprueban contra `allowedRecipients`.',
          'La wallet no mide las salidas: los presupuestos de token solo cuentan transferencias y aprobaciones, así que gastar con una aprobación que dio antes el dueño no cuenta. Las aprobaciones del agente no se restauran.',
          'La caducidad es opcional, no hay pausa por agente ni bloqueo de contratos. El error del presupuesto nativo total es `AgentBudgetExceeded`; `getAgentPermission` incluye los contadores de gasto.',
          'La comisión del 0,15 % sigue los tres casos del dueño: sale del valor en envíos nativos, se suma encima en transferencias de tokens y se calcula sobre las subidas de saldo en las demás llamadas.',
        ],
      },
      { type: 'callout', tone: 'info', text: 'Las wallets de agente nuevas son V5. Para mover una existente, ver Pasar a la wallet V5.' },
    ],
  },
}
