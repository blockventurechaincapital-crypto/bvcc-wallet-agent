/**
 * V3 call-policy presets (local test — Arbitrum only).
 *
 * In V3 the Agent Wallet is default-deny for Case-3 protocol calls: whitelisting a
 * protocol in `allowedProtocols` is NOT enough — the owner must also register a call
 * policy per selector so a stolen agent key cannot redirect funds. Two enforcement
 * shapes:
 *   - PIN_WALLET (bitmap): a fixed calldata word must equal the wallet. Cheap; works
 *     when the destination arg sits at a fixed offset (SwapRouter02, Aave Pool).
 *   - DEEP_VALIDATION: defers to the fixed on-chain validator registry, which decodes
 *     variable-length calldata and checks every recipient. Needed when the recipient
 *     is buried in dynamic encoding (Universal Router `execute`).
 * Authorizing an agent bundles the right `setCallPolicy` calls into the same Face ID
 * signature.
 *
 * Policy word layout (uint256): bit 255 = allowed; bit 254 = DEEP_VALIDATION;
 * bits 223..192 = PIN_WALLET bitmap (calldata word i must equal the wallet).
 */
import { encodeFunctionData, getAddress, toFunctionSelector, type Address, type Hex } from 'viem'
import { BVCC_AGENT_WALLET_ABI } from './abis'

const POLICY_ALLOWED = 1n << 255n
const POLICY_DEEP = 1n << 254n
const pinWallet = (word: number): bigint => 1n << (192n + BigInt(word))
const pinProtocol = (word: number): bigint => 1n << (160n + BigInt(word))

export interface PolicyDef {
  label: string
  selector: Hex
  /** the calldata word (0-indexed, post-selector) pinned to the wallet, if any */
  pinnedWord?: number
  /** the calldata word that must be a whitelisted protocol, if any */
  pinnedProtocolWord?: number
  /** routes recipient checks to the validator registry (DEEP_VALIDATION) */
  deep?: boolean
  policy: bigint
}

/** allow + pin one calldata word to the wallet (bitmap pin). */
function def(label: string, signature: string, pinnedWord: number): PolicyDef {
  return {
    label,
    selector: toFunctionSelector(signature),
    pinnedWord,
    policy: POLICY_ALLOWED | pinWallet(pinnedWord),
  }
}

/** allow + require one calldata word to be a whitelisted protocol (PIN_PROTOCOL). */
function protoDef(label: string, signature: string, pinnedWord: number): PolicyDef {
  return {
    label,
    selector: toFunctionSelector(signature),
    pinnedProtocolWord: pinnedWord,
    policy: POLICY_ALLOWED | pinProtocol(pinnedWord),
  }
}

/** allow with no pin — for calls that have no destination argument to anchor. */
function plainDef(label: string, signature: string): PolicyDef {
  return { label, selector: toFunctionSelector(signature), policy: POLICY_ALLOWED }
}

/** allow + defer recipient validation to the on-chain registry (DEEP_VALIDATION). */
function deepDef(label: string, signature: string): PolicyDef {
  return {
    label,
    selector: toFunctionSelector(signature),
    deep: true,
    policy: POLICY_ALLOWED | POLICY_DEEP,
  }
}

interface ProtocolPreset {
  label: string
  defs: PolicyDef[]
}

/** Per-chain protocol address (lowercase) → required call policies. */
const PRESETS: Record<number, Record<string, ProtocolPreset>> = {
  42161: {
    // Uniswap v4 PositionManager (LP, native-first). modifyLiquidities buries the
    // recipient in dynamic encoding → DEEP_VALIDATION via BVCCPositionManagerValidator
    // (registered with 48h governance). Inert until that validator is active. Permit2
    // (already a preset below) funds the ERC-20 sides.
    '0xd88f38f930b7952f2db2432cb002e7abbf3dd869': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    // Uniswap V3 NonfungiblePositionManager (LP). mint/collect pin the recipient to
    // the wallet (verified by encoding real calldata: mint recipient = word 9,
    // collect recipient = word 1). decrease/burn act on a tokenId the NFPM gates to
    // its owner on-chain (isAuthorizedForToken), so there is no destination arg to
    // pin (plainDef).
    // increaseLiquidity is DELIBERATELY EXCLUDED: unlike decrease/collect/burn it has
    // NO owner check in the NFPM (only checkDeadline, verified against the on-chain
    // source), so an agent could pull the wallet's NFPM-approved tokens into an
    // attacker-owned tokenId — a recipient-whitelist bypass that CANNOT be bitmap-
    // pinned (word 0 is the tokenId, not an address). To add liquidity the agent mints
    // a fresh position (recipient pinned to the wallet). Re-enabling increase needs a
    // DEEP validator that checks ownerOf(tokenId)==wallet (a future contract phase).
    // No `multicall` either: native-ETH LP (multicall+refundETH) is out of the v3 MVP
    // — native LP is covered by v4. Note: v3 collect/decrease do NOT carry token0/
    // token1 in calldata, so the Case-3 fee snapshot finds no token and no BVCC fee is
    // charged on v3 withdrawals — same as the owner's /wallet/positions claim today
    // (claimFees.ts). v4 LP does charge it.
    '0xc36442b4a4522e871399cd717abdd847ab11fe88': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    // Uniswap SwapRouter02. The *Single variants use a fully static struct, so the
    // recipient sits at word 3. The multi-hop variants carry `bytes path`, which makes
    // the tuple dynamic and slides an offset word in front — their recipient is at
    // word 2, NOT 3. Verified by encoding real calldata; pinning 3 there would pin
    // `amountIn` instead and leave the destination free.
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    // WETH — needed for native ETH swaps done as BVCC batches (never via the
    // Universal Router's ADDRESS_THIS legs). Neither call has a destination argument
    // to pin: `deposit` credits msg.sender and `withdraw` pays msg.sender, both the
    // wallet itself. WETH must also be in allowedTokens for the swap's approve.
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': {
      label: 'WETH (native swaps)',
      defs: [
        plainDef('deposit',  'deposit()'),
        plainDef('withdraw', 'withdraw(uint256)'),
      ],
    },
    // Uniswap Universal Router — recipient lives inside variable-length `inputs`, so
    // it cannot be bitmap-pinned; DEEP_VALIDATION routes to BVCCUniversalRouterValidator.
    // Inert until the validator is active in the registry (48h timelock) — the agent's
    // execute() call fails closed (registry returns false) until then.
    '0xa51afafe0263b40edaef0df8781ea9aa03e381a3': {
      label: 'Uniswap Universal Router',
      defs: [
        deepDef('execute', 'execute(bytes,bytes[],uint256)'),
      ],
    },
    // Permit2 — required alongside the Universal Router: the wallet approves Permit2
    // on the ERC-20 (Case 2b), then Permit2.approve(token, spender, ...) authorizes the
    // router to pull. The spender (word 1) is PIN_PROTOCOL, so an agent can only grant
    // pull rights to an already-whitelisted protocol, never to an attacker address.
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [
        protoDef('approve', 'approve(address,address,uint160,uint48)', 1),
      ],
    },
    // Aave v3 Pool. supply/withdraw/borrow/repay pin onBehalfOf / to to the wallet.
    // The last three have no destination argument to pin (repayWithATokens burns the
    // wallet's own aTokens; the two setters move nothing) — needed by the SDK planners
    // (closePosition via aTokens, collateralSwap, setEMode) or their routes revert with
    // SelectorNotAllowed.
    '0x794a61358d6845594f94dc1db02a252b5b4814ad': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },

  // Same preset shapes as Arbitrum (42161); addresses are per-chain and verified
  // on-chain. UR = Uniswap's canonical v4 Universal Router with a registered validator.
  1: {
    // Uniswap v4 PositionManager (LP, native-first). modifyLiquidities buries the
    // recipient in dynamic encoding → DEEP_VALIDATION via BVCCPositionManagerValidator
    // (registered with 48h governance). Inert until that validator is active. Permit2
    // (already a preset below) funds the ERC-20 sides.
    '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    '0xc36442b4a4522e871399cd717abdd847ab11fe88': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
      label: 'WETH (native swaps)',
      defs: [plainDef('deposit', 'deposit()'), plainDef('withdraw', 'withdraw(uint256)')],
    },
    '0x66a9893cc07d91d95644aedd05d03f95e1dba8af': {
      label: 'Uniswap Universal Router',
      defs: [deepDef('execute', 'execute(bytes,bytes[],uint256)')],
    },
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [protoDef('approve', 'approve(address,address,uint160,uint48)', 1)],
    },
    '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },
  56: {
    // Uniswap v4 PositionManager (LP, native-first). modifyLiquidities buries the
    // recipient in dynamic encoding → DEEP_VALIDATION via BVCCPositionManagerValidator
    // (registered with 48h governance). Inert until that validator is active. Permit2
    // (already a preset below) funds the ERC-20 sides.
    '0x7a4a5c919ae2541aed11041a1aeee68f1287f95b': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    '0x7b8a01b39d58278b5de7e48c8449c9f4f5170613': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    '0xb971ef87ede563556b2ed4b1c0b0019111dd85d2': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': {
      label: 'WBNB (native swaps)',
      defs: [plainDef('deposit', 'deposit()'), plainDef('withdraw', 'withdraw(uint256)')],
    },
    '0x1906c1d672b88cd1b9ac7593301ca990f94eae07': {
      label: 'Uniswap Universal Router',
      defs: [deepDef('execute', 'execute(bytes,bytes[],uint256)')],
    },
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [protoDef('approve', 'approve(address,address,uint160,uint48)', 1)],
    },
    '0x6807dc923806fe8fd134338eabca509979a7e0cb': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },
  137: {
    // Uniswap v4 PositionManager (LP, native-first) — modifyLiquidities DEEP via
    // BVCCPositionManagerValidator (48h governance). Inert until the validator is active.
    '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    '0xc36442b4a4522e871399cd717abdd847ab11fe88': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': {
      label: 'WPOL (native swaps)',
      defs: [plainDef('deposit', 'deposit()'), plainDef('withdraw', 'withdraw(uint256)')],
    },
    '0x1095692a6237d83c6a72f3f5efedb9a670c49223': {
      label: 'Uniswap Universal Router',
      defs: [deepDef('execute', 'execute(bytes,bytes[],uint256)')],
    },
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [protoDef('approve', 'approve(address,address,uint160,uint48)', 1)],
    },
    '0x794a61358d6845594f94dc1db02a252b5b4814ad': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },
  8453: {
    // Uniswap v4 PositionManager (LP, native-first). modifyLiquidities buries the
    // recipient in dynamic encoding → DEEP_VALIDATION via BVCCPositionManagerValidator
    // (registered with 48h governance). Inert until that validator is active. Permit2
    // (already a preset below) funds the ERC-20 sides.
    '0x7c5f5a4bbd8fd63184577525326123b519429bdc': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    '0x03a520b32c04bf3beef7beb72e919cf822ed34f1': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    '0x2626664c2603336e57b271c5c0b26f421741e481': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    '0x4200000000000000000000000000000000000006': {
      label: 'WETH (native swaps)',
      defs: [plainDef('deposit', 'deposit()'), plainDef('withdraw', 'withdraw(uint256)')],
    },
    '0x6ff5693b99212da76ad316178a184ab56d299b43': {
      label: 'Uniswap Universal Router',
      defs: [deepDef('execute', 'execute(bytes,bytes[],uint256)')],
    },
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [protoDef('approve', 'approve(address,address,uint160,uint48)', 1)],
    },
    '0xa238dd80c259a72e81d7e4664a9801593f98d1c5': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },
  421614: {
    // Uniswap v4 PositionManager (LP, native-first) — modifyLiquidities DEEP via
    // BVCCPositionManagerValidator (48h governance). Inert until the validator is active.
    '0xac631556d3d4019c95769033b5e719dd77124bac': {
      label: 'Uniswap v4 Positions (PositionManager)',
      defs: [
        deepDef('modifyLiquidities', 'modifyLiquidities(bytes,uint256)'),
      ],
    },
    '0x6b2937bde17889edcf8fbd8de31c3c2a70bc4d65': {
      label: 'Uniswap V3 Positions (NFPM)',
      defs: [
        def('mint',    'mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))', 9),
        def('collect', 'collect((uint256,address,uint128,uint128))', 1),
        plainDef('decreaseLiquidity', 'decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
        plainDef('burn', 'burn(uint256)'),
      ],
    },
    '0x101f443b4d1b059569d643917553c771e1b9663e': {
      label: 'Uniswap SwapRouter02',
      defs: [
        def('exactInputSingle',  'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',  3),
        def('exactOutputSingle', 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))', 3),
        def('exactInput',        'exactInput((bytes,address,uint256,uint256))',  2),
        def('exactOutput',       'exactOutput((bytes,address,uint256,uint256))', 2),
      ],
    },
    '0x980b62da83eff3d4576c647993b0c1d7faf17c73': {
      label: 'WETH (native swaps)',
      defs: [plainDef('deposit', 'deposit()'), plainDef('withdraw', 'withdraw(uint256)')],
    },
    '0xefd1d4bd4cf1e86da286bb4cb1b8bced9c10ba47': {
      label: 'Uniswap Universal Router',
      defs: [deepDef('execute', 'execute(bytes,bytes[],uint256)')],
    },
    '0x000000000022d473030f116ddee9f6b43ac78ba3': {
      label: 'Permit2 (Universal Router)',
      defs: [protoDef('approve', 'approve(address,address,uint160,uint48)', 1)],
    },
    '0xbfc91d59fdaa134a4ed45f7b584caf96d7792eff': {
      label: 'Aave v3 Pool',
      defs: [
        def('supply',   'supply(address,uint256,address,uint16)',          2),
        def('withdraw', 'withdraw(address,uint256,address)',               2),
        def('borrow',   'borrow(address,uint256,uint256,uint16,address)',  4),
        def('repay',    'repay(address,uint256,uint256,address)',          3),
        plainDef('repayWithATokens',              'repayWithATokens(address,uint256,uint256)'),
        plainDef('setUserUseReserveAsCollateral', 'setUserUseReserveAsCollateral(address,bool)'),
        plainDef('setUserEMode',                  'setUserEMode(uint8)'),
      ],
    },
  },
}

/** Known protocol addresses (lowercase) that have presets on a chain. */
export function knownPresetProtocols(chainId: number): string[] {
  return Object.keys(PRESETS[chainId] ?? {})
}

/** Labeled preset protocols for the agent-form autocomplete. */
export function presetProtocolSuggestions(chainId: number): { label: string; address: Address }[] {
  const chain = PRESETS[chainId]
  if (!chain) return []
  return Object.entries(chain).map(([address, preset]) => ({
    label: preset.label,
    address: getAddress(address),
  }))
}

/** The policy defs that apply to a given set of whitelisted protocols. */
export function policyDefsFor(chainId: number, allowedProtocols: Address[]): { target: Address; def: PolicyDef }[] {
  const chain = PRESETS[chainId]
  if (!chain) return []
  const out: { target: Address; def: PolicyDef }[] = []
  for (const proto of allowedProtocols) {
    const preset = chain[proto.toLowerCase()]
    if (preset) for (const d of preset.defs) out.push({ target: proto, def: d })
  }
  return out
}

/** `setCallPolicy` inner-calldata for each preset policy of the whitelisted protocols. */
export function policyCallsFor(chainId: number, allowedProtocols: Address[]): Hex[] {
  return policyDefsFor(chainId, allowedProtocols).map(({ target, def }) =>
    encodeFunctionData({
      abi: BVCC_AGENT_WALLET_ABI,
      functionName: 'setCallPolicy',
      args: [target, def.selector, def.policy],
    })
  )
}
