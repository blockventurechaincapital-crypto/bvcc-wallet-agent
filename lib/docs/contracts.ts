// Mirrored from docs/contracts.md (monorepo, English canonical) — keep in sync
// V5 is the current generation and comes first; V4 stays below as the previous generation.
import type { LocalizedDoc } from '@/components/DocsPage'

const V5_ADDR_ROWS = [
  ['`BVCCWalletFactoryV5` (personal wallets)', '`0x2672951DC1E3f865BA6Fc98e5509dc4B23B260a2`'],
  ['`BVCCWalletFactoryV5` (agent wallets)', '`0xE36fb66c21C38536454C1a58fBC5EB1Cb455aD52`'],
  ['`BVCCSmartWalletV5` (logic)', '`0xc9dE89d54beB786bc916131CA6c8c5374507Bd15`'],
  ['`BVCCAgentWalletV5` (logic)', '`0x360f991B23a3D5202Dc422292697aB07dA279cFA`'],
  ['`BVCCAgentLogicV5` (library)', '`0x7504bf3c1230eF99eaEFAc03287c8F036CBb6D0E`'],
  ['`BVCCValidatorRegistryV5`', '`0x7269334AE74DCE4e607eec36268383DD35f28350`'],
  ['`BVCCHookRegistryV5`', '`0xEaEaC7F6071f7F576Be2aD97898Dd0c0F51BE78A`'],
  ['EntryPoint (v0.9)', '`0x433709009B8330FDa32311DF1C2AFA402eD8D009`'],
]

// [network, Universal Router, Uniswap v4 PositionManager, Aave v3 Pool, Uniswap v3 positions, wrapped native]
const V5_VALIDATORS = [
  ['Ethereum', '0x48A6d5415C369Fa38E0ebEafC779527fb6cF32A0', '0xb05fc3aaD6E4cAaD69b680C1adae645DB0B56f1f', '0xeD51c5063dB3bB4609Cf95fC349d87b68bEECC28', '0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678', '0xDC2480bD3DfDC5A4c92ab1C37f2234FF5f91521F'],
  ['Arbitrum One', '0x332E88FDc5f26a7421534902Cbb9C95B70E8AA0d', '0xc9Ae38709cd76b51F4f11a21Ee2aAC1cf67a013D', '0xC7bD86E147b211DDC1c6bbCad07A01B51C7CAff4', '0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678', '0x80DBf05b4406927c22cDFaFb3f226665F863A58D'],
  ['Base', '0x5b9cDCC1a4Ac139E8b13A4FC4ca4519906F651A5', '0x0E43866CFFC41E814C1f4e0341Fed09234d1d8B1', '0x30Bd59CF41c2F4FE02e9666065dd294FD44333bb', '0x2B52943E9F361CCA42f1100a78b74daaEB25F02e', '0xEF913B99C970E4Bc3B987F0668d0F20CD8B90c6E'],
  ['BNB Chain', '0x656f0EB67ce76c3b416D8F3dFB46e81c7aA442D7', '0x12298d84D1d3272a51a7b21755D222da26996786', '0x822E3ab17d7AC4E49cA18E881392CED15ba1E7bb', '0x5C700655e00FA7003672617d8723d5AeBF9E9c9A', '0x4F2974859169262158065a1506070ee52EFeD6De'],
  ['Polygon', '0xDd313C3884a6fA1636fc5cba3E251874073e1B3f', '0xd5315B0B30Fa25C5EcbFAA2BBD514262E33Db911', '0xC7bD86E147b211DDC1c6bbCad07A01B51C7CAff4', '0xfcf4AB3E1FC5b32A00161e66ebe537B617fC9678', '0xc4E512BEEbBCb03A79C10c109B4CD6cef8aa5E5e'],
  ['Arbitrum Sepolia', '0x1D0394e997a0799883AE433383Bc82280E17E403', '0x6Cd6e2D7328b0128Ab82921939526dde6f45F2d3', '0xA61ac81B9fAA48eE33Ac8A1f28ad80C577e276FA', '0xbaBA421723a25363BB25468B94A1100B3972DB84', '0x0A9F4027e3A2136d4e688D0Ee0A5b42cE94b3702'],
]
const validatorRows = (kinds: string[]) =>
  V5_VALIDATORS.flatMap(([net, ...addrs]) => addrs.map((a, i) => [net, kinds[i], '`' + a + '`']))
const KINDS_EN = ['Universal Router', 'Uniswap v4 PositionManager', 'Aave v3 Pool', 'Uniswap v3 positions', 'Wrapped native']
const KINDS_ES = ['Universal Router', 'PositionManager de Uniswap v4', 'Pool de Aave v3', 'Posiciones de Uniswap v3', 'Nativo envuelto']

const V5_OWNER_WALLET = `function execute(bytes32 mode, bytes calldata executionData) external payable; // ERC-7821 batch, via UserOp
function credentialId() external view returns (bytes memory);
function setCredentialId(bytes calldata newCredentialId) external;            // self-call only (passkey)
function setGuardians(address[3] calldata newGuardians) external;             // self-call; reverts while a recovery is armed
function cancelRecovery() external;                                           // self-call; clears votes and the armed proposal`

const V5_GUARDIAN = `function voteRecovery(bytes32 newX, bytes32 newY, bytes calldata newCredentialId) external; // one vote per guardian
function withdrawRecoveryVote() external;
function executeRecovery() external;            // after the 48 h wait; sets key + credential, pauses every agent
function guardians() external view returns (address[3] memory);
function recoveryVotes() external view returns (bytes32[3] memory);
function armedRecovery() external view returns (bytes32 proposalId, uint256 readyAt);`

const V5_OWNER_AGENT = `function authorizeAgent(AuthorizeParams calldata p) external;   // re-authorizing keeps spending history
function revokeAgent(address agent) external;
function renewAgent(address agent, uint64 newExpiry) external;  // at most 365 days ahead
function increaseBudget(address agent, uint128 additionalWei) external;
function pauseAgent(address agent) external;                    // one agent
function unpauseAgent(address agent) external;
function pauseAgents() external;                                // every agent; does nothing if already paused
function unpauseAgents() external;
function setAgentCallPolicy(address agent, address target, bytes4 selector, uint256 policy) external;
function setAgentValueSet(address agent, address target, bytes4 selector, bytes32[] calldata values) external;
function setTargetBlocked(address target, bool blocked) external; // block a contract for every agent`

const V5_AGENT_FN = 'function executeAsAgent(bytes32 mode, bytes calldata executionData) external; // batch mode only, nonReentrant'

const V5_GETTERS = `function getAgentPermission(address agent) external view returns (AgentPermission memory);
function getAgentSpending(address agent) external view returns (AgentSpending memory);
function getAgents() external view returns (address[] memory);
function getDailySpent(address agent) external view returns (uint128);
function getTokenSpent(address agent, address token) external view returns (uint128 daily, uint128 total);
function getAgentCallPolicy(address agent, address target, bytes4 selector) external view returns (uint256);
function getAgentValueSet(address agent, address target, bytes4 selector) external view returns (bytes32[] memory);
function isTargetBlocked(address target) external view returns (bool);
function walletType() public pure returns (uint8); // 0 = personal, 1 = agent`

const V5_FACTORY = `function getWalletAddress(bytes32 pubKeyX, bytes32 pubKeyY) public view returns (address);
function createWallet(bytes32 pubKeyX, bytes32 pubKeyY, bytes calldata credentialId, bytes calldata credentialSig)
    external returns (address wallet); // credentialSig: passkey signature over the wallet address + credential
function isDeployed(address wallet) external view returns (bool);
function kill() external; // owner-only, one-way: stops NEW wallets; existing wallets keep working`

const V4_ADDR_ROWS = [
  ['`BVCCSmartWalletFactoryV4`', '`0xfd105197109244483b5f870501326E6faec9F93c`'],
  ['`BVCCAgentWalletFactoryV4`', '`0xf3A61F9d64d45362E149A111289546523BCd26a6`'],
  ['`BVCCValidatorRegistry`', '`0x5e371D54AC97a57B0a99145Ed04A3c9fA07850C2`'],
  ['`BVCCHookRegistry`', '`0x551C6e7ABdA04a110790888e711198f25621b066`'],
]

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


export const contracts: LocalizedDoc = {
  en: {
    title: 'Contract Reference',
    intro:
      'V5 is the current generation; its Solidity sources are in `contracts-v5/` in the monorepo. V4, the previous generation, is in `contracts/` and is described at the end of this page. Both are built with Foundry and OpenZeppelin on a frozen toolchain (solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true`), so the CREATE2 addresses stay deterministic. V5 also builds without a metadata hash, so the build reproduces the deployed bytecode byte for byte.',
    blocks: [
      { type: 'h2', text: 'Deployed addresses (V5)' },
      { type: 'p', text: 'Same CREATE2 address on Ethereum, Arbitrum One, Base, BNB Chain, Polygon and Arbitrum Sepolia. Every contract is source-verified on the block explorers.' },
      { type: 'table', headers: ['Contract', 'Address'], rows: V5_ADDR_ROWS },
      { type: 'p', text: 'Validators are bound to one protocol contract each, so most addresses differ per network. All 30 are active in the V5 registry:' },
      { type: 'table', headers: ['Network', 'Validator for', 'Address'], rows: validatorRows(KINDS_EN) },
      { type: 'p', text: 'Fees go to `0x3e3eb089169a7315a994947465ce5f5FC3A307D4`, a constant in the logic contracts.' },

      { type: 'h2', text: 'How V5 is built' },
      {
        type: 'list',
        items: [
          'Each wallet is a small ERC-1167 clone of a logic contract (`BVCCSmartWalletV5` or `BVCCAgentWalletV5`). Clones cannot be upgraded, and the logic contracts have their initializers disabled. Creating a wallet costs about 537,000 gas, against about 4.7 million for V4.',
          'One factory contract, `BVCCWalletFactoryV5`, is deployed twice: once for personal wallets and once for agent wallets.',
          'The agent permission code lives in the external library `BVCCAgentLogicV5`, reached by `DELEGATECALL`. It has no storage of its own.',
          'The validator registry address is a constant inside every wallet, so nobody can point a wallet at a different registry.',
          'A wallet cannot move to a newer generation in place. Owners of older wallets create a V5 wallet with the same passkey and move their funds (see Move to wallet V5).',
        ],
      },

      { type: 'h2', text: 'BVCCSmartWalletV5 — personal wallet (walletType 0)' },
      {
        type: 'list',
        items: [
          'Signer: the passkey’s P-256 public key (WebAuthn), checked through ERC-4337 UserOperation validation on EntryPoint v0.9.',
          'Creation needs the passkey. `createWallet` verifies a passkey signature over the wallet address and the credential, so nobody can deploy your wallet or choose its guardians for you. The signature has no chain id on purpose, so the same wallet can be deployed on every network.',
          'Signatures expire. Each UserOperation signature is `abi.encode(uint48 validUntil, webauthnSig)` and the passkey signs `keccak256(abi.encode(userOpHash, validUntil))`. `validUntil` cannot be 0; the app uses about 15 minutes.',
          'The credential id is stored in the wallet (`credentialId()`). It changes only at creation, through `setCredentialId` (passkey) or through a recovery.',
          'Execution: ERC-7821 batches (`execute(bytes32 mode, bytes executionData)`). Fee 0.05% to the fee wallet, in three cases: (1) native send: fee taken from the value; (2) ERC-20 `transfer`: fee on top, the recipient gets the exact amount; (3) any other call: fee on the balance increases the wallet detects. Token calls use SafeERC20 semantics, and balance reads copy at most 32 bytes of return data with a gas cap. If the fee cannot be paid, the operation reverts.',
          'ERC-1271 signatures (`isValidSignature`) accept only the owner’s passkey, through ERC-7739. An agent never signs for the wallet.',
        ],
      },
      { type: 'h3', text: 'Owner functions' },
      { type: 'code', lang: 'solidity', code: V5_OWNER_WALLET },
      { type: 'h3', text: 'Guardian recovery' },
      {
        type: 'p',
        text: 'Three guardians, two must agree. Each guardian votes for one concrete proposal (new public key and credential) and controls only its own vote. Two matching votes arm the proposal and start a 48-hour wait; a third guardian cannot reset or remove the other votes, and the proposal stays armed while it holds two votes. The owner can cancel at any time with the passkey. After the wait, `executeRecovery` sets the new key and credential and, on an agent wallet, pauses every agent.',
      },
      { type: 'code', lang: 'solidity', code: V5_GUARDIAN },

      { type: 'h2', text: 'BVCCAgentWalletV5 — AI agent wallet (walletType 1)' },
      {
        type: 'p',
        text: 'Extends `BVCCSmartWalletV5` with agents: plain EOAs the owner authorizes with their own limits. The owner pays 0.15% on this wallet type. Every setting is per agent.',
      },
      { type: 'h3', text: 'AuthorizeParams (input to authorizeAgent)' },
      {
        type: 'table',
        headers: ['Field', 'Type', 'Meaning (`0` or empty = nothing allowed)'],
        rows: [
          ['`agent`', '`address`', 'agent EOA; must have no code when authorized and at every call (an EIP-7702 delegation stops it)'],
          ['`maxPerTxWei`', '`uint128`', 'max native value of the whole batch'],
          ['`dailyLimitWei`', '`uint128`', 'max native per UTC day'],
          ['`totalBudgetWei`', '`uint128`', 'lifetime native budget'],
          ['`periodBudgetWei`', '`uint128`', 'max native per rolling period (only if `periodDuration > 0`)'],
          ['`periodDuration`', '`uint64`', 'period length in seconds'],
          ['`expiry`', '`uint64`', 'required: later than now and at most 365 days ahead'],
          ['`allowedTokens`', '`address[]`', 'up to 50 ERC-20s the agent may use'],
          ['`tokenMaxAmounts`', '`uint128[]`', 'parallel: token cap per batch'],
          ['`tokenDailyLimits`', '`uint128[]`', 'parallel: token cap per UTC day'],
          ['`tokenTotalBudgets`', '`uint128[]`', 'parallel: lifetime token budget'],
          ['`allowedProtocols`', '`address[]`', 'up to 20 protocol contracts; also the only valid `approve` spenders'],
          ['`allowedRecipients`', '`address[]`', 'up to 20 destinations for native sends and token transfers; empty = nobody'],
        ],
      },
      { type: 'p', text: '"Unlimited" exists only as the explicit maximum (`type(uint128).max`). Every limit already includes the 0.15% agent fee.' },
      { type: 'h3', text: 'Owner functions (self-calls, signed with the passkey)' },
      { type: 'code', lang: 'solidity', code: V5_OWNER_AGENT },
      { type: 'h3', text: 'Agent function' },
      { type: 'code', lang: 'solidity', code: V5_AGENT_FN },
      { type: 'h3', text: 'What happens in an agent batch' },
      {
        type: 'list',
        items: [
          'Agent check: a plain EOA right now, active, not expired, not paused on its own and no global pause.',
          'Per item, before anything runs: the target is not the wallet and not blocked. A native send goes to an allowed recipient. A `transfer` is an allowed token to an allowed recipient. An `approve` is an allowed token to an allowed protocol. Any other call needs an allowed protocol, a policy for that agent and function with the `DEEP` bit, the anchors the owner set, and a yes from that protocol’s validator.',
          'Measure: read the balance of every allowed token, every token found in the calldata and every token a validator declares (up to 60). A failed read reverts.',
          'Execute the batch. Where a validator asks for it (Aave `withdraw`, Uniswap position calls), what comes into the wallet during that call is counted as a cost too.',
          'Every approval the agent made goes back to its previous value. The agent never leaves an allowance behind.',
          'Measure again. A token that is not allowed and went down reverts the batch. For an allowed token, outflow + costs + 0.15% fee is checked against the per-batch, daily and total limits, and the fee is paid in that token.',
          'Post-checks: validators that asked for one decide again. For Aave, the health factor must stay at or above 1.2.',
        ],
      },
      { type: 'h3', text: 'Call policies' },
      {
        type: 'p',
        text: 'A policy is a `uint256` per agent, contract and function, set by the owner with `setAgentCallPolicy`. Bit 255 allows the function and bit 254 (`DEEP`) sends it to the validator; in V5 every protocol call needs both, or it reverts with `SelectorNotAllowed` or `CallNeedsValidator`. Optional anchors add checks on fixed calldata words: W (must be the wallet), P (an allowed protocol), T (an allowed token), R (an allowed recipient) and S (one of a value set kept with `setAgentValueSet`, up to 20 values). Reserved bits must be 0.',
      },
      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: V5_GETTERS },
      { type: 'h3', text: 'Errors an agent can hit' },
      {
        type: 'table',
        headers: ['Error', 'Meaning'],
        rows: [
          ['`NotAuthorizedAgent`, `AgentPermissionsExpired`, `AgentPaused`, `EnforcedPause`', 'not authorized, expired, paused on its own, or every agent paused'],
          ['`AgentMustBeEOA`', 'the agent address has code (for example an EIP-7702 delegation)'],
          ['`AgentCannotCallWallet`, `TargetIsBlocked`', 'target is the wallet itself, or blocked by the owner'],
          ['`RecipientNotAllowed`, `TokenNotAllowed`, `ProtocolNotAllowed`', 'destination, token or protocol not on the agent’s lists'],
          ['`SelectorNotAllowed`, `CallNeedsValidator`, `PinnedArgMismatch`, `PolicyValidationFailed`', 'no policy, policy without `DEEP`, an anchor failed, or the validator said no'],
          ['`ExceedsPerTxLimit`, `DailyLimitExceeded`, `TotalBudgetExceeded`, `PeriodBudgetExceeded`', 'a native limit, fee included'],
          ['`TokenBatchLimitExceeded`, `TokenDailyLimitExceeded`, `TokenTotalBudgetExceeded`', 'a token limit, fee included'],
          ['`MeasurementFailed`, `TooManyMeasuredTokens`', 'a balance could not be read, or more than 60 tokens to measure'],
          ['`PostCheckFailed`', 'a validator’s post-check failed (for example Aave health below 1.2)'],
          ['`FeeTransferFailed`, `TokenCallWithValue`', 'the fee could not be paid exactly, or a token call carried native value'],
        ],
      },

      { type: 'h2', text: 'Factory — BVCCWalletFactoryV5' },
      { type: 'code', lang: 'solidity', code: V5_FACTORY },
      {
        type: 'list',
        items: [
          'Deterministic address: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))`. The same passkey gives the same address on every network, and you can receive funds there before deploying.',
          'Idempotent: `createWallet` returns the existing wallet if it is already deployed.',
          'The V5 address differs from your V4 address for the same passkey, because the factory and the code differ.',
        ],
      },

      { type: 'h2', text: 'Registries & validators (V5)' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistryV5` maps each protocol contract to its validator. Allowing or replacing a validator takes a proposal and 48 hours, visible on-chain; cancelling a proposal or freezing a validator is immediate. Ownership moves only in two steps.',
          'Validators are stateless `view` contracts called with `staticcall`. They return yes or no, the tokens to measure, the costs (such as an Aave loan), whether they want a post-check, and whether inflows are charged. A revert means no. Only immutable validators are registered.',
          'Universal Router: token-to-token swaps (v3 and v4). Exact command bytes; every recipient is the wallet; every v4 hop decoded, with each hook none or approved; native value refused.',
          'Uniswap v4 PositionManager: positions owned by the wallet only; adding needs no individual approval on the position; no removing and adding in the same call; hooks none or approved on every action; inflows charged.',
          'Aave v3 Pool: supply, withdraw, borrow (variable), repay, collateral and eMode settings, all for the wallet itself. A loan is charged as a cost against the budget, withdrawals are charged as inflows, and the health factor must stay at or above 1.2.',
          'Uniswap v3 positions: mint to the wallet; add, remove, burn and collect only on the wallet’s own positions; collect only to the wallet.',
          'Wrapped native (WETH, WBNB, WPOL): only `deposit()` and `withdraw(amount)`.',
          '`BVCCHookRegistryV5`: Uniswap v4 hooks approved for agents, with the same 48-hour delay and immediate freeze. An approved hook runs its own code, so approving one is a trust decision.',
        ],
      },

      { type: 'h2', text: 'Security notes' },
      {
        type: 'list',
        items: [
          'Internal security review, bilingual report in the monorepo’s `audits/` folder and linked from these docs. It covers every generation. Thirty findings with identifiers: `BVCC-01` … `BVCC-13` from the review of V4 and earlier, and `BVCC-14` … `BVCC-30` from five V5 review rounds and a red-team exercise, run by the team with AI analysis tools.',
          'Nothing is open in V5: twenty-six findings are closed in code and four are documented trust assumptions (immutable validators, approved hooks, allowed tokens, and validators declaring every token they move). Every V5 finding was handled before deployment.',
          'V5 closes `BVCC-03`, the risk V4 left open, by measuring what each agent batch takes out of the wallet, whatever allowances already exist.',
          'The V5 suite is 191 Foundry tests (145 local, 46 on network forks), including invariants with 128,000 random actions.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'No external audit yet. This is experimental beta software.' },

      { type: 'h2', text: 'Previous generation: V4' },
      {
        type: 'callout',
        tone: 'info',
        text: 'V4 wallets keep working, but new wallets are V5 and V4 keeps `BVCC-03` open. To move, see Move to wallet V5.',
      },
      { type: 'table', headers: ['Contract', 'Address'], rows: V4_ADDR_ROWS },
      {
        type: 'p',
        text: 'Live on Arbitrum One, Base, BNB Chain, Ethereum, Polygon and Arbitrum Sepolia (testnet). The per-chain validators (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`) are bound to each chain’s router / position manager, so their addresses differ per network — see the monorepo’s `contracts/deployments/`. Previous V2 factories (`0x230b…BdEf1` / `0x8D9e…054c`) are deprecated.',
      },
      { type: 'h3', text: 'BVCCSmartWalletV4 — personal wallet (walletType 0)' },
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

      { type: 'h3', text: 'BVCCAgentWalletV4 — AI agent wallet (walletType 1)' },
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

      { type: 'h3', text: 'Factories' },
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

      { type: 'h3', text: 'Registries & validators' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistry` — fixed dispatch point, compiled as a constant inside the wallet so a forged validator can’t be injected. Maps a protocol target to its validator.',
          '`BVCCUniversalRouterValidator` / `BVCCPositionManagerValidator` — per-chain, each bound to that chain’s router / position manager; addresses differ per network (see `contracts/deployments/`).',
          '`BVCCHookRegistry` — allowlist of approved Uniswap v4 hooks, gated by the same 48h governance.',
          '`IBVCCValidator` — the shared `validate(...)` view interface. It is an interface, not a deployed contract; the concrete validators implement it and are staticcalled fail-closed.',
        ],
      },

      { type: 'h3', text: 'Security notes' },
      {
        type: 'list',
        items: [
          'Internal security review, bilingual report in the monorepo’s `audits/` folder and linked from these docs. For V4: four review rounds, thirteen findings with identifiers (`BVCC-01` … `BVCC-13`): 2 critical, 3 high, 5 medium, 1 low, 2 informational. Nine are remediated and live on all six networks — including a cross-function reentrancy that let a compromised agent bypass every limit, and guardian squatting through the factory. Four stay open or accepted by decision, each documented with its mitigation; the one that should change your behaviour is `BVCC-03`. The V4 suite is 312 Foundry tests (unit, fork & fuzz). No independent party has audited this code.',
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
      'La V5 es la generación actual; su código Solidity está en `contracts-v5/` del monorepo. La V4, la generación anterior, está en `contracts/` y se describe al final de esta página. Las dos se compilan con Foundry y OpenZeppelin con un toolchain congelado (solc 0.8.36, `optimizer_runs = 50`, `evm_version = cancun`, `via_ir = true`), para que las direcciones CREATE2 sean deterministas. La V5 además compila sin hash de metadatos, así que la build reproduce byte a byte el bytecode desplegado.',
    blocks: [
      { type: 'h2', text: 'Direcciones desplegadas (V5)' },
      { type: 'p', text: 'Misma dirección CREATE2 en Ethereum, Arbitrum One, Base, BNB Chain, Polygon y Arbitrum Sepolia. Todos los contratos tienen el código verificado en los exploradores.' },
      { type: 'table', headers: ['Contrato', 'Dirección'], rows: V5_ADDR_ROWS },
      { type: 'p', text: 'Cada validador va ligado a un contrato de protocolo, así que la mayoría de direcciones cambian por red. Los 30 están activos en el registro de V5:' },
      { type: 'table', headers: ['Red', 'Validador de', 'Dirección'], rows: validatorRows(KINDS_ES) },
      { type: 'p', text: 'Las comisiones van a `0x3e3eb089169a7315a994947465ce5f5FC3A307D4`, una constante de los contratos de lógica.' },

      { type: 'h2', text: 'Cómo está hecha la V5' },
      {
        type: 'list',
        items: [
          'Cada wallet es un clon ERC-1167 pequeño de un contrato de lógica (`BVCCSmartWalletV5` o `BVCCAgentWalletV5`). Los clones no se pueden actualizar y los contratos de lógica tienen los inicializadores desactivados. Crear una wallet cuesta unas 537.000 unidades de gas, frente a unos 4,7 millones en V4.',
          'Un solo contrato de factory, `BVCCWalletFactoryV5`, desplegado dos veces: una para wallets personales y otra para wallets de agentes.',
          'El código de permisos de los agentes vive en la librería externa `BVCCAgentLogicV5`, a la que se llega por `DELEGATECALL`. No tiene almacenamiento propio.',
          'La dirección del registro de validadores es una constante dentro de cada wallet, así que nadie puede apuntar una wallet a otro registro.',
          'Una wallet no puede pasar por dentro a una generación más nueva. Quien tenga una wallet antigua crea una V5 con la misma passkey y pasa sus fondos (ver Pasar a la wallet V5).',
        ],
      },

      { type: 'h2', text: 'BVCCSmartWalletV5 — wallet personal (walletType 0)' },
      {
        type: 'list',
        items: [
          'Firmante: la clave pública P-256 de la passkey (WebAuthn), comprobada en la validación de UserOperations ERC-4337 del EntryPoint v0.9.',
          'Crear la wallet exige la passkey. `createWallet` verifica una firma de la passkey sobre la dirección de la wallet y la credencial, así que nadie puede desplegar tu wallet ni elegir sus guardianes por ti. La firma no lleva chain id a propósito, para que la misma wallet se pueda desplegar en todas las redes.',
          'Las firmas caducan. Cada firma de UserOperation es `abi.encode(uint48 validUntil, webauthnSig)` y la passkey firma `keccak256(abi.encode(userOpHash, validUntil))`. `validUntil` no puede ser 0; la app usa unos 15 minutos.',
          'El id de la credencial se guarda en la wallet (`credentialId()`). Solo cambia al crearla, con `setCredentialId` (passkey) o con una recuperación.',
          'Ejecución: lotes ERC-7821 (`execute(bytes32 mode, bytes executionData)`). Comisión del 0,05 % al monedero de comisiones, en tres casos: (1) envío nativo: la comisión sale del valor; (2) `transfer` ERC-20: comisión aparte, el destinatario recibe el importe exacto; (3) cualquier otra llamada: comisión sobre las subidas de saldo que detecta la wallet. Las llamadas a tokens usan semántica SafeERC20, y las lecturas de saldo copian como mucho 32 bytes de respuesta con tope de gas. Si la comisión no se puede pagar, la operación revierte.',
          'Las firmas ERC-1271 (`isValidSignature`) solo aceptan la passkey del dueño, mediante ERC-7739. Un agente nunca firma por la wallet.',
        ],
      },
      { type: 'h3', text: 'Funciones del dueño' },
      { type: 'code', lang: 'solidity', code: V5_OWNER_WALLET },
      { type: 'h3', text: 'Recuperación con guardianes' },
      {
        type: 'p',
        text: 'Tres guardianes, y dos tienen que estar de acuerdo. Cada guardián vota una propuesta concreta (clave pública y credencial nuevas) y solo controla su propio voto. Dos votos iguales arman la propuesta y empiezan una espera de 48 horas; un tercer guardián no puede reiniciar ni borrar los otros votos, y la propuesta sigue armada mientras tenga dos votos. El dueño puede cancelar siempre con su passkey. Pasada la espera, `executeRecovery` pone la clave y la credencial nuevas y, en una wallet de agentes, pausa a todos los agentes.',
      },
      { type: 'code', lang: 'solidity', code: V5_GUARDIAN },

      { type: 'h2', text: 'BVCCAgentWalletV5 — wallet de agente IA (walletType 1)' },
      {
        type: 'p',
        text: 'Amplía `BVCCSmartWalletV5` con agentes: EOAs normales que el dueño autoriza con sus propios límites. En este tipo de wallet el dueño paga el 0,15 %. Todos los ajustes son por agente.',
      },
      { type: 'h3', text: 'AuthorizeParams (entrada de authorizeAgent)' },
      {
        type: 'table',
        headers: ['Campo', 'Tipo', 'Significado (`0` o vacío = nada permitido)'],
        rows: [
          ['`agent`', '`address`', 'EOA del agente; no puede tener código al autorizarla ni en cada llamada (una delegación EIP-7702 la detiene)'],
          ['`maxPerTxWei`', '`uint128`', 'valor nativo máximo de todo el lote'],
          ['`dailyLimitWei`', '`uint128`', 'nativo máximo por día UTC'],
          ['`totalBudgetWei`', '`uint128`', 'presupuesto nativo total'],
          ['`periodBudgetWei`', '`uint128`', 'nativo máximo por periodo móvil (solo si `periodDuration > 0`)'],
          ['`periodDuration`', '`uint64`', 'duración del periodo en segundos'],
          ['`expiry`', '`uint64`', 'obligatoria: posterior a ahora y como mucho a 365 días'],
          ['`allowedTokens`', '`address[]`', 'hasta 50 ERC-20 que puede usar el agente'],
          ['`tokenMaxAmounts`', '`uint128[]`', 'en paralelo: tope por lote de cada token'],
          ['`tokenDailyLimits`', '`uint128[]`', 'en paralelo: tope por día UTC de cada token'],
          ['`tokenTotalBudgets`', '`uint128[]`', 'en paralelo: presupuesto total de cada token'],
          ['`allowedProtocols`', '`address[]`', 'hasta 20 contratos de protocolo; también los únicos `spender` válidos de un `approve`'],
          ['`allowedRecipients`', '`address[]`', 'hasta 20 destinos para envíos nativos y transferencias de tokens; vacío = nadie'],
        ],
      },
      { type: 'p', text: '«Sin límite» solo existe como el máximo explícito (`type(uint128).max`). Todos los límites incluyen ya la comisión de agente del 0,15 %.' },
      { type: 'h3', text: 'Funciones del dueño (autollamadas firmadas con la passkey)' },
      { type: 'code', lang: 'solidity', code: V5_OWNER_AGENT },
      { type: 'h3', text: 'Función del agente' },
      { type: 'code', lang: 'solidity', code: V5_AGENT_FN },
      { type: 'h3', text: 'Qué pasa en un lote de agente' },
      {
        type: 'list',
        items: [
          'Comprobación del agente: una EOA normal en este momento, activa, sin caducar, sin pausa propia y sin pausa global.',
          'Por operación, antes de ejecutar nada: el destino no es la wallet ni está bloqueado. Un envío nativo va a un destinatario permitido. Un `transfer` es de un token permitido a un destinatario permitido. Un `approve` es de un token permitido a un protocolo permitido. Cualquier otra llamada necesita un protocolo permitido, una policy para ese agente y función con el bit `DEEP`, las anclas que haya puesto el dueño y un sí del validador de ese protocolo.',
          'Medir: leer el saldo de todo token permitido, todo token encontrado en los datos y todo token que declare un validador (hasta 60). Una lectura fallida revierte.',
          'Ejecutar el lote. Cuando un validador lo pide (`withdraw` de Aave, llamadas a posiciones de Uniswap), lo que entra en la wallet durante esa llamada también cuenta como coste.',
          'Cada aprobación que hizo el agente vuelve a su valor anterior. El agente nunca deja una allowance viva.',
          'Medir otra vez. Un token no permitido que haya bajado revierte el lote. Para un token permitido, salida + costes + comisión del 0,15 % se comprueba contra los límites por lote, diario y total, y la comisión se paga en ese token.',
          'Comprobaciones posteriores: los validadores que lo pidieron vuelven a decidir. En Aave, el factor de salud debe quedar en 1,2 o más.',
        ],
      },
      { type: 'h3', text: 'Call policies' },
      {
        type: 'p',
        text: 'Una policy es un `uint256` por agente, contrato y función, que fija el dueño con `setAgentCallPolicy`. El bit 255 permite la función y el bit 254 (`DEEP`) la manda al validador; en V5 toda llamada a protocolo necesita los dos, o revierte con `SelectorNotAllowed` o `CallNeedsValidator`. Las anclas opcionales añaden comprobaciones sobre palabras fijas de los datos: W (debe ser la wallet), P (un protocolo permitido), T (un token permitido), R (un destinatario permitido) y S (uno de un conjunto de valores guardado con `setAgentValueSet`, hasta 20). Los bits reservados deben ser 0.',
      },
      { type: 'h3', text: 'Getters' },
      { type: 'code', lang: 'solidity', code: V5_GETTERS },
      { type: 'h3', text: 'Errores que puede recibir un agente' },
      {
        type: 'table',
        headers: ['Error', 'Significado'],
        rows: [
          ['`NotAuthorizedAgent`, `AgentPermissionsExpired`, `AgentPaused`, `EnforcedPause`', 'no autorizado, caducado, en pausa propia, o todos los agentes en pausa'],
          ['`AgentMustBeEOA`', 'la dirección del agente tiene código (por ejemplo, una delegación EIP-7702)'],
          ['`AgentCannotCallWallet`, `TargetIsBlocked`', 'el destino es la propia wallet, o el dueño lo ha bloqueado'],
          ['`RecipientNotAllowed`, `TokenNotAllowed`, `ProtocolNotAllowed`', 'destino, token o protocolo fuera de las listas del agente'],
          ['`SelectorNotAllowed`, `CallNeedsValidator`, `PinnedArgMismatch`, `PolicyValidationFailed`', 'sin policy, policy sin `DEEP`, falló un ancla, o el validador dijo que no'],
          ['`ExceedsPerTxLimit`, `DailyLimitExceeded`, `TotalBudgetExceeded`, `PeriodBudgetExceeded`', 'un límite nativo, con la comisión incluida'],
          ['`TokenBatchLimitExceeded`, `TokenDailyLimitExceeded`, `TokenTotalBudgetExceeded`', 'un límite de token, con la comisión incluida'],
          ['`MeasurementFailed`, `TooManyMeasuredTokens`', 'no se pudo leer un saldo, o hay más de 60 tokens que medir'],
          ['`PostCheckFailed`', 'falló la comprobación posterior de un validador (por ejemplo, salud de Aave por debajo de 1,2)'],
          ['`FeeTransferFailed`, `TokenCallWithValue`', 'la comisión no se pudo pagar exacta, o una llamada a un token llevaba valor nativo'],
        ],
      },

      { type: 'h2', text: 'Factory — BVCCWalletFactoryV5' },
      { type: 'code', lang: 'solidity', code: V5_FACTORY },
      {
        type: 'list',
        items: [
          'Dirección determinista: salt = `keccak256(abi.encode(pubKeyX, pubKeyY))`. La misma passkey da la misma dirección en todas las redes, y puedes recibir fondos en ella antes de desplegar.',
          'Idempotente: `createWallet` devuelve la wallet existente si ya está desplegada.',
          'La dirección V5 es distinta de tu dirección V4 para la misma passkey, porque cambian la factory y el código.',
        ],
      },

      { type: 'h2', text: 'Registros y validadores (V5)' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistryV5` asocia cada contrato de protocolo a su validador. Permitir o sustituir un validador exige una propuesta y 48 horas, visibles en cadena; cancelar una propuesta o congelar un validador es inmediato. La propiedad solo cambia en dos pasos.',
          'Los validadores son contratos `view` sin estado que se llaman con `staticcall`. Devuelven sí o no, los tokens que hay que medir, los costes (como un préstamo de Aave), si quieren comprobación posterior y si se cobran las entradas. Un revert significa no. Solo se registran validadores inmutables.',
          'Universal Router: swaps de token a token (v3 y v4). Bytes de comando exactos; todo destinatario es la wallet; cada salto v4 decodificado, con cada hook ninguno o aprobado; valor nativo rechazado.',
          'PositionManager de Uniswap v4: solo posiciones de la wallet; añadir exige que la posición no tenga aprobación individual; no se puede sacar y meter en la misma llamada; hooks ninguno o aprobado en cada acción; entradas cobradas.',
          'Pool de Aave v3: depositar, retirar, pedir prestado (variable), devolver y ajustes de colateral y eMode, siempre para la propia wallet. Un préstamo se carga como coste contra el presupuesto, las retiradas se cobran como entrada, y el factor de salud debe quedar en 1,2 o más.',
          'Posiciones de Uniswap v3: crear hacia la wallet; añadir, retirar, quemar y cobrar solo en posiciones de la wallet; cobrar solo hacia la wallet.',
          'Nativo envuelto (WETH, WBNB, WPOL): solo `deposit()` y `withdraw(importe)`.',
          '`BVCCHookRegistryV5`: hooks de Uniswap v4 aprobados para agentes, con la misma espera de 48 horas y congelación inmediata. Un hook aprobado ejecuta su propio código, así que aprobar uno es una decisión de confianza.',
        ],
      },

      { type: 'h2', text: 'Notas de seguridad' },
      {
        type: 'list',
        items: [
          'Revisión de seguridad interna, con informe bilingüe en la carpeta `audits/` del monorepo y enlazado desde esta documentación. Cubre todas las generaciones. Treinta hallazgos con identificador: `BVCC-01` … `BVCC-13` de la revisión de V4 y anteriores, y `BVCC-14` … `BVCC-30` de cinco rondas de revisión de V5 y un equipo rojo, hechos por el equipo con herramientas de análisis con IA.',
          'En V5 no hay nada abierto: veintiséis hallazgos están cerrados en el código y cuatro son supuestos de confianza documentados (validadores inmutables, hooks aprobados, tokens permitidos y validadores que declaran todo token que mueven). Todos los hallazgos de V5 se resolvieron antes del despliegue.',
          'La V5 cierra `BVCC-03`, el riesgo que dejó abierto V4, midiendo lo que cada lote de agente saca de la wallet, haya las allowances que haya.',
          'La suite de V5 son 191 tests de Foundry (145 locales y 46 sobre forks de redes), con invariantes de 128.000 acciones aleatorias.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'Aún sin auditoría externa. Es software experimental en beta.' },

      { type: 'h2', text: 'Generación anterior: V4' },
      {
        type: 'callout',
        tone: 'info',
        text: 'Las wallets V4 siguen funcionando, pero las wallets nuevas son V5 y la V4 mantiene abierto `BVCC-03`. Para cambiar, ver Pasar a la wallet V5.',
      },
      { type: 'table', headers: ['Contrato', 'Dirección'], rows: V4_ADDR_ROWS },
      {
        type: 'p',
        text: 'En vivo en Arbitrum One, Base, BNB Chain, Ethereum, Polygon y Arbitrum Sepolia (testnet). Los validators por red (`BVCCUniversalRouterValidator`, `BVCCPositionManagerValidator`) van ligados al router / position manager de cada cadena, así que su dirección difiere por red — ver `contracts/deployments/` del monorepo. Las factories V2 anteriores (`0x230b…BdEf1` / `0x8D9e…054c`) quedan obsoletas.',
      },
      { type: 'h3', text: 'BVCCSmartWalletV4 — wallet personal (walletType 0)' },
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

      { type: 'h3', text: 'BVCCAgentWalletV4 — wallet de agente IA (walletType 1)' },
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

      { type: 'h3', text: 'Factories' },
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

      { type: 'h3', text: 'Registries y validators' },
      {
        type: 'list',
        items: [
          '`BVCCValidatorRegistry` — punto de despacho fijo, compilado como constante dentro del wallet para que no se pueda colar un validator falso. Mapea un target de protocolo a su validator.',
          '`BVCCUniversalRouterValidator` / `BVCCPositionManagerValidator` — por red, cada uno ligado al router / position manager de esa cadena; las direcciones difieren por red (ver `contracts/deployments/`).',
          '`BVCCHookRegistry` — allowlist de hooks Uniswap v4 aprobados, con la misma gobernanza de 48h.',
          '`IBVCCValidator` — la interfaz view `validate(...)` compartida. Es una interfaz, no un contrato desplegado; los validators concretos la implementan y se llaman por staticcall en modo fail-closed.',
        ],
      },

      { type: 'h3', text: 'Notas de seguridad' },
      {
        type: 'list',
        items: [
          'Security review interna, informe bilingüe en la carpeta `audits/` del monorepo y enlazado desde esta documentación. Para V4: cuatro rondas, trece hallazgos con identificador (`BVCC-01` … `BVCC-13`): 2 críticos, 3 altos, 5 medios, 1 bajo, 2 informativos. Nueve están corregidos y desplegados en las seis redes — entre ellos una reentrada cruzada que permitía a un agente comprometido saltarse todos los límites, y la apropiación de guardianes vía la factory. Cuatro quedan abiertos o aceptados por decisión, cada uno con su mitigación documentada; el que debería cambiar tu forma de operar es `BVCC-03`. La suite V4 son 312 tests de Foundry (unit, fork y fuzz). Ningún tercero independiente ha auditado este código.',
          'La V2 (junio 2026) corrigió un caso de gas-griefing en Arbitrum: las probes de balance van capadas a 100k de gas (`PROBE_GAS_CAP`) para que un calldata que casualmente contenga la dirección de un precompile no pueda quemar el gas de la transacción. V3 mantiene este fix.',
          'La V3 (julio 2026) cierra una vía de exfiltración de fondos del agente: una clave de agente robada podía antes poner su propia dirección como recipient/`to` de un swap o `Pool.withdraw` y mover fondos sin tocar el presupuesto de ETH/token. V3 hace las llamadas del caso 3 default-deny por selector y ancla el destinatario a la wallet (o lo valida on-chain). El camino biométrico del dueño no se ve afectado.',
        ],
      },
      { type: 'callout', tone: 'warn', text: 'Aún sin auditoría externa — es software experimental en beta.' },
    ],
  },
}
