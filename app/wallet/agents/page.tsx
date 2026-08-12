'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  isAddress, createPublicClient, http,
  encodeAbiParameters, encodeFunctionData,
  parseEther, parseUnits, formatUnits,
  type Address, type Hex,
} from 'viem'
import { authenticateWebAuthn } from '@/lib/webauthn'
import { BVCC_WALLET_ABI, BVCC_AGENT_WALLET_ABI } from '@/lib/abis'
import { ENTRYPOINT_ADDRESS, ENTRYPOINT_ABI, BATCH_MODE } from '@/lib/entrypoint'
import { useWalletAddress } from '@/lib/useWalletAddress'
import { useNetwork } from '@/lib/NetworkContext'
import { useWalletType } from '@/lib/useWalletType'
import { useI18n } from '@/lib/i18n/I18nContext'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { waitForUserOp } from '@/lib/waitForUserOp'
import { policyCallsFor, presetProtocolSuggestions } from '@/lib/callPolicies'
import {
  composeFromCapabilities,
  capabilitiesFromProtocols,
  agentCapabilitiesFor,
  type CapabilityId,
} from '@/lib/agentCapabilities'
import { CapabilityPicker } from '@/components/CapabilityPicker'
import { ExplorerAddress } from '@/components/ExplorerAddress'
import DisclaimerModal from '@/components/DisclaimerModal'
import { AgentAvatar, AgentAvatarPicker } from '@/components/AgentAvatar'
import type { NetworkConfig } from '@/lib/networks'
import { suggestGasFees } from '@/lib/gasFees'

const C = {
  bg: '#06080f',
  card: '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  borderFocus: 'rgba(212,175,55,0.4)',
  gold: '#D4AF37',
  goldDim: 'rgba(212,175,55,0.08)',
  goldBorder: 'rgba(212,175,55,0.2)',
  text: '#f0f4f8',
  muted: '#8892a4',
  subtle: '#4a5568',
  error: '#fc8181',
  success: '#68d391',
  warn: '#f6ad55',
  info: '#63b3ed',
}

function packBytes32(hi: bigint, lo: bigint): Hex {
  return `0x${((hi << 128n) | lo).toString(16).padStart(64, '0')}` as Hex
}

function hexToBytes(hex: Hex): Uint8Array {
  const h = hex.slice(2)
  const arr = new Uint8Array(h.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return arr
}

function shortAddr(addr: string) {
  return addr.length >= 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr
}

function formatEth(wei: bigint): string {
  if (wei === 0n) return '0'
  const eth = Number(wei) / 1e18
  if (eth >= 1) return eth.toFixed(4).replace(/\.?0+$/, '')
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

function parseEthInput(val: string): bigint {
  if (!val || val === '0' || val === '') return 0n
  try { return parseEther(val) } catch { return 0n }
}

function getTokenDecimals(address: string, usdcAddress?: string | null): number {
  if (usdcAddress && address.toLowerCase() === usdcAddress.toLowerCase()) return 6
  return 18
}

function parseTokenAmount(val: string, decimals: number): bigint {
  if (!val || val === '0' || val === '') return 0n
  try { return parseUnits(val, decimals) } catch { return 0n }
}

function formatTokenAmount(wei: bigint, decimals: number): string {
  if (wei === 0n) return '0'
  try {
    const val = Number(formatUnits(wei, decimals))
    if (val >= 1) return val.toFixed(2).replace(/\.?0+$/, '')
    return val.toFixed(6).replace(/\.?0+$/, '')
  } catch { return '0' }
}

function getTokenLabel(address: string, network: NetworkConfig): string {
  if (network.tokens.usdc && address.toLowerCase() === network.tokens.usdc.toLowerCase()) return 'USDC'
  if (address.toLowerCase() === network.tokens.weth.toLowerCase()) return 'WETH'
  return shortAddr(address)
}

// ── Interfaces ──────────────────────────────────────────────────────────────

interface AgentPermission {
  maxPerTxWei: bigint
  dailyLimitWei: bigint
  totalBudgetWei: bigint
  totalSpentWei: bigint
  periodBudgetWei: bigint
  periodSpentWei: bigint
  allowedTokens: readonly Address[]
  tokenMaxAmounts: readonly bigint[]
  tokenDailyLimits: readonly bigint[]
  tokenTotalBudgets: readonly bigint[]
  allowedProtocols: readonly Address[]
  allowedRecipients: readonly Address[]
  expiry: bigint
  periodDuration: bigint
  periodStart: bigint
  active: boolean
}

interface AgentInfo {
  address: Address
  perm: AgentPermission
  dailySpent: bigint
  // Per-token spend keyed by lowercased token address: { daily, total }
  tokenSpent: Record<string, { daily: bigint; total: bigint }>
}

// Per-token limits form entry
interface TokenLimitForm {
  address: string
  maxPerTx: string     // human-readable (e.g. "500" = 500 USDC)
  dailyLimit: string   // future contract field — stored in form, sent to contract when ready
  totalBudget: string  // future contract field
}

type ActionStatus = 'idle' | 'building' | 'signing' | 'sending' | 'success' | 'error'

type Modal =
  | { type: 'none' }
  | { type: 'authorize'; editAgent?: AgentInfo }
  | { type: 'increase'; agent: AgentInfo }
  | { type: 'agentDisclaimer' }

export default function AgentsPage() {
  const { address: walletAddress, credentialId } = useWalletAddress()
  const { network } = useNetwork()
  const { walletType, isLoading: wtLoading } = useWalletType()
  const { t } = useI18n()
  const submitUserOp = useSubmitUserOp()

  const publicClient = useMemo(
    () => createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) }),
    [network.chainId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [agentsPaused, setAgentsPaused] = useState(false)
  const [pauseSupported, setPauseSupported] = useState(true)
  const [pauseStatus, setPauseStatus] = useState<ActionStatus>('idle')
  const [modal, setModal] = useState<Modal>({ type: 'none' })
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [actionError, setActionError] = useState('')
  const [actionTxHash, setActionTxHash] = useState<string | null>(null)
  // alias: localStorage key bvcc_agent_aliases_<walletAddress> → {[agentAddr]: alias}
  const [aliases, setAliases] = useState<Record<string, string>>({})
  const now = Math.floor(Date.now() / 1000)

  // ── Form state (authorize / edit) ──────────────────────────────────────────
  const [fAgent, setFAgent] = useState('')
  const [fMaxPerTx, setFMaxPerTx] = useState('')
  const [fDailyLimit, setFDailyLimit] = useState('')
  const [fTotalBudget, setFTotalBudget] = useState('')
  const [fPeriodBudget, setFPeriodBudget] = useState('')
  const [fPeriodDays, setFPeriodDays] = useState('')
  const [fTokenLimits, setFTokenLimits] = useState<TokenLimitForm[]>([])
  const [fTokenInput, setFTokenInput] = useState('')
  const [fProtocols, setFProtocols] = useState<string[]>([])
  const [fProtocolInput, setFProtocolInput] = useState('')
  const [fRecipients, setFRecipients] = useState<string[]>([])
  const [fRecipientInput, setFRecipientInput] = useState('')
  const [fExpiry, setFExpiry] = useState('')
  // Selected capabilities. The picker composes protocols/tokens/recipients from
  // these; the manual lists below hold only what the user typed by hand.
  const [fCaps, setFCaps] = useState<CapabilityId[]>([])
  // What the agent already has ON-CHAIN when the edit modal opens (lowercased).
  // Suggestion chips use it to show green (already accepted on-chain) vs blue
  // (staged in this form, not yet signed). Empty when authorizing a new agent.
  const [onChainBaseline, setOnChainBaseline] = useState<{
    tokens: Set<string>; protocols: Set<string>; recipients: Set<string>
  }>({ tokens: new Set(), protocols: new Set(), recipients: new Set() })

  // ── Increase budget state ──────────────────────────────────────────────────
  const [fIncrease, setFIncrease] = useState('')

  // ── Load agents ────────────────────────────────────────────────────────────
  async function loadAgents() {
    if (!walletAddress) return
    setLoadingAgents(true)
    setLoadError('')
    try {
      const agentAddrs = await publicClient.readContract({
        address: walletAddress as Address,
        abi: BVCC_AGENT_WALLET_ABI,
        functionName: 'getAgents',
        args: [],
      }) as Address[]

      // paused() is non-critical: older deployed wallets (factory compiled before
      // Pausable was added) lack this function and revert. Don't let that break the page.
      try {
        const isPaused = await publicClient.readContract({
          address: walletAddress as Address,
          abi: BVCC_AGENT_WALLET_ABI,
          functionName: 'paused',
          args: [],
        }) as boolean
        setPauseSupported(true)
        setAgentsPaused(isPaused)
      } catch {
        setPauseSupported(false)
        setAgentsPaused(false)
      }

      const infos = await Promise.all(agentAddrs.map(async (addr) => {
        const [perm, dailySpent] = await Promise.all([
          publicClient.readContract({
            address: walletAddress as Address,
            abi: BVCC_AGENT_WALLET_ABI,
            functionName: 'getAgentPermission',
            args: [addr],
          }),
          publicClient.readContract({
            address: walletAddress as Address,
            abi: BVCC_AGENT_WALLET_ABI,
            functionName: 'getDailySpent',
            args: [addr],
          }),
        ])
        const typedPerm = perm as AgentPermission

        // Per-token spent (daily + total), one read per allowed token.
        const tokenSpent: Record<string, { daily: bigint; total: bigint }> = {}
        await Promise.all(typedPerm.allowedTokens.map(async (token) => {
          try {
            const [daily, total] = await publicClient.readContract({
              address: walletAddress as Address,
              abi: BVCC_AGENT_WALLET_ABI,
              functionName: 'getTokenSpent',
              args: [addr, token],
            }) as [bigint, bigint]
            tokenSpent[token.toLowerCase()] = { daily, total }
          } catch {
            // older wallets may not expose getTokenSpent; leave bars hidden
          }
        }))

        return { address: addr, perm: typedPerm, dailySpent: dailySpent as bigint, tokenSpent }
      }))
      setAgents(infos)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoadingAgents(false)
    }
  }

  // The bundler replies as soon as the UserOp is accepted, not when it is mined, so
  // reading the wallet straight after `sendUserOp` returns the pre-transaction state —
  // which is why a green tx used to leave the old limits on screen. Wait for the
  // receipt, then re-read.
  async function settleAndReload(txHash: string) {
    // Esperar el recibo no bastaba: la transacción puede minarse con exito y la
    // UserOperation haber fallado dentro, dejando "autorizado" un agente que no
    // lo esta. Ver lib/waitForUserOp.ts.
    const res = await waitForUserOp(txHash as Hex, network, {
      wallet: walletAddress as Address, timeoutMs: 60_000,
    })
    await loadAgents()
    if (res.estado === 'fallida' || res.estado === 'reemplazada') {
      throw new Error(res.estado === 'reemplazada'
        ? 'Otra transaccion ocupo su lugar antes de confirmar. No se ha cambiado nada: vuelve a intentarlo.'
        : 'La operacion no se completo. Revisa el estado del agente antes de volver a intentarlo.')
    }
  }

  // Closing the modal after a successful action re-reads the wallet, so the changes are
  // on screen without navigating away and back.
  function closeModal() {
    const wasSuccess = actionStatus === 'success'
    setModal({ type: 'none' })
    if (wasSuccess) void loadAgents()
  }

  // Load aliases from localStorage
  useEffect(() => {
    if (!walletAddress) return
    try {
      const raw = localStorage.getItem(`bvcc_agent_aliases_${walletAddress.toLowerCase()}`)
      setAliases(raw ? JSON.parse(raw) : {})
    } catch { setAliases({}) }
  }, [walletAddress])

  function saveAlias(agentAddr: string, alias: string) {
    if (!walletAddress) return
    const key = `bvcc_agent_aliases_${walletAddress.toLowerCase()}`
    const next = { ...aliases, [agentAddr.toLowerCase()]: alias }
    setAliases(next)
    localStorage.setItem(key, JSON.stringify(next))
  }

  useEffect(() => {
    if (walletType === 1) loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletType, walletAddress, network.chainId])

  // ── Open form for authorize/edit ───────────────────────────────────────────
  function openAuthorize(editAgent?: AgentInfo) {
    // New agents require accepting the agent disclaimer first (editing does not).
    if (!editAgent && (typeof window === 'undefined' || localStorage.getItem('bvcc_agent_disclaimer_accepted') !== 'true')) {
      setModal({ type: 'agentDisclaimer' })
      return
    }
    setActionStatus('idle')
    setActionError('')
    setActionTxHash(null)
    if (editAgent) {
      const p = editAgent.perm
      setFAgent(editAgent.address)
      setFMaxPerTx(p.maxPerTxWei > 0n ? formatEth(p.maxPerTxWei) : '')
      setFDailyLimit(p.dailyLimitWei > 0n ? formatEth(p.dailyLimitWei) : '')
      setFTotalBudget(p.totalBudgetWei > 0n ? formatEth(p.totalBudgetWei) : '')
      setFPeriodBudget(p.periodBudgetWei > 0n ? formatEth(p.periodBudgetWei) : '')
      setFPeriodDays(p.periodDuration > 0n ? String(Number(p.periodDuration) / 86400) : '')
      setFTokenLimits(p.allowedTokens.map((addr, i) => {
        const dec = getTokenDecimals(addr, network.tokens.usdc)
        return {
          address: addr,
          maxPerTx: p.tokenMaxAmounts[i] > 0n ? formatTokenAmount(p.tokenMaxAmounts[i], dec) : '',
          dailyLimit: (p.tokenDailyLimits?.[i] ?? 0n) > 0n ? formatTokenAmount(p.tokenDailyLimits[i], dec) : '',
          totalBudget: (p.tokenTotalBudgets?.[i] ?? 0n) > 0n ? formatTokenAmount(p.tokenTotalBudgets[i], dec) : '',
        }
      }))
      // Split the on-chain lists into "covered by a capability" and "manual". The
      // picker owns the composed addresses; the raw lists show only the rest (e.g.
      // a hand-added 1inch address), so nothing appears twice.
      const caps = capabilitiesFromProtocols(network.chainId, [...p.allowedProtocols] as Address[])
      const composed = composeFromCapabilities(network.chainId, caps)
      const composedProto = new Set(composed.protocols.map(a => a.toLowerCase()))
      const composedRecip = new Set(composed.recipients.map(a => a.toLowerCase()))
      setFCaps(caps)
      setFProtocols(p.allowedProtocols.filter(a => !composedProto.has(a.toLowerCase())))
      setFRecipients(p.allowedRecipients.filter(a => !composedRecip.has(a.toLowerCase())))
      setFExpiry(p.expiry > 0n ? new Date(Number(p.expiry) * 1000).toISOString().slice(0, 16) : '')
      setOnChainBaseline({
        tokens: new Set(p.allowedTokens.map(a => a.toLowerCase())),
        protocols: new Set(p.allowedProtocols.map(a => a.toLowerCase())),
        recipients: new Set(p.allowedRecipients.map(a => a.toLowerCase())),
      })
    } else {
      setFAgent(''); setFMaxPerTx(''); setFDailyLimit(''); setFTotalBudget('')
      setFPeriodBudget(''); setFPeriodDays('')
      setFTokenLimits([]); setFProtocols([]); setFRecipients([]); setFExpiry(''); setFCaps([])
      setOnChainBaseline({ tokens: new Set(), protocols: new Set(), recipients: new Set() })
    }
    setFTokenInput('')
    setFProtocolInput('')
    setFRecipientInput('')
    setModal({ type: 'authorize', editAgent })
  }

  function openIncrease(agent: AgentInfo) {
    setFIncrease('')
    setActionStatus('idle')
    setActionError('')
    setActionTxHash(null)
    setModal({ type: 'increase', agent })
  }

  // ── Send UserOp helper ─────────────────────────────────────────────────────
  // Accepts a single inner call or a batch — all items are self-calls on the wallet
  // (owner functions require msg.sender == wallet). One Face ID signature covers the
  // whole batch, so authorizeAgent + setCallPolicy(...) go together atomically.
  async function sendUserOp(inner: Hex | Hex[]): Promise<string> {
    if (!walletAddress || !credentialId) throw new Error(t('connect.errNoWallet'))

    const innerCalls = Array.isArray(inner) ? inner : [inner]

    const nonce = await publicClient.readContract({
      address: walletAddress as Address,
      abi: BVCC_WALLET_ABI,
      functionName: 'getNonce',
      args: [],
    }) as bigint

    const executionData = encodeAbiParameters(
      [{ type: 'tuple[]', components: [
        { name: 'target', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'callData', type: 'bytes' },
      ]}],
      [innerCalls.map(callData => ({ target: walletAddress as Address, value: 0n, callData }))]
    )

    const callData = encodeFunctionData({
      abi: BVCC_WALLET_ABI,
      functionName: 'execute',
      args: [BATCH_MODE, executionData],
    })

    const { maxFeePerGas, maxPriorityFeePerGas } = await suggestGasFees(publicClient, network.chainId)

    const userOp = {
      sender: walletAddress as Address,
      nonce,
      initCode: '0x' as Hex,
      callData,
      accountGasLimits: packBytes32(1_500_000n, 1_500_000n),
      preVerificationGas: 300_000n,
      gasFees: packBytes32(maxPriorityFeePerGas, maxFeePerGas),
      paymasterAndData: '0x' as Hex,
      signature: '0x' as Hex,
    }

    const userOpHash = await publicClient.readContract({
      address: ENTRYPOINT_ADDRESS,
      abi: ENTRYPOINT_ABI,
      functionName: 'getUserOpHash',
      args: [userOp],
    }) as Hex

    setActionStatus('signing')
    const { r, s, authenticatorData, clientDataJSON: clientDataHex } =
      await authenticateWebAuthn(credentialId, hexToBytes(userOpHash))

    const clientDataStr = new TextDecoder().decode(hexToBytes(clientDataHex))
    const challengeIndex = BigInt(clientDataStr.indexOf('"challenge":'))
    const typeIndex = BigInt(clientDataStr.indexOf('"type":'))

    const signature = encodeAbiParameters(
      [
        { name: 'r', type: 'bytes32' },
        { name: 's', type: 'bytes32' },
        { name: 'challengeIndex', type: 'uint256' },
        { name: 'typeIndex', type: 'uint256' },
        { name: 'authenticatorData', type: 'bytes' },
        { name: 'clientDataJSON', type: 'string' },
      ],
      [
        `0x${r.toString(16).padStart(64, '0')}` as Hex,
        `0x${s.toString(16).padStart(64, '0')}` as Hex,
        challengeIndex,
        typeIndex,
        authenticatorData,
        clientDataStr,
      ]
    )

    setActionStatus('sending')
    const { txHash } = await submitUserOp({
      chainId: network.chainId,
      userOp: {
        ...userOp,
        nonce: nonce.toString(),
        preVerificationGas: userOp.preVerificationGas.toString(),
        signature,
      },
    })
    return txHash
  }

  // ── Submit authorize/edit ──────────────────────────────────────────────────
  async function handleAuthorize() {
    if (!isAddress(fAgent)) { setActionError(t('agents.invalidAgent')); return }
    setActionStatus('building')
    setActionError('')
    setActionTxHash(null)
    try {
      const maxPerTx = parseEthInput(fMaxPerTx)
      const dailyLimit = parseEthInput(fDailyLimit)
      const totalBudget = parseEthInput(fTotalBudget)
      const periodBudget = parseEthInput(fPeriodBudget)
      const periodDuration = fPeriodDays ? BigInt(Math.round(parseFloat(fPeriodDays) * 86400)) : 0n
      const expiry = fExpiry ? BigInt(Math.floor(new Date(fExpiry).getTime() / 1000)) : 0n

      // Compose what the selected capabilities entail, then merge with manual entries.
      const composed = composeFromCapabilities(network.chainId, fCaps)
      const lc = (a: string) => a.toLowerCase()

      const validTokenLimits = fTokenLimits.filter(t => isAddress(t.address))
      const dec = (a: string) => getTokenDecimals(a, network.tokens.usdc ?? null)
      const validTokens = validTokenLimits.map(t => t.address as Address)
      const tokenMaxAmounts = validTokenLimits.map(t => parseTokenAmount(t.maxPerTx, dec(t.address)))
      const tokenDailyLimits = validTokenLimits.map(t => parseTokenAmount(t.dailyLimit, dec(t.address)))
      const tokenTotalBudgets = validTokenLimits.map(t => parseTokenAmount(t.totalBudget, dec(t.address)))
      // Tokens a capability requires (e.g. WETH) that the user hasn't listed → add
      // with unlimited limits so the flow works; the user can tighten them later.
      const haveTokens = new Set(validTokens.map(lc))
      for (const tk of composed.requiredTokens) {
        if (!haveTokens.has(lc(tk))) {
          validTokens.push(tk); tokenMaxAmounts.push(0n); tokenDailyLimits.push(0n); tokenTotalBudgets.push(0n)
          haveTokens.add(lc(tk))
        }
      }

      // Protocols = manual ∪ composed (deduped).
      const manualProtocols = fProtocols.filter(p => isAddress(p)) as Address[]
      const seenP = new Set<string>()
      const validProtocols: Address[] = []
      for (const p of [...manualProtocols, ...composed.protocols]) {
        if (!seenP.has(lc(p))) { seenP.add(lc(p)); validProtocols.push(p) }
      }

      // Recipients: only meaningful when the whitelist is active. If the user added
      // any destination, fold in the contracts the capabilities need (Pool, Permit2,
      // routers — their approve is a Case-2b call). If empty, leave it empty (= any).
      const manualRecipients = fRecipients.filter(r => isAddress(r)) as Address[]
      let validRecipients: Address[] = []
      if (manualRecipients.length > 0) {
        const seenR = new Set<string>()
        for (const r of [...manualRecipients, ...composed.recipients]) {
          if (!seenR.has(lc(r))) { seenR.add(lc(r)); validRecipients.push(r) }
        }
      }

      const innerCallData = encodeFunctionData({
        abi: BVCC_AGENT_WALLET_ABI,
        functionName: 'authorizeAgent',
        args: [{
          agent: fAgent as Address,
          maxPerTxWei: maxPerTx,
          dailyLimitWei: dailyLimit,
          totalBudgetWei: totalBudget,
          periodBudgetWei: periodBudget,
          periodDuration,
          expiry,
          allowedTokens: validTokens,
          tokenMaxAmounts,
          tokenDailyLimits,
          tokenTotalBudgets,
          allowedProtocols: validProtocols,
          allowedRecipients: validRecipients,
        }],
      })

      // V3: bundle the required setCallPolicy calls for whitelisted protocols that have
      // presets (SwapRouter02, Aave Pool). Without these, every Case-3 call reverts
      // SelectorNotAllowed. One Face ID signature covers authorize + policies.
      const policyCalls = policyCallsFor(network.chainId, validProtocols)

      const txHash = await sendUserOp([innerCallData, ...policyCalls])
      setActionTxHash(txHash)
      setActionStatus('success')
      await settleAndReload(txHash)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('common.error'))
      setActionStatus('error')
    }
  }

  // ── Submit revoke ──────────────────────────────────────────────────────────
  async function handleRevoke(agentAddr: Address) {
    setActionStatus('building')
    setActionError('')
    setActionTxHash(null)
    try {
      const innerCallData = encodeFunctionData({
        abi: BVCC_AGENT_WALLET_ABI,
        functionName: 'revokeAgent',
        args: [agentAddr],
      })
      const txHash = await sendUserOp(innerCallData)
      setActionTxHash(txHash)
      setActionStatus('success')
      await settleAndReload(txHash)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('common.error'))
      setActionStatus('error')
    }
  }

  // ── Pause / unpause all agents ─────────────────────────────────────────────
  async function handlePauseToggle() {
    setPauseStatus('building')
    try {
      const fn = agentsPaused ? 'unpauseAgents' : 'pauseAgents'
      const innerCallData = encodeFunctionData({
        abi: BVCC_AGENT_WALLET_ABI,
        functionName: fn,
        args: [],
      })
      await sendUserOp(innerCallData)
      setAgentsPaused(!agentsPaused)
      setPauseStatus('idle')
    } catch (e) {
      console.error(e)
      setPauseStatus('idle')
    }
  }

  // ── Submit increase budget ─────────────────────────────────────────────────
  async function handleIncreaseBudget(agentAddr: Address) {
    const additional = parseEthInput(fIncrease)
    if (additional === 0n) { setActionError(t('agents.enterPositiveAmount')); return }
    setActionStatus('building')
    setActionError('')
    setActionTxHash(null)
    try {
      const innerCallData = encodeFunctionData({
        abi: BVCC_AGENT_WALLET_ABI,
        functionName: 'increaseBudget',
        args: [agentAddr, additional],
      })
      const txHash = await sendUserOp(innerCallData)
      setActionTxHash(txHash)
      setActionStatus('success')
      await settleAndReload(txHash)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('common.error'))
      setActionStatus('error')
    }
  }

  // ── Block if not agent wallet ──────────────────────────────────────────────
  if (wtLoading) {
    return (
      <div style={{ padding: '48px 32px', color: C.muted, fontSize: '14px' }}>
        {t('common.loading')}
      </div>
    )
  }

  if (walletType !== 1) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: '480px' }}>
        <div style={{ padding: '20px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: C.muted, lineHeight: '1.6' }}>
            La gestión de agentes solo está disponible en wallets de tipo <span style={{ color: C.gold }}>Agente IA</span>.
            Esta wallet es de tipo estándar.
          </p>
        </div>
      </div>
    )
  }

  function agentStatus(info: AgentInfo): { label: string; color: string } {
    const p = info.perm
    if (!p.active) return { label: t('agents.statusRevoked'), color: C.error }
    if (p.expiry > 0n && BigInt(now) >= p.expiry) return { label: t('agents.statusExpired'), color: C.subtle }
    if (p.totalBudgetWei > 0n && p.totalSpentWei >= p.totalBudgetWei) return { label: t('agents.statusBudgetDepleted'), color: C.warn }
    if (p.periodBudgetWei > 0n && p.periodDuration > 0n && p.periodSpentWei >= p.periodBudgetWei) {
      return { label: t('agents.statusPeriodDepleted'), color: C.warn }
    }
    return { label: t('agents.statusActive'), color: C.success }
  }

  function ProgressBar({ spent, limit, color }: { spent: bigint; limit: bigint; color: string }) {
    if (limit === 0n) return null
    const pct = Math.min(100, Number((spent * 100n) / limit))
    return (
      <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: pct >= 90 ? C.error : color, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
    )
  }

  function AgentCard({ info }: { info: AgentInfo }) {
    const p = info.perm
    const status = agentStatus(info)
    const isActive = status.label === t('agents.statusActive')
    const [revoking, setRevoking] = useState(false)
    const [editingAlias, setEditingAlias] = useState(false)
    const [aliasInput, setAliasInput] = useState('')
    const [picking, setPicking] = useState(false)
    const [, forceAvatar] = useState(0)
    const alias = aliases[info.address.toLowerCase()] ?? ''

    async function doRevoke() {
      setRevoking(true)
      await handleRevoke(info.address)
      setRevoking(false)
    }

    function startEditAlias() {
      setAliasInput(alias)
      setEditingAlias(true)
    }

    function commitAlias() {
      saveAlias(info.address, aliasInput.trim())
      setEditingAlias(false)
    }

    const periodSecondsLeft = p.periodDuration > 0n && p.periodStart > 0n
      ? Math.max(0, Number(p.periodStart + p.periodDuration) - now)
      : null

    function formatTimeRemaining(seconds: number): string {
      if (seconds <= 0) return t('agents.pendingRollover')
      const d = Math.floor(seconds / 86400)
      const h = Math.floor((seconds % 86400) / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      if (d > 0) return `${d}d ${h}h`
      if (h > 0) return `${h}h ${m}m`
      return `${m}m`
    }

    return (
      <div style={{
        backgroundColor: C.card, border: `1px solid ${C.border}`,
        borderRadius: '10px', padding: '20px',
        opacity: !p.active ? 0.65 : 1,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <AgentAvatar wallet={walletAddress ?? ''} agent={info.address} active={isActive} onPick={() => setPicking(v => !v)} size={56} />
            <div>
            {/* Alias */}
            {editingAlias ? (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                <input
                  autoFocus
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitAlias(); if (e.key === 'Escape') setEditingAlias(false) }}
                  placeholder={t('agents.agentNamePlaceholder')}
                  style={{
                    padding: '3px 8px', fontSize: '13px', fontWeight: '600',
                    backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${C.borderFocus}`,
                    borderRadius: '4px', color: C.text, outline: 'none', width: '140px',
                  }}
                />
                <button onClick={commitAlias} style={{ background: 'none', border: 'none', color: C.success, cursor: 'pointer', fontSize: '14px' }}>✓</button>
                <button onClick={() => setEditingAlias(false)} style={{ background: 'none', border: 'none', color: C.subtle, cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
            ) : (
              <div
                onClick={startEditAlias}
                style={{ fontSize: '14px', fontWeight: '600', color: alias ? C.text : C.subtle, marginBottom: '2px', cursor: 'pointer' }}
                title={t('agents.clickToEditAlias')}
              >
                {alias || t('agents.noName')}
                <span style={{ fontSize: '10px', color: C.subtle, marginLeft: '6px' }}>✎</span>
              </div>
            )}
            <div style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted, marginBottom: '4px' }}>
              {shortAddr(info.address)}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase',
              color: status.color, padding: '2px 8px', borderRadius: '4px',
              backgroundColor: `${status.color}18`,
              border: `1px solid ${status.color}30`,
            }}>
              {status.label}
            </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openAuthorize(info)}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: '500',
                backgroundColor: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: '5px', color: C.muted, cursor: 'pointer',
              }}
            >
              {t('agents.edit')}
            </button>
            {isActive && (
              <button
                onClick={doRevoke}
                disabled={revoking}
                style={{
                  padding: '6px 12px', fontSize: '12px', fontWeight: '500',
                  backgroundColor: 'transparent', border: '1px solid rgba(252,129,129,0.25)',
                  borderRadius: '5px', color: C.error, cursor: 'pointer',
                  opacity: revoking ? 0.5 : 1,
                }}
              >
                {revoking ? '...' : t('agents.revokeBtn')}
              </button>
            )}
          </div>
        </div>

        {picking && (
          <AgentAvatarPicker wallet={walletAddress ?? ''} agent={info.address} onClose={() => setPicking(false)} onSaved={() => forceAvatar(n => n + 1)} />
        )}

        {/* ETH Limits grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <Limit label={t('agents.maxPerTx')} value={p.maxPerTxWei > 0n ? `${formatEth(p.maxPerTxWei)} ETH` : t('agents.noLimit')} />
          <Limit label={t('agents.dailyLimit')} value={p.dailyLimitWei > 0n ? `${formatEth(p.dailyLimitWei)} ETH` : t('agents.noLimit')} />
        </div>

        {/* Daily spent bar */}
        {p.dailyLimitWei > 0n && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.spentToday')}</span>
              <span style={{ fontSize: '11px', color: C.muted }}>{formatEth(info.dailySpent)} / {formatEth(p.dailyLimitWei)} ETH</span>
            </div>
            <ProgressBar spent={info.dailySpent} limit={p.dailyLimitWei} color={C.gold} />
          </div>
        )}

        {/* Total budget */}
        {p.totalBudgetWei > 0n && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.totalBudget')}</span>
              <span style={{ fontSize: '11px', color: C.muted }}>{formatEth(p.totalSpentWei)} / {formatEth(p.totalBudgetWei)} ETH</span>
            </div>
            <ProgressBar spent={p.totalSpentWei} limit={p.totalBudgetWei} color={C.gold} />
          </div>
        )}

        {/* Period budget */}
        {p.periodBudgetWei > 0n && p.periodDuration > 0n && (
          <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '11px', color: C.subtle }}>
                {t('agents.period')} ({Math.round(Number(p.periodDuration) / 86400)}d)
              </span>
              <span style={{ fontSize: '11px', color: C.muted }}>{formatEth(p.periodSpentWei)} / {formatEth(p.periodBudgetWei)} ETH</span>
            </div>
            <ProgressBar spent={p.periodSpentWei} limit={p.periodBudgetWei} color={C.gold} />
            {periodSecondsLeft !== null && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: C.subtle }}>
                {t('agents.nextReset')}<span style={{ color: C.muted }}>{formatTimeRemaining(periodSecondsLeft)}</span>
              </div>
            )}
          </div>
        )}

        {/* Tokens con límites */}
        {p.allowedTokens.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {t('agents.authorizedTokens')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {p.allowedTokens.map((tokenAddr, i) => {
                const decimals = getTokenDecimals(tokenAddr, network.tokens.usdc)
                const maxTx = p.tokenMaxAmounts[i]
                const daily = p.tokenDailyLimits?.[i] ?? 0n
                const total = p.tokenTotalBudgets?.[i] ?? 0n
                const symbol = getTokenLabel(tokenAddr, network)
                const spent = info.tokenSpent[tokenAddr.toLowerCase()]
                return (
                  <div key={tokenAddr} style={{
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: '6px', border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: C.gold, fontWeight: '600', minWidth: '50px' }}>
                        {symbol}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: C.subtle, flex: 1, marginLeft: '8px' }}>
                        {shortAddr(tokenAddr)}
                      </span>
                      <span style={{ fontSize: '11px', color: C.muted }}>
                        {t('agents.maxPerTxShort')}: {maxTx > 0n ? formatTokenAmount(maxTx, decimals) : '∞'}
                      </span>
                    </div>

                    {/* Daily spent bar */}
                    {daily > 0n && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.dailyShort')}</span>
                          <span style={{ fontSize: '11px', color: C.muted }}>
                            {formatTokenAmount(spent?.daily ?? 0n, decimals)} / {formatTokenAmount(daily, decimals)} {symbol}
                          </span>
                        </div>
                        <ProgressBar spent={spent?.daily ?? 0n} limit={daily} color={C.gold} />
                      </div>
                    )}

                    {/* Total budget bar */}
                    {total > 0n && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.totalShort')}</span>
                          <span style={{ fontSize: '11px', color: C.muted }}>
                            {formatTokenAmount(spent?.total ?? 0n, decimals)} / {formatTokenAmount(total, decimals)} {symbol}
                          </span>
                        </div>
                        <ProgressBar spent={spent?.total ?? 0n} limit={total} color={C.gold} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Plain-language capability line — what this agent can actually do */}
        {(() => {
          const caps = capabilitiesFromProtocols(network.chainId, [...p.allowedProtocols] as Address[])
          if (caps.length === 0) return null
          return (
            <div style={{ marginBottom: '8px', fontSize: '11px', color: C.muted }}>
              <span style={{ color: C.subtle }}>{t('agents.cap.canDo')} </span>
              {caps.map(id => t(`agents.cap.chip.${id}`)).join(' · ')}
            </div>
          )
        })()}

        {/* Protocols (addresses, clickable to verify on the explorer) */}
        {p.allowedProtocols.length > 0 && (
          <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.protocols')}</span>
            {p.allowedProtocols.map(pr => (
              <ExplorerAddress key={pr} addr={pr} explorerBase={network.blockExplorer.url} tab="code" short />
            ))}
          </div>
        )}

        {/* Recipients whitelist */}
        {p.allowedRecipients.length > 0 && (
          <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: C.subtle }}>{t('agents.ethRecipients')}</span>
            {p.allowedRecipients.map(r => (
              <ExplorerAddress key={r} addr={r} explorerBase={network.blockExplorer.url} tab="code" short />
            ))}
          </div>
        )}

        {/* Expiry */}
        {p.expiry > 0n && (
          <div style={{ fontSize: '11px', color: C.subtle }}>
            {t('agents.expires')}<span style={{ color: C.muted }}>{new Date(Number(p.expiry) * 1000).toLocaleDateString()}</span>
          </div>
        )}

        {/* Increase budget button */}
        {isActive && p.totalBudgetWei > 0n && (
          <button
            onClick={() => openIncrease(info)}
            style={{
              marginTop: '14px', padding: '7px 14px', fontSize: '12px',
              backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`,
              borderRadius: '5px', color: C.gold, cursor: 'pointer', fontWeight: '500',
            }}
          >
            {t('agents.increaseBudgetBtn')}
          </button>
        )}
      </div>
    )
  }

  function Limit({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <div style={{ fontSize: '10px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: C.muted }}>{value}</div>
      </div>
    )
  }

  function AddressListInput({
    items, onAdd, onRemove, input, setInput, placeholder, suggestions, onChain, alsoStaged,
  }: {
    items: string[]
    onAdd: (v: string) => void
    onRemove: (i: number) => void
    input: string
    setInput: (v: string) => void
    placeholder: string
    suggestions?: { label: string; address: string }[]
    /** Addresses already accepted on-chain (lowercased) — shown green vs blue-staged. */
    onChain?: Set<string>
    /** Addresses staged via a selected capability (not in `items`) — count as staged. */
    alsoStaged?: Set<string>
  }) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (isAddress(input)) { onAdd(input); setInput('') }
              }
            }}
            placeholder={placeholder}
            style={inputStyle}
          />
          <button
            onClick={() => { if (isAddress(input)) { onAdd(input); setInput('') } }}
            disabled={!isAddress(input)}
            style={{
              padding: '9px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`,
              borderRadius: '6px', color: C.gold, cursor: isAddress(input) ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: '600', opacity: isAddress(input) ? 1 : 0.4, flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
        {suggestions && suggestions.length > 0 && (
          // Green = already accepted on-chain; blue = staged in this form (not yet
          // signed); gold = available, click to add.
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {suggestions.map(s => {
              const key = s.address.toLowerCase()
              const staged = items.some(it => it.toLowerCase() === key) || (alsoStaged?.has(key) ?? false)
              const onchain = onChain?.has(key) ?? false
              const color = staged ? (onchain ? C.success : C.info) : C.gold
              const bg = staged ? (onchain ? 'rgba(104,211,145,0.12)' : 'rgba(99,179,237,0.12)') : C.goldDim
              const border = staged ? (onchain ? C.success : C.info) : C.goldBorder
              return (
                <button
                  key={s.address}
                  onClick={staged ? undefined : () => onAdd(s.address)}
                  title={onchain ? `${s.address} (accepted on-chain)` : s.address}
                  style={{
                    padding: '3px 10px', fontSize: '11px',
                    backgroundColor: bg, border: `1px solid ${border}`,
                    borderRadius: '4px', color, cursor: staged ? 'default' : 'pointer',
                  }}
                >
                  {staged ? (onchain ? '✓ ' : '• ') : ''}{s.label}
                </button>
              )
            })}
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: C.muted, flex: 1 }}>{item}</span>
            <button
              onClick={() => onRemove(i)}
              style={{ background: 'transparent', border: 'none', color: C.error, cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )
  }

  // ── Token Limits Input ─────────────────────────────────────────────────────
  function TokenLimitsInput() {
    const usdcAddr = network.tokens.usdc ?? null

    function addToken(address: string) {
      if (!isAddress(address)) return
      if (fTokenLimits.some(t => t.address.toLowerCase() === address.toLowerCase())) return
      setFTokenLimits(prev => [...prev, { address, maxPerTx: '', dailyLimit: '', totalBudget: '' }])
      setFTokenInput('')
    }

    function removeToken(i: number) {
      setFTokenLimits(prev => prev.filter((_, idx) => idx !== i))
    }

    function updateToken(i: number, field: keyof Omit<TokenLimitForm, 'address'>, value: string) {
      setFTokenLimits(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
    }

    const knownTokens = [
      ...(network.tokens.usdc ? [{ label: 'USDC', address: network.tokens.usdc }] : []),
      { label: 'WETH', address: network.tokens.weth },
    ]

    return (
      <div>
        {/* Input + add */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            value={fTokenInput}
            onChange={e => setFTokenInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToken(fTokenInput) } }}
            placeholder="0x... token address"
            style={inputStyle}
          />
          <button
            onClick={() => addToken(fTokenInput)}
            disabled={!isAddress(fTokenInput)}
            style={{
              padding: '9px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`,
              borderRadius: '6px', color: C.gold, cursor: isAddress(fTokenInput) ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: '600', opacity: isAddress(fTokenInput) ? 1 : 0.4, flexShrink: 0,
            }}
          >
            +
          </button>
        </div>

        {/* Quick-add: green = on-chain, blue = staged this form, gold = click to add. */}
        {knownTokens.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {knownTokens.map(s => {
              const key = s.address.toLowerCase()
              const staged = fTokenLimits.some(t => t.address.toLowerCase() === key)
              const onchain = onChainBaseline.tokens.has(key)
              const color = staged ? (onchain ? C.success : C.info) : C.gold
              const bg = staged ? (onchain ? 'rgba(104,211,145,0.12)' : 'rgba(99,179,237,0.12)') : C.goldDim
              const border = staged ? (onchain ? C.success : C.info) : C.goldBorder
              return (
                <button
                  key={s.address}
                  onClick={staged ? undefined : () => addToken(s.address)}
                  title={onchain ? `${s.address} (accepted on-chain)` : s.address}
                  style={{
                    padding: '3px 10px', fontSize: '11px',
                    backgroundColor: bg, border: `1px solid ${border}`,
                    borderRadius: '4px', color, cursor: staged ? 'default' : 'pointer',
                  }}
                >
                  {staged ? (onchain ? '✓ ' : '• ') : ''}{s.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Token entries */}
        {fTokenLimits.map((tok, i) => {
          const label = getTokenLabel(tok.address, network)
          const decimals = getTokenDecimals(tok.address, usdcAddr)
          const unit = decimals === 6 ? 'USDC' : decimals === 18 ? label : 'tokens'
          return (
            <div key={i} style={{
              marginBottom: '10px', padding: '12px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: `1px solid ${C.border}`, borderRadius: '8px',
            }}>
              {/* Token header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: C.gold }}>{label}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: C.subtle }}>{shortAddr(tok.address)}</span>
                </div>
                <button onClick={() => removeToken(i)} style={{
                  background: 'transparent', border: 'none', color: C.error,
                  cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1,
                }}>×</button>
              </div>

              {/* Token limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>{t('agents.tokenMaxTx')} ({unit})</label>
                  <input
                    type="text"
                    value={tok.maxPerTx}
                    onChange={e => updateToken(i, 'maxPerTx', e.target.value)}
                    placeholder={t('agents.unlimitedPlaceholder')}
                    style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>{t('agents.tokenDailyLimit')} ({unit})</label>
                  <input
                    type="text"
                    value={tok.dailyLimit}
                    onChange={e => updateToken(i, 'dailyLimit', e.target.value)}
                    placeholder={t('agents.unlimitedPlaceholder')}
                    style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: '10px' }}>{t('agents.tokenTotal')} ({unit})</label>
                  <input
                    type="text"
                    value={tok.totalBudget}
                    onChange={e => updateToken(i, 'totalBudget', e.target.value)}
                    placeholder={t('agents.unlimitedPlaceholder')}
                    style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    backgroundColor: C.card, border: `1px solid ${C.border}`,
    borderRadius: '6px', color: C.text, fontSize: '13px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: C.subtle,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    display: 'block', marginBottom: '6px',
  }

  const knownProtocolSuggestions = (() => {
    const list: { label: string; address: Address }[] = []
    if (network.uniswap) list.push({ label: 'Uniswap SwapRouter', address: network.uniswap.swapRouter })
    // V3 preset protocols (SwapRouter02 / Universal Router / Aave) — deduped by address.
    for (const s of presetProtocolSuggestions(network.chainId)) {
      if (!list.some(x => x.address.toLowerCase() === s.address.toLowerCase())) list.push(s)
    }
    return list
  })()

  // Protocols/recipients the selected capabilities compose (managed by the picker,
  // not the manual lists). Used so a preset chip shows as staged (blue/green), not
  // gold, when a capability already pulls it in.
  const composedFromCaps = composeFromCapabilities(network.chainId, fCaps)
  const composedProtoSet = new Set(composedFromCaps.protocols.map(a => a.toLowerCase()))
  const composedRecipSet = new Set(composedFromCaps.recipients.map(a => a.toLowerCase()))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px' }}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: ${C.borderFocus} !important; }
        .agent-btn:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {t('agents.title')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>
            {t('agents.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {pauseSupported && (
          <button
            onClick={handlePauseToggle}
            disabled={pauseStatus === 'building' || pauseStatus === 'signing' || pauseStatus === 'sending'}
            className="agent-btn"
            title={agentsPaused ? t('agents.resumeAllTitle') : t('agents.pauseAllTitle')}
            style={{
              padding: '10px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              borderRadius: '6px', border: agentsPaused ? '1px solid rgba(104,211,145,0.4)' : '1px solid rgba(252,129,129,0.35)',
              backgroundColor: agentsPaused ? 'rgba(104,211,145,0.08)' : 'rgba(252,129,129,0.08)',
              color: agentsPaused ? C.success : C.error,
              opacity: ['building','signing','sending'].includes(pauseStatus) ? 0.6 : 1,
            }}
          >
            {['building','signing','sending'].includes(pauseStatus) ? '...' : agentsPaused ? t('agents.resumeAll') : t('agents.pauseAll')}
          </button>
          )}
          <button
            onClick={() => openAuthorize()}
            className="agent-btn"
            style={{
              padding: '10px 18px', backgroundColor: C.gold,
              border: 'none', borderRadius: '6px',
              color: '#000', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            {t('agents.authorizeAgent')}
          </button>
        </div>
      </div>

      {/* Pause banner */}
      {agentsPaused && (
        <div style={{
          padding: '12px 16px', marginBottom: '20px',
          backgroundColor: 'rgba(252,129,129,0.06)', border: '1px solid rgba(252,129,129,0.25)',
          borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '16px' }}>⏸</span>
          <p style={{ margin: 0, fontSize: '13px', color: C.error, lineHeight: '1.4' }}>
            <strong>{t('agents.pausedBanner')}</strong> {t('agents.pausedBannerDetail')}
          </p>
        </div>
      )}

      {/* Action feedback (outside modals) */}
      {actionStatus === 'success' && actionTxHash && modal.type === 'none' && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.2)', borderRadius: '6px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: C.success }}>✓ {t('agents.txSent')}</span>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted }}>{shortAddr(actionTxHash)}</span>
        </div>
      )}

      {/* Agent list */}
      {loadingAgents ? (
        <div style={{ color: C.muted, fontSize: '14px' }}>{t('agents.loadingAgents')}</div>
      ) : loadError ? (
        <div style={{ color: C.error, fontSize: '13px' }}>{loadError}</div>
      ) : agents.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '10px' }}>
          <p style={{ color: C.muted, fontSize: '14px', margin: 0 }}>{t('agents.noAgents')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {agents.map(info => <AgentCard key={info.address} info={info} />)}
        </div>
      )}

      {/* ── Agent disclaimer (standalone overlay) ───────────────────────────── */}
      {modal.type === 'agentDisclaimer' && (
        <DisclaimerModal
          title={t('disclaimer.agentTitle')}
          intro={t('disclaimer.agentIntro')}
          checkboxes={[
            t('disclaimer.agentCb1'),
            t('disclaimer.agentCb2'),
            t('disclaimer.agentCb3'),
            t('disclaimer.agentCb4'),
            t('disclaimer.agentCb5'),
          ]}
          confirmLabel={t('disclaimer.confirm')}
          finalCheckboxLabel={t('disclaimer.agentConfirmCheck')}
          linksLabel={t('legal.readMore')}
          links={[
            { label: t('legal.nav.agent'), href: '/legal/agent-wallet' },
            { label: t('legal.nav.risk'), href: '/legal/risk-disclosure' },
            { label: t('legal.nav.fees'), href: '/legal/fees' },
          ]}
          onClose={() => setModal({ type: 'none' })}
          onAccept={() => {
            localStorage.setItem('bvcc_agent_disclaimer_accepted', 'true')
            openAuthorize()
          }}
        />
      )}

      {/* ── Modal overlay ───────────────────────────────────────────────────── */}
      {(modal.type === 'authorize' || modal.type === 'increase') && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', zIndex: 100,
          }}
        >
          <div style={{
            backgroundColor: C.bg, border: `1px solid ${C.border}`,
            borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto',
          }}>

            {/* ── Authorize / Edit form ────────────────────────────────────── */}
            {modal.type === 'authorize' && (
              <>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: C.text, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
                  {modal.editAgent ? t('agents.modalEditTitle') : t('agents.modalAuthorizeTitle')}
                </h2>
                {modal.editAgent && (
                  <div style={{ padding: '10px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: '6px', marginBottom: '16px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: C.muted, lineHeight: '1.5' }}>
                      {t('agents.editNote')} <span style={{ fontFamily: 'monospace', color: C.gold }}>authorizeAgent()</span>.{' '}
                      {t('agents.editNotePreserves')} <strong style={{ color: C.text }}>{t('agents.editNotePreservesStrong')}</strong> {t('agents.editNoteAuto')}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Agent address */}
                  <div>
                    <label style={labelStyle}>{t('agents.agentAddress')}</label>
                    <input
                      type="text"
                      value={fAgent}
                      onChange={e => setFAgent(e.target.value)}
                      placeholder="0x..."
                      disabled={!!modal.editAgent}
                      style={{ ...inputStyle, fontFamily: 'monospace', opacity: modal.editAgent ? 0.6 : 1 }}
                    />
                  </div>

                  {/* ETH Limits */}
                  <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                      {t('agents.ethLimits')}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={labelStyle}>{t('agents.maxPerTxLabel')}</label>
                        <input type="text" value={fMaxPerTx} onChange={e => setFMaxPerTx(e.target.value)} placeholder="0" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t('agents.dailyLimitLabel')}</label>
                        <input type="text" value={fDailyLimit} onChange={e => setFDailyLimit(e.target.value)} placeholder="0" style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('agents.totalBudgetLabel')}</label>
                      <input type="text" value={fTotalBudget} onChange={e => setFTotalBudget(e.target.value)} placeholder="0" style={inputStyle} />
                    </div>
                  </div>

                  {/* Period budget */}
                  <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                      {t('agents.renewableBudget')}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>{t('agents.perPeriod')}</label>
                        <input type="text" value={fPeriodBudget} onChange={e => setFPeriodBudget(e.target.value)} placeholder={t('agents.disabledPlaceholder')} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>{t('agents.durationDays')}</label>
                        <input type="text" value={fPeriodDays} onChange={e => setFPeriodDays(e.target.value)} placeholder={t('agents.disabledPlaceholder')} style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* Capability picker — the guided way to compose config */}
                  {agentCapabilitiesFor(network.chainId).length > 0 && (
                    <CapabilityPicker
                      chainId={network.chainId}
                      explorerBase={network.blockExplorer.url}
                      selected={fCaps}
                      onChange={setFCaps}
                    />
                  )}

                  {/* Manual / advanced — always available */}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '14px', marginTop: '2px' }}>
                    <p style={{ fontSize: '11px', color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 4px' }}>
                      {t('agents.cap.manualSectionTitle')}
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: '12px', color: C.subtle, lineHeight: 1.5 }}>
                      {t('agents.cap.manualSectionHint')}
                    </p>
                  </div>

                  {/* Tokens */}
                  <div>
                    <label style={labelStyle}>{t('agents.allowedTokens')}</label>
                    <TokenLimitsInput />
                  </div>

                  {/* Protocols (extra, hand-added) */}
                  <div>
                    <label style={labelStyle}>{t('agents.allowedProtocols')}</label>
                    <AddressListInput
                      items={fProtocols}
                      onAdd={v => setFProtocols(prev => [...prev, v])}
                      onRemove={i => setFProtocols(prev => prev.filter((_, idx) => idx !== i))}
                      input={fProtocolInput}
                      setInput={setFProtocolInput}
                      placeholder="0x... protocol address"
                      suggestions={knownProtocolSuggestions}
                      onChain={onChainBaseline.protocols}
                      alsoStaged={composedProtoSet}
                    />
                  </div>

                  {/* Recipients whitelist */}
                  <div>
                    <label style={labelStyle}>{t('agents.ethRecipientsLabel')}</label>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: C.subtle, lineHeight: '1.4' }}>
                      {t('agents.ethRecipientsHint')}
                    </p>
                    <AddressListInput
                      items={fRecipients}
                      onAdd={v => setFRecipients(prev => [...prev, v])}
                      onRemove={i => setFRecipients(prev => prev.filter((_, idx) => idx !== i))}
                      input={fRecipientInput}
                      setInput={setFRecipientInput}
                      placeholder="0x... recipient address"
                      onChain={onChainBaseline.recipients}
                    />
                  </div>

                  {/* Expiry */}
                  <div>
                    <label style={labelStyle}>{t('agents.expiry')}</label>
                    <input
                      type="datetime-local"
                      value={fExpiry}
                      onChange={e => setFExpiry(e.target.value)}
                      style={{ ...inputStyle, colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Action feedback */}
                {actionError && (
                  <p style={{ fontSize: '12px', color: C.error, margin: '14px 0 0' }}>{actionError}</p>
                )}
                {actionStatus === 'success' && actionTxHash && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.2)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: C.success }}>✓ TX: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted }}>{shortAddr(actionTxHash)}</span>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1, padding: '12px', backgroundColor: 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: '6px',
                      color: C.muted, fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleAuthorize}
                    disabled={actionStatus === 'building' || actionStatus === 'signing' || actionStatus === 'sending'}
                    className="agent-btn"
                    style={{
                      flex: 2, padding: '12px', backgroundColor: C.gold,
                      border: 'none', borderRadius: '6px',
                      color: '#000', fontSize: '14px', fontWeight: '600',
                      cursor: 'pointer',
                      opacity: ['building', 'signing', 'sending'].includes(actionStatus) ? 0.7 : 1,
                    }}
                  >
                    {actionStatus === 'building' ? t('agents.preparing') :
                     actionStatus === 'signing' ? t('agents.faceId') :
                     actionStatus === 'sending' ? t('agents.sending') :
                     modal.editAgent ? t('agents.saveChanges') : t('agents.authorize')}
                  </button>
                </div>
              </>
            )}

            {/* ── Increase budget modal ────────────────────────────────────── */}
            {modal.type === 'increase' && (
              <>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                  {t('agents.modalIncreaseTitle')}
                </h2>
                <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 20px' }}>
                  {shortAddr(modal.agent.address)}
                </p>

                <div style={{ padding: '14px', backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: C.subtle }}>{t('agents.currentTotal')}</span>
                    <span style={{ fontSize: '12px', color: C.muted }}>{formatEth(modal.agent.perm.totalBudgetWei)} ETH</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: C.subtle }}>{t('agents.spent')}</span>
                    <span style={{ fontSize: '12px', color: C.muted }}>{formatEth(modal.agent.perm.totalSpentWei)} ETH</span>
                  </div>
                  {fIncrease && parseEthInput(fIncrease) > 0n && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: '12px', color: C.subtle }}>{t('agents.newTotal')}</span>
                      <span style={{ fontSize: '12px', color: C.gold }}>
                        {formatEth(modal.agent.perm.totalBudgetWei + parseEthInput(fIncrease))} ETH
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={labelStyle}>{t('agents.additionalAmount')}</label>
                  <input
                    type="text"
                    value={fIncrease}
                    onChange={e => setFIncrease(e.target.value)}
                    placeholder="0.5"
                    style={inputStyle}
                    autoFocus
                  />
                </div>

                <p style={{ fontSize: '11px', color: C.subtle, margin: '0 0 16px', lineHeight: '1.5' }}>
                  {t('agents.increaseNote')} <strong style={{ color: C.text }}>{t('agents.increaseNoteStrong')}</strong> {t('agents.increaseNoteEnd')}
                </p>

                {actionError && (
                  <p style={{ fontSize: '12px', color: C.error, margin: '0 0 12px' }}>{actionError}</p>
                )}
                {actionStatus === 'success' && actionTxHash && (
                  <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.2)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '12px', color: C.success }}>✓ TX: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted }}>{shortAddr(actionTxHash)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1, padding: '12px', backgroundColor: 'transparent',
                      border: `1px solid ${C.border}`, borderRadius: '6px',
                      color: C.muted, fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => handleIncreaseBudget(modal.agent.address)}
                    disabled={actionStatus === 'building' || actionStatus === 'signing' || actionStatus === 'sending'}
                    className="agent-btn"
                    style={{
                      flex: 2, padding: '12px', backgroundColor: C.gold,
                      border: 'none', borderRadius: '6px',
                      color: '#000', fontSize: '14px', fontWeight: '600',
                      cursor: 'pointer',
                      opacity: ['building', 'signing', 'sending'].includes(actionStatus) ? 0.7 : 1,
                    }}
                  >
                    {actionStatus === 'building' ? t('agents.preparing') :
                     actionStatus === 'signing' ? t('agents.faceId') :
                     actionStatus === 'sending' ? t('agents.sending') :
                     t('agents.modalIncreaseTitle')}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
