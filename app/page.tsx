'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAddress, createPublicClient, http, formatEther, type Address } from 'viem'
import {
  useConnect,
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSendTransaction,
} from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { registerWebAuthn, saveCredential, hasCredential, credentialIdToBytes } from '@/lib/webauthn'
import { getWalletAddress, getAgentWalletAddress, getCredentialIdFromChain } from '@/lib/wallet'
import { validateGuardians, ZERO_ADDRESS } from '@/lib/guardianValidation'
import { BVCC_WALLET_FACTORY_ABI, BVCC_AGENT_WALLET_FACTORY_ABI, BVCC_WALLET_ABI } from '@/lib/abis'
import { executeWithFaceId } from '@/lib/executeUserOp'
import { useSubmitUserOp } from '@/lib/useSubmitUserOp'
import { getPrefundNeed } from '@/lib/prefund'
import { encodeFunctionData } from 'viem'
import { useNetwork } from '@/lib/NetworkContext'
import { NETWORKS } from '@/lib/networks'
import MarketingLanding from '@/components/MarketingLanding'
import DisclaimerModal from '@/components/DisclaimerModal'
import { useI18n } from '@/lib/i18n/I18nContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'

type Step = 'landing' | 'access' | 'network' | 'walletType' | 'guardians' | 'confirm'

interface RegistrationData {
  pubKeyX: bigint
  pubKeyY: bigint
  credentialId: string
}

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
}

function shortAddr(addr: string) {
  return addr.length >= 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr
}

export default function Home() {
  const router = useRouter()
  const { t } = useI18n()
  const { network, setNetworkByChainId } = useNetwork()
  const [walletExists, setWalletExists] = useState(false)
  const [step, setStep] = useState<Step>('landing')

  // Deep link used by the outdated-wallet banner: land on the access screen instead of
  // the marketing page, so "create a V4 wallet" does not bounce the user to the front door.
  // Read from the browser rather than useSearchParams, which would force this page behind
  // a Suspense boundary and break the static prerender.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('step') === 'access') setStep('access')

    // Migration from an older generation, reusing the SAME passkey. The wallet address
    // derives from the public key, so keeping the key means the new address is knowable
    // in advance, identical on every network, and there is no second credential to back
    // up. Everything downstream — deploy, then the signed setGuardians — is the ordinary
    // creation path; only the key's origin differs, and no new passkey is registered.
    if (params.get('migrate') === '1') {
      (async () => {
        try {
          const stored = JSON.parse(localStorage.getItem('bvcc_wallet_credential') || '{}')
          const oldWallet: Address | null = stored?.walletAddress || localStorage.getItem('bvcc_active_wallet')
          if (!oldWallet || !stored?.credentialId) throw new Error('No active wallet to migrate')

          const { createPublicClient, http } = await import('viem')
          const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
          const [qx, qy] = await client.readContract({
            address: oldWallet as Address, abi: BVCC_WALLET_ABI, functionName: 'signer',
          }) as readonly [`0x${string}`, `0x${string}`]

          const wType = await client.readContract({
            address: oldWallet as Address,
            abi: [{ type: 'function', name: 'walletType', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }],
            functionName: 'walletType',
          }).catch(() => 0)

          // Carry the existing guardians over so the user is not asked to invent them
          // again; they can still edit them on the confirm screen before signing.
          const g = await Promise.all([0n, 1n, 2n].map(i =>
            client.readContract({ address: oldWallet as Address, abi: BVCC_WALLET_ABI, functionName: 'guardians', args: [i] })
              .catch(() => null),
          )) as (string | null)[]

          setRegData({ pubKeyX: BigInt(qx), pubKeyY: BigInt(qy), credentialId: stored.credentialId })
          setSelectedWalletType(wType === 1 ? 'agent' : 'standard')
          // Una wallet cuyos guardianes nunca se registraron devuelve tres
          // direcciones cero, que son cadenas y por tanto "truthy": se daban por
          // buenas y la migración saltaba a confirmar con tres ceros dentro,
          // saltándose el paso —y la validación— del formulario. El
          // `setGuardians` de después revertiría con InvalidGuardian, ya con el
          // despliegue pagado.
          const puestos = g.every(x => x && x.toLowerCase() !== ZERO_ADDRESS)
          if (puestos) setGuardians([g[0]!, g[1]!, g[2]!])
          setStep(puestos ? 'confirm' : 'guardians')
        } catch {
          setStep('access')
        }
      })()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regData, setRegData] = useState<RegistrationData | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [setupPhase, setSetupPhase] = useState<'idle' | 'funding' | 'signing'>('idle')
  const submitUserOp = useSubmitUserOp()
  const [guardians, setGuardians] = useState<[string, string, string]>(['', '', ''])
  const [addressInput, setAddressInput] = useState('')
  const [addressFocused, setAddressInputFocused] = useState(false)
  const [selectedWalletType, setSelectedWalletType] = useState<'standard' | 'agent'>('standard')
  const [wcUri, setWcUri] = useState<string | null>(null)
  const [disclaimerModal, setDisclaimerModal] = useState<'general' | 'agentInline' | null>(null)

  // Wagmi hooks — deploy flow
  const { connect, connectors } = useConnect()
  const { address: connectedAddress, chainId: connectedChainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const {
    writeContract,
    data: deployTxHash,
    isPending: isDeploying,
    error: deployError,
    reset: resetDeploy,
  } = useWriteContract()
  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({ hash: deployTxHash })
  const { sendTransactionAsync } = useSendTransaction()

  // La dirección que va a tener esta wallet: sale del par de claves, así que se
  // conoce antes de desplegar. Sirve para lo único que el contrato no puede
  // comprobar por su cuenta — que nadie se ponga a sí mismo de guardián.
  const [futureAddress, setFutureAddress] = useState<Address | null>(null)
  useEffect(() => {
    if (!regData) return
    let cancelled = false
    const resolver = selectedWalletType === 'agent'
      ? getAgentWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
      : getWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
    resolver
      .then(addr => { if (!cancelled) setFutureAddress(addr) })
      .catch(() => { /* sin ella se pierde un aviso, no el alta */ })
    return () => { cancelled = true }
  }, [regData, selectedWalletType, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardianCheck = validateGuardians(guardians, {
    walletAddress: futureAddress,
    connectedAddress,
  })

  // What the wallet will need for its own first signature, shown on the confirm screen so
  // the second MetaMask prompt is expected rather than a surprise.
  const [prefundHint, setPrefundHint] = useState<bigint | null>(null)
  useEffect(() => {
    if (step !== 'confirm' || !regData) return
    let cancelled = false
    const resolver = selectedWalletType === 'agent'
      ? getAgentWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
      : getWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
    resolver
      .then(addr => getPrefundNeed(addr, network))
      .then(need => { if (!cancelled) setPrefundHint(need.missing) })
      .catch(() => { /* the deploy screen works fine without the hint */ })
    return () => { cancelled = true }
  }, [step, regData, selectedWalletType, network.chainId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setWalletExists(hasCredential()) }, [])

  // Auto-close the WalletConnect QR modal once an account connects
  useEffect(() => {
    if (connectedAddress && wcUri) setWcUri(null)
  }, [connectedAddress, wcUri])

  // After tx confirmed: compute address, save credential, then register guardians and
  // the credential on-chain with the passkey. The wallet is deployed but unconfigured
  // until this second, signed step lands — which is exactly what makes the deployment
  // race harmless: whoever wins it cannot set the guardians.
  useEffect(() => {
    if (!isTxConfirmed || !regData) return
    const resolver = selectedWalletType === 'agent'
      ? getAgentWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
      : getWalletAddress(regData.pubKeyX, regData.pubKeyY, network)
    resolver.then(async walletAddress => {
      saveCredential(regData.credentialId, walletAddress)
      localStorage.setItem('bvcc_guardians', JSON.stringify(guardians))
      setConfiguring(true)

      // Leave the wallet able to pay for the signature that comes next. setGuardians
      // travels as a userOp and the EntryPoint charges the prefund to the account, not to
      // whoever relays it — so a wallet that was just created, holding nothing, fails
      // validation with AA21 before its call ever runs. Funding it here is what makes the
      // second step possible at all; it is the user's own money, in their own wallet.
      try {
        setSetupPhase('funding')
        const { missing } = await getPrefundNeed(walletAddress, network)
        if (missing > 0n) {
          const hash = await sendTransactionAsync({
            to: walletAddress, value: missing, chainId: network.chainId,
          })
          const client = createPublicClient({ chain: network.viemChain, transport: http(network.rpcUrl) })
          await client.waitForTransactionReceipt({ hash })
        }
      } catch {
        // Declined, or the transfer failed. Try the signature anyway — the wallet may
        // already have funds from elsewhere — and let the catch below handle the fallout.
      }

      try {
        setSetupPhase('signing')
        await registerRecovery(walletAddress, regData.credentialId)
        router.push('/wallet')
      } catch (err) {
        // The wallet exists and is the user's; only the recovery setup failed. Send them
        // in anyway and let the wallet prompt for it rather than trapping them here.
        setConfiguring(false)
        setError(err instanceof Error ? err.message : String(err))
        localStorage.setItem('bvcc_pending_guardians', JSON.stringify(guardians))
        router.push('/wallet')
      }
    })
  }, [isTxConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  /// Registers guardians + credential in one passkey-signed self-call.
  async function registerRecovery(walletAddress: Address, credentialId: string) {
    const callData = encodeFunctionData({
      abi: BVCC_WALLET_ABI,
      functionName: 'setGuardians',
      args: [guardians as [Address, Address, Address], credentialIdToBytes(credentialId)],
    })
    await executeWithFaceId({
      network,
      walletAddress,
      credentialId,
      calls: [{ target: walletAddress, value: 0n, callData }],
      submitUserOp,
    })
  }

  async function handleCreateWallet() {
    setError(null)
    setLoading(true)
    try {
      const label = 'BVCC-' + Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      const data = await registerWebAuthn(label)
      setRegData(data)
      setStep('network')
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : t('appshell.accessCreateError'))
    } finally {
      setLoading(false)
    }
  }

  function requestCreateWallet() {
    if (typeof window !== 'undefined' && localStorage.getItem('bvcc_disclaimer_accepted') === 'true') {
      handleCreateWallet()
    } else {
      setDisclaimerModal('general')
    }
  }

  async function handleEnterAddress() {
    if (!isAddress(addressInput)) {
      setError(t('appshell.accessInvalidAddress'))
      return
    }
    localStorage.setItem('bvcc_active_wallet', addressInput)
    // Intentar recuperar credentialId de la chain si no está en localStorage
    const stored = localStorage.getItem('bvcc_wallet_credential')
    const parsed = stored ? JSON.parse(stored) : null
    if (!parsed?.credentialId || parsed?.walletAddress?.toLowerCase() !== addressInput.toLowerCase()) {
      const credId = await getCredentialIdFromChain(addressInput as Address, network)
      if (credId) {
        localStorage.setItem('bvcc_wallet_credential', JSON.stringify({ credentialId: credId, walletAddress: addressInput }))
      }
    }
    router.push('/wallet')
  }

  function handleGuardiansNext() {
    if (guardianCheck.errorKey) { setError(t(guardianCheck.errorKey)); return }
    setError(null)
    resetDeploy()
    setStep('confirm')
  }

  async function handleDeploy() {
    if (!regData) return
    // Se vuelve a validar aquí porque a la pantalla de confirmación se puede
    // llegar sin pasar por el formulario (la migración entra directa) y porque
    // los guardianes se pueden editar en ella. Desplegar primero y descubrirlo
    // en el `setGuardians` de después deja el gas pagado y la wallet a medias.
    if (guardianCheck.errorKey) { setError(t(guardianCheck.errorKey)); return }
    // V4: the factory only deploys. Guardians and the credential are registered
    // afterwards, in a passkey-signed self-call — a squatter who deploys someone else's
    // address is left with a shell it cannot configure.
    const args = [regData.pubKeyX, regData.pubKeyY] as const

    // Let MetaMask estimate the gas itself (its "network suggested" value). On
    // Arbitrum our own estimate for a ~21KB CREATE2 wallet deploy comes out too
    // low, so passing it as "site suggested" gas made the deploy run out of gas;
    // MetaMask's network estimate is reliable, so we no longer override it.
    if (selectedWalletType === 'agent') {
      if (!network.contracts.agentFactory) return
      writeContract({
        address: network.contracts.agentFactory,
        abi: BVCC_AGENT_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    } else {
      if (!network.contracts.factory) return
      writeContract({
        address: network.contracts.factory,
        abi: BVCC_WALLET_FACTORY_ABI,
        functionName: 'createWallet',
        args,
        chainId: network.chainId,
      })
    }
  }

  const isOnCorrectNetwork = connectedChainId === network.chainId
  const isProcessing = isDeploying || isTxConfirming
  const injectedConnector = connectors.find(c => c.id === 'injected')
  const wcConnector = connectors.find(c => c.id === 'walletConnect')

  // ── Disclaimer modal (general + agent) ──────────────────────────────────────
  const disclaimerEl = disclaimerModal === 'general' ? (
    <DisclaimerModal
      title={t('disclaimer.genTitle')}
      intro={t('disclaimer.genIntro')}
      checkboxes={[
        t('disclaimer.genCb1'),
        t('disclaimer.genCb2'),
        t('disclaimer.genCb3'),
        t('disclaimer.genCb4'),
        t('disclaimer.genCb5'),
        t('disclaimer.genCb6'),
      ]}
      confirmLabel={t('disclaimer.confirm')}
      finalCheckboxLabel={t('disclaimer.genConfirmCheck')}
      linksLabel={t('legal.readMore')}
      links={[
        { label: t('legal.nav.terms'), href: '/legal/terms' },
        { label: t('legal.nav.risk'), href: '/legal/risk-disclosure' },
        { label: t('legal.nav.nonCustodial'), href: '/legal/non-custodial' },
        { label: t('legal.nav.swap'), href: '/legal/swap-fast' },
        { label: t('legal.nav.fees'), href: '/legal/fees' },
        { label: t('legal.nav.privacy'), href: '/legal/privacy' },
      ]}
      onClose={() => setDisclaimerModal(null)}
      onAccept={() => {
        localStorage.setItem('bvcc_disclaimer_accepted', 'true')
        setDisclaimerModal(null)
        handleCreateWallet()
      }}
    />
  ) : disclaimerModal === 'agentInline' ? (
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
      onClose={() => setDisclaimerModal(null)}
      onAccept={() => {
        localStorage.setItem('bvcc_agent_disclaimer_accepted', 'true')
        setDisclaimerModal(null)
        setStep('guardians')
      }}
    />
  ) : null

  // ── Network step ───────────────────────────────────────────────────────────
  if (step === 'network') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.10), transparent 58%), #06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`* { box-sizing: border-box; } .network-card:hover { border-color: rgba(212,175,55,0.35) !important; }`}</style>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <StepHeader n={1} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('appshell.networkTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 24px', lineHeight: '1.6' }}>
            {t('appshell.networkSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {NETWORKS.map(n => {
              const available = !!(n.contracts.factory || n.contracts.agentFactory)
              const isSelected = n.chainId === network.chainId
              return (
                <button
                  key={n.chainId}
                  className={available ? 'network-card' : ''}
                  onClick={() => {
                    if (!available) return
                    setNetworkByChainId(n.chainId)
                    setStep('walletType')
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '14px 16px',
                    backgroundColor: C.card,
                    border: `1px solid ${isSelected ? C.goldBorder : C.border}`,
                    borderRadius: '8px',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.45,
                    transition: 'border-color 0.15s',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <img src={n.logo} alt={n.name} style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: isSelected ? '600' : '400', color: isSelected ? C.gold : C.text }}>
                      {n.name}
                    </span>
                    {n.isTestnet && (
                      <span style={{ marginLeft: '8px', fontSize: '10px', color: C.subtle, letterSpacing: '0.05em' }}>TESTNET</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '11px', color: available ? C.subtle : C.subtle,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                  }}>
                    {available ? (isSelected ? t('appshell.networkSelected') : '') : t('appshell.networkComingSoon')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'walletType') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.10), transparent 58%), #06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`* { box-sizing: border-box; } .wallet-type-card:hover { border-color: rgba(212,175,55,0.35) !important; }`}</style>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <StepHeader n={2} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('appshell.walletTypeTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 28px', lineHeight: '1.6' }}>
            {t('appshell.walletTypeSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {/* Standard wallet card */}
            <button
              className="wallet-type-card"
              onClick={() => { setSelectedWalletType('standard'); setStep('guardians') }}
              style={{
                width: '100%', textAlign: 'left', padding: '20px',
                backgroundColor: C.card,
                border: `1px solid ${selectedWalletType === 'standard' ? C.goldBorder : C.border}`,
                borderRadius: '8px', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>👤</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: C.text }}>{t('appshell.walletTypePersonalLabel')}</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: C.muted, lineHeight: '1.5' }}>
                {t('appshell.walletTypePersonalBody')}
              </p>
            </button>

            {/* Agent wallet card — always selectable; network check is in confirm step */}
            <button
              className="wallet-type-card"
              onClick={() => {
                if (typeof window !== 'undefined' && localStorage.getItem('bvcc_agent_disclaimer_accepted') === 'true') {
                  setSelectedWalletType('agent'); setStep('guardians')
                } else {
                  setSelectedWalletType('agent'); setDisclaimerModal('agentInline')
                }
              }}
              style={{
                width: '100%', textAlign: 'left', padding: '20px',
                backgroundColor: C.card,
                border: `1px solid ${selectedWalletType === 'agent' ? C.goldBorder : C.border}`,
                borderRadius: '8px', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>🤖</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: C.text }}>{t('appshell.walletTypeAgentLabel')}</span>
                {!network.contracts.agentFactory && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontWeight: '500',
                    color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '3px 8px', border: `1px solid ${C.border}`, borderRadius: '4px',
                  }}>
                    {t('appshell.walletTypeAgentUnavailable')}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: C.muted, lineHeight: '1.5' }}>
                {t('appshell.walletTypeAgentBody')}
              </p>
            </button>
          </div>
        </div>
        {disclaimerEl}
      </div>
    )
  }

  // ── Guardians step ─────────────────────────────────────────────────────────
  if (step === 'guardians') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.10), transparent 58%), #06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`* { box-sizing: border-box; }`}</style>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <StepHeader n={3} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('appshell.guardiansTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 28px', lineHeight: '1.6' }}>
            {t('appshell.guardiansSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {([0, 1, 2] as const).map(i => {
              const val = guardians[i]
              const filled = val.length > 0
              const valid = isAddress(val)
              return (
                <div key={i}>
                  <label style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    {t('appshell.guardianLabel')} {i + 1}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={e => {
                      const next: [string, string, string] = [...guardians] as [string, string, string]
                      next[i] = e.target.value
                      setGuardians(next)
                      setError(null)
                    }}
                    placeholder="0x..."
                    style={{
                      width: '100%', padding: '11px 14px',
                      backgroundColor: C.card,
                      border: `1px solid ${filled ? (valid ? 'rgba(104,211,145,0.35)' : 'rgba(252,129,129,0.35)') : C.border}`,
                      borderRadius: '6px', color: C.text,
                      fontSize: '13px', fontFamily: 'monospace',
                      outline: 'none', transition: 'border-color 0.15s',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {error && <p style={{ fontSize: '12px', color: C.error, marginBottom: '16px' }}>{error}</p>}

          {/* El aviso sale mientras se escribe; el error, al pulsar. Poner a tu
              propia cuenta de guardián es legítimo, así que se avisa y ya. */}
          {!error && guardianCheck.warningKey && (
            <p style={{ fontSize: '11.5px', color: '#e6b800', marginBottom: '16px', lineHeight: '1.6' }}>
              ⚠ {t(guardianCheck.warningKey)}
            </p>
          )}

          <p style={{ fontSize: '11.5px', color: C.subtle, marginBottom: '16px', lineHeight: '1.6' }}>
            {t('appshell.guardiansEditableNote')}
          </p>

          <button
            onClick={handleGuardiansNext}
            disabled={guardians.some(g => g === '')}
            style={{
              width: '100%', padding: '13px',
              background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)', boxShadow: '0 8px 26px -12px rgba(212,175,55,0.55)', border: 'none',
              borderRadius: '6px', color: '#000',
              fontSize: '14px', fontWeight: '600',
              cursor: guardians.some(g => g === '') ? 'not-allowed' : 'pointer',
              opacity: guardians.some(g => g === '') ? 0.45 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {t('appshell.guardianContinue')}
          </button>
        </div>
      </div>
    )
  }

  // ── Confirm + Deploy step ───────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.10), transparent 58%), #06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`* { box-sizing: border-box; }`}</style>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <StepHeader n={4} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('appshell.confirmTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 28px', lineHeight: '1.6' }}>
            {t('appshell.confirmSubtitle')}
          </p>

          {/* Summary card */}
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
            <Row label={t('appshell.confirmRowAuth')} value={<span style={{ color: C.success, fontWeight: 500 }}>{t('appshell.confirmRowAuthValue')}</span>} />
            <div style={{ height: '1px', backgroundColor: C.border }} />
            <Row label={t('appshell.confirmRowType')} value={selectedWalletType === 'agent' ? t('appshell.confirmRowTypeAgent') : t('appshell.confirmRowTypePersonal')} />
            <div style={{ height: '1px', backgroundColor: C.border }} />
            <Row label={t('appshell.confirmRowNetwork')} value={network.shortName} />
            <div style={{ height: '1px', backgroundColor: C.border }} />
            <Row label={t('appshell.confirmRowAddress')} value={<span style={{ color: C.muted }}>{t('appshell.confirmRowAddressValue')}</span>} />
            <div style={{ height: '1px', backgroundColor: C.border }} />
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>{t('appshell.confirmGuardians')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {guardians.map((g, i) => (
                  <p key={i} style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: C.muted }}>
                    {i + 1}. {shortAddr(g)}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: '6px', marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: C.muted, lineHeight: '1.5' }}>
              {t('appshell.confirmFeeNote')} <span style={{ color: C.gold }}>{selectedWalletType === 'agent' ? '0.15%' : '0.05%'}</span> {t('appshell.confirmFeeAuto')}
            </p>
          </div>

          {/* Connected wallet status */}
          {connectedAddress && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(104,211,145,0.06)', border: '1px solid rgba(104,211,145,0.2)', borderRadius: '6px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: C.muted }}>
                {t('appshell.confirmConnected')} <span style={{ fontFamily: 'monospace', color: C.success }}>{shortAddr(connectedAddress)}</span>
              </span>
              {!isOnCorrectNetwork && (
                <span style={{ fontSize: '11px', color: C.error }}>{t('appshell.confirmWrongNetwork')}</span>
              )}
            </div>
          )}

          {/* Deploy tx hash */}
          {deployTxHash && (
            <div style={{ padding: '10px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: '6px', marginBottom: '14px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: C.muted }}>
                {t('appshell.confirmTxLabel')} <span style={{ fontFamily: 'monospace', color: C.gold }}>{shortAddr(deployTxHash)}</span>
                {isTxConfirming && <span style={{ color: C.subtle }}> {t('appshell.confirmTxConfirming')}</span>}
                {isTxConfirmed && <span style={{ color: C.success }}> {t('appshell.confirmTxConfirmed')}</span>}
              </p>
            </div>
          )}

          {/* Error */}
          {(error || deployError) && (
            <p style={{ fontSize: '12px', color: C.error, marginBottom: '14px' }}>
              {error || deployError?.message?.split('\n')[0]}
            </p>
          )}

          {/* Action buttons */}
          {!connectedAddress ? (
            // Not connected: show connector options
            <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {injectedConnector && (
                <button
                  onClick={() => connect({ connector: injectedConnector })}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)', boxShadow: '0 8px 26px -12px rgba(212,175,55,0.55)', border: 'none',
                    borderRadius: '6px', color: '#000',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  {t('appshell.confirmConnectMetaMask')}
                </button>
              )}
              {wcConnector && (
                <button
                  onClick={() => {
                    // walletConnect connector runs with showQrModal:false, so we
                    // render our own QR from the display_uri event.
                    const handler = (msg: { type: string; data?: unknown }) => {
                      if (msg.type === 'display_uri') {
                        setWcUri(msg.data as string)
                        wcConnector.emitter.off('message', handler)
                      }
                    }
                    wcConnector.emitter.on('message', handler)
                    connect({ connector: wcConnector })
                  }}
                  style={{
                    width: '100%', padding: '13px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: '6px', color: C.muted,
                    fontSize: '14px', fontWeight: '400', cursor: 'pointer',
                  }}
                >
                  {t('appshell.confirmConnectWalletConnect')}
                </button>
              )}
            </div>

            {/* WalletConnect QR modal */}
            {wcUri && (
              <div
                onClick={() => setWcUri(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    backgroundColor: '#0d1117',
                    border: '1px solid rgba(212,175,55,0.2)',
                    borderRadius: '14px',
                    padding: '28px 28px 24px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                    maxWidth: '340px', width: '90%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: C.text }}>{t('connect.wcScanTitle')}</p>
                  <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
                    <QRCodeSVG value={wcUri} size={220} />
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: C.subtle, textAlign: 'center' }}>
                    {t('connect.wcScanHint')}
                  </p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(wcUri) }}
                    style={{
                      padding: '7px 16px', borderRadius: '6px',
                      border: '1px solid rgba(212,175,55,0.3)',
                      background: 'transparent', color: C.gold,
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {t('connect.wcCopyUri')}
                  </button>
                  <button
                    onClick={() => setWcUri(null)}
                    style={{ background: 'none', border: 'none', color: C.subtle, fontSize: '12px', cursor: 'pointer' }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
            </>
          ) : !isOnCorrectNetwork ? (
            // Wrong network
            <button
              onClick={() => switchChain({ chainId: network.chainId })}
              style={{
                width: '100%', padding: '13px',
                background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)', boxShadow: '0 8px 26px -12px rgba(212,175,55,0.55)', border: 'none',
                borderRadius: '6px', color: '#000',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              {t('appshell.confirmSwitchNetwork')} {network.shortName}
            </button>
          ) : selectedWalletType === 'agent' && !network.contracts.agentFactory ? (
            // Agent wallet selected but factory not deployed on this network
            <div style={{ padding: '14px 16px', backgroundColor: 'rgba(252,129,129,0.06)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: '6px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: C.error }}>{t('appshell.confirmAgentFactoryMissing')} {network.shortName}</p>
              <p style={{ margin: 0, fontSize: '12px', color: C.muted }}>{t('appshell.confirmAgentFactoryHint')}</p>
            </div>
          ) : (
            // Connected + right network: deploy
            <button
              onClick={handleDeploy}
              disabled={isProcessing || isTxConfirmed}
              style={{
                width: '100%', padding: '13px',
                background: isProcessing ? 'rgba(212,175,55,0.7)' : 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)',
                boxShadow: isProcessing ? 'none' : '0 8px 26px -12px rgba(212,175,55,0.55)',
                border: 'none', borderRadius: '6px',
                color: '#000', fontSize: '14px', fontWeight: '600',
                cursor: isProcessing ? 'wait' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {isTxConfirming ? t('appshell.confirmConfirmingBtn') : isDeploying ? t('appshell.confirmDeployingBtn') : isTxConfirmed ? t('appshell.confirmDeployedBtn') : t('appshell.confirmDeployBtn')}
            </button>
          )}

          {configuring ? (
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: C.gold, lineHeight: 1.6, textAlign: 'center' }}>
              {setupPhase === 'funding' ? t('appshell.confirmFundingStep') : t('appshell.confirmSigningStep')}
            </p>
          ) : prefundHint !== null && prefundHint > 0n && (
            <p style={{ margin: '10px 0 0', fontSize: '11.5px', color: C.muted, lineHeight: 1.6, textAlign: 'center' }}>
              {t('appshell.confirmTwoTxNotice')
                .replace('{amount}', formatEther(prefundHint))
                .replace('{symbol}', network.nativeToken.symbol)}
            </p>
          )}

          <button
            onClick={() => setStep('guardians')}
            style={{ width: '100%', padding: '11px', marginTop: '8px', background: 'transparent', border: 'none', color: C.subtle, fontSize: '13px', cursor: 'pointer' }}
          >
            {t('appshell.confirmBackBtn')}
          </button>
        </div>
      </div>
    )
  }

  // ── Marketing landing (vista pública por defecto) ───────────────────────────
  if (step === 'landing') {
    return (
      <>
        <MarketingLanding
          onCreate={requestCreateWallet}
          onAccess={() => { setError(null); setStep('access') }}
          onRecover={() => router.push('/recover')}
          onDirectAccess={() => router.push('/wallet')}
          walletExists={walletExists}
          loading={loading}
          error={error}
        />
        {disclaimerEl}
      </>
    )
  }

  // ── Access (entrar / crear / recuperar) ─────────────────────────────────────
  const addrValid = isAddress(addressInput)

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 85% 55% at 72% -12%, rgba(212,175,55,0.11), transparent 58%), #06080f', display: 'flex', alignItems: 'stretch' }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .landing-left { display: none !important; }
          .landing-right { padding: 32px 20px !important; justify-content: flex-start !important; padding-top: 60px !important; }
          .landing-mobile-logo { display: block !important; }
        }
        input:focus { outline: none; }
        .btn-gold:hover { opacity: 0.88; }
        .btn-outline:hover { border-color: rgba(255,255,255,0.18) !important; }
        .btn-ghost:hover { background: rgba(255,255,255,0.03) !important; }
        .btn-direct:hover { background: rgba(212,175,55,0.12) !important; }
      `}</style>

      {/* Left panel — hero */}
      <div className="landing-left" style={{
        width: '45%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '64px 56px',
        borderRight: `1px solid ${C.border}`,
        position: 'relative',
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(212,175,55,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <img src="/bvcc_wallet.png" alt="BVCC Wallet" width={120} height={120} style={{ height: '120px', width: 'auto', objectFit: 'contain', display: 'block', marginBottom: '26px' }} />

          <h2 style={{ fontSize: '34px', fontWeight: '300', color: C.text, margin: '0 0 16px', lineHeight: '1.25', letterSpacing: '-0.025em' }}>
            {t('appshell.accessHeroTitle1')}<br />
            <span style={{ fontWeight: '700', background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }}>{t('appshell.accessHeroTitle2')}</span><br />
            {t('appshell.accessHeroTitle3')}
          </h2>

          <p style={{ fontSize: '14px', color: C.muted, margin: '0 0 40px', lineHeight: '1.7', maxWidth: '320px' }}>
            {t('appshell.accessHeroDesc')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              t('appshell.accessFeature1'),
              t('appshell.accessFeature2'),
              t('appshell.accessFeature3'),
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: C.gold, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: C.muted }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="landing-right" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 40px',
      }}>
        {/* Mobile logo */}
        <div className="landing-mobile-logo" style={{ display: 'none', marginBottom: '28px', textAlign: 'center' }}>
          <img src="/bvcc_wallet.png" alt="BVCC Wallet" width={120} height={120} style={{ height: '120px', width: 'auto', objectFit: 'contain', display: 'inline-block' }} />
        </div>

        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <button
              onClick={() => { setError(null); setStep('landing') }}
              className="btn-ghost"
              style={{
                background: 'transparent', border: 'none', color: C.muted,
                fontSize: '12px', cursor: 'pointer', padding: '4px 0',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              {t('appshell.accessBackToHome')}
            </button>
            <LanguageSwitcher />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: C.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {t('appshell.accessTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '0 0 28px' }}>
            {t('appshell.accessSubtitle')}
          </p>

          {/* Address input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>
              {t('appshell.accessContractLabel')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={addressInput}
                onChange={e => { setAddressInput(e.target.value); setError(null) }}
                onFocus={() => setAddressInputFocused(true)}
                onBlur={() => setAddressInputFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleEnterAddress()}
                placeholder="0x..."
                style={{
                  flex: 1, padding: '11px 14px',
                  backgroundColor: C.card,
                  border: `1px solid ${
                    addressInput.length > 0
                      ? addrValid ? 'rgba(104,211,145,0.35)' : 'rgba(252,129,129,0.25)'
                      : addressFocused ? C.borderFocus : C.border
                  }`,
                  borderRadius: '9px', color: C.text,
                  fontSize: '13px', fontFamily: 'monospace',
                  transition: 'border-color 0.15s',
                }}
              />
              <button
                onClick={handleEnterAddress}
                disabled={!addrValid}
                className="btn-gold"
                style={{
                  padding: '11px 18px', background: 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)',
                  border: 'none', borderRadius: '9px',
                  color: '#1a1505', fontSize: '13px', fontWeight: '700',
                  cursor: addrValid ? 'pointer' : 'not-allowed',
                  opacity: addrValid ? 1 : 0.4,
                  boxShadow: addrValid ? '0 6px 20px -10px rgba(212,175,55,0.6)' : 'none',
                  transition: 'opacity 0.15s', flexShrink: 0,
                }}
              >
                {t('appshell.accessEnterBtn')}
              </button>
            </div>
            {addressInput.length > 6 && !addrValid && (
              <p style={{ fontSize: '11px', color: C.error, margin: '5px 0 0' }}>{t('appshell.accessInvalidAddress')}</p>
            )}
          </div>

          {/* Wallet saved on device badge */}
          {walletExists && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: '6px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: C.gold }}>{t('appshell.accessWalletSaved')}</p>
              <button
                onClick={() => router.push('/wallet')}
                className="btn-direct"
                style={{
                  padding: '7px 14px', backgroundColor: 'transparent',
                  border: `1px solid ${C.goldBorder}`, borderRadius: '5px',
                  color: C.gold, fontSize: '12px', fontWeight: '500',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
              >
                {t('appshell.accessDirectBtn')}
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: C.border }} />
            <span style={{ fontSize: '11px', color: C.subtle, letterSpacing: '0.06em' }}>{t('appshell.accessOr')}</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: C.border }} />
          </div>

          {/* Create wallet */}
          <button
            onClick={requestCreateWallet}
            disabled={loading}
            className="btn-gold"
            style={{
              width: '100%', padding: '13px',
              background: loading ? 'rgba(212,175,55,0.7)' : 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)',
              border: 'none', borderRadius: '10px',
              color: '#1a1505', fontSize: '14px', fontWeight: '700',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 26px -10px rgba(212,175,55,0.55)',
              transition: 'opacity 0.15s', marginBottom: '10px',
            }}
          >
            {loading ? t('appshell.accessWaitingBiometrics') : t('appshell.accessCreateBtn')}
          </button>

          {/* Recover */}
          <button
            onClick={() => router.push('/recover')}
            className="btn-outline"
            style={{
              width: '100%', padding: '13px',
              backgroundColor: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '10px', color: C.muted,
              fontSize: '14px', fontWeight: '400',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
          >
            {t('appshell.accessRecoverBtn')}
          </button>

          {error && <p style={{ fontSize: '12px', color: C.error, margin: '14px 0 0', textAlign: 'center' }}>{error}</p>}
        </div>
      </div>
      {disclaimerEl}
    </div>
  )
}

function StepHeader({ n }: { n: number }) {
  const { t } = useI18n()
  return (
    <div style={{ marginBottom: '26px', textAlign: 'center' }}>
      <img
        src="/bvcc_wallet.png"
        alt="BVCC Wallet"
        width={120}
        height={120}
        style={{ height: '120px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 22px' }}
      />
      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '2px',
              background: i <= n ? 'linear-gradient(115deg,#f5d76e,#d4af37,#ecc84a)' : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <span style={{ fontSize: '11px', color: '#8892a4', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('appshell.stepOf')} {n} {t('appshell.stepOfTotal')}
        </span>
        <LanguageSwitcher />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
      <span style={{ fontSize: '12px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#f0f4f8' }}>{value}</span>
    </div>
  )
}
