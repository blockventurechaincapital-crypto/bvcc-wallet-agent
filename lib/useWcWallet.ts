import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, type Hex } from 'viem'
import { getWeb3Wallet } from './wcWallet'
import { NETWORKS, getNetwork } from './networks'
import { getAtomicBatchEnabled, getBatch } from './wcCalls'
import type { SessionTypes, PendingRequestTypes, ProposalTypes } from '@walletconnect/types'

export type WcSession = {
  topic: string
  peer: {
    metadata: {
      name: string
      description: string
      url: string
      icons: string[]
    }
  }
  namespaces: SessionTypes.Namespaces
}

export type WcProposal = {
  id: number
  /** Lo que la dApp DICE que es. No está verificado: el veredicto sobre si el
   *  origen real coincide con esta `url` vive en `verifyContext`. */
  metadata: { name: string; description: string; url: string; icons: string[] }
  /** `verifyContext` del relay, tal cual. Lo interpreta `checkOrigin`
   *  (lib/wcSignatures.ts), el mismo que usa el modal de firma. */
  verifyContext: unknown
  /** Segundos epoch: el relay caduca las propuestas a los ~5 min. */
  expiryTimestamp: number
}

/** Valida el texto pegado ANTES de llamar a `pair`. Sin esto, un pegado a medias
 *  —o un `wc:` de v1, cuyo relay está apagado desde 2023— se iba en silencio a
 *  la cola de emparejamiento y la interfaz se quedaba esperando una propuesta
 *  que no iba a llegar nunca. */
export function parseWcUri(raw: string): { topic: string } | null {
  const m = /^wc:([^@?\s]+)@(\d+)(\?.*)?$/i.exec(raw.trim())
  if (!m) return null
  if (m[2] !== '2') return null
  const params = new URLSearchParams(m[3] ? m[3].slice(1) : '')
  if (!params.get('symKey')) return null   // sin symKey el par no puede cifrar
  return { topic: m[1] }
}

// ─── Cola de propuestas, compartida entre instancias del hook ────────────────
// `useWcWallet` se monta dos veces a la vez: la cabecera (WalletConnectButton,
// que es quien pinta la bandeja) y la página de dApps. Con estado local cada
// una tendría su propia cola y las dos intentarían aprobar la misma propuesta;
// y al aprobar desde la cabecera, la lista de "sesiones activas" de la página
// no se enteraría. Un store de módulo con suscriptores arregla las dos cosas.
let proposalQueue: WcProposal[] = []
const proposalSubs = new Set<() => void>()

function publishProposals(next: WcProposal[]) {
  proposalQueue = next
  for (const notify of proposalSubs) notify()
}

function addProposal(p: WcProposal) {
  if (proposalQueue.some((q) => q.id === p.id)) return
  publishProposals([...proposalQueue, p])
}

/** Siempre publica, aunque el id ya no esté: el aviso es también la señal con la
 *  que cada instancia vuelve a leer las sesiones activas después de aprobar. */
function removeProposal(id: number) {
  publishProposals(proposalQueue.filter((q) => q.id !== id))
}

function toProposal(id: number, params: ProposalTypes.Struct, verifyContext: unknown): WcProposal {
  return {
    id,
    metadata: params.proposer.metadata,
    verifyContext,
    expiryTimestamp: params.expiryTimestamp,
  }
}

// The wallet has the same CREATE2 address on every supported network, so the
// session approves ALL of them. activeChainId goes first (dApps treat the
// first account as the active one) and dApps can switch freely afterwards.
function buildNamespaces(address: string, activeChainId: number) {
  const chainIds = [
    activeChainId,
    ...NETWORKS.map((n) => n.chainId).filter((id) => id !== activeChainId),
  ]
  return {
    eip155: {
      chains: chainIds.map((id) => `eip155:${id}`),
      methods: [
        'eth_sendTransaction',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'personal_sign',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
        // EIP-5792: batching atómico (approve+acción en una sola firma vía ERC-7821)
        'wallet_sendCalls',
        'wallet_getCallsStatus',
        'wallet_getCapabilities',
      ],
      events: ['chainChanged', 'accountsChanged'],
      accounts: chainIds.map((id) => `eip155:${id}:${address}`),
    },
  }
}

type Wc = Awaited<ReturnType<typeof getWeb3Wallet>>

function isChainSwitch(method: string) {
  return method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain'
}

function chainIdFromReq(event: PendingRequestTypes.Struct): number {
  const c = event.params.chainId
  const id = c?.startsWith('eip155:') ? parseInt(c.slice(7), 10) : NaN
  return Number.isFinite(id) ? id : 0
}

// Los ids JSON-RPC de WC derivan del timestamp (ms*1000). El relay caduca las
// peticiones a los ~5 min: las viejas se rechazan y purgan para que no queden
// tarjetas zombi que la dApp ya dio por muertas.
const REQUEST_TTL_MS = 4.5 * 60 * 1000
function isExpired(req: PendingRequestTypes.Struct): boolean {
  const ageMs = Date.now() - Math.floor(req.id / 1000)
  return ageMs > REQUEST_TTL_MS
}

// Cambio de red: si la red está soportada (está en la sesión) respondemos OK y
// emitimos chainChanged sin UI. Si NO la soportamos, devolvemos 4902 en vez de
// decir "ok" a ciegas (si no, las txs posteriores fallarían en una red que no
// manejamos).
async function autoRespondChainSwitch(wc: Wc, event: PendingRequestTypes.Struct) {
  try {
    const params = event.params.request.params as { chainId?: string }[] | undefined
    const newChainId = parseInt(params?.[0]?.chainId ?? '0x0', 16)

    let supported = false
    try { getNetwork(newChainId); supported = newChainId > 0 } catch { supported = false }

    if (!supported) {
      await wc.respondSessionRequest({
        topic: event.topic,
        response: { id: event.id, jsonrpc: '2.0', error: { code: 4902, message: 'Unrecognized chain ID' } },
      })
      return
    }

    await wc.respondSessionRequest({
      topic: event.topic,
      response: { id: event.id, jsonrpc: '2.0', result: null },
    })
    await wc.emitSessionEvent({
      topic: event.topic,
      event: { name: 'chainChanged', data: newChainId },
      chainId: `eip155:${newChainId}`,
    })
  } catch (e) {
    console.warn('[WC] switchChain error', e)
  }
}

// EIP-5792 wallet_getCapabilities: el batch atómico es OPT-IN del usuario
// (Settings). Solo lo reportamos como soportado si lo tiene encendido; si no,
// 'unsupported' y ejecutaremos las calls una a una (no mentimos a la dApp).
async function autoRespondCapabilities(wc: Wc, event: PendingRequestTypes.Struct) {
  const atomicOn = getAtomicBatchEnabled()
  const caps: Record<string, unknown> = {}
  for (const n of NETWORKS) {
    caps['0x' + n.chainId.toString(16)] = {
      atomic: { status: atomicOn ? 'supported' : 'unsupported' },  // EIP-5792 (rev actual)
      atomicBatch: { supported: atomicOn },                        // EIP-5792 (rev 1.0, compat)
    }
  }
  await wc.respondSessionRequest({
    topic: event.topic,
    response: { id: event.id, jsonrpc: '2.0', result: caps },
  })
}

// EIP-5792 wallet_getCallsStatus: el id mapea en el store a 1+ txHashes (varias
// en modo secuencial). Leemos los receipts y agregamos. status 100 (pending) /
// 200 (confirmado, una vez todas tienen receipt). Sin UI.
async function autoRespondCallsStatus(wc: Wc, event: PendingRequestTypes.Struct) {
  try {
    const raw = (event.params.request.params as unknown[])?.[0]
    const id = (typeof raw === 'string' ? raw : (raw as { id?: string })?.id) as Hex

    // El id puede venir del store (batch) o ser directamente un txHash (compat).
    const rec = getBatch(id)
    const chainId = rec?.chainId ?? chainIdFromReq(event)
    const hashes: Hex[] = rec ? rec.txHashes : [id]

    const net = getNetwork(chainId)
    const client = createPublicClient({ chain: net.viemChain, transport: http(net.rpcUrl) })

    const receipts = await Promise.all(hashes.map(async (h) => {
      try { return await client.getTransactionReceipt({ hash: h }) } catch { return null }
    }))

    const allMined = receipts.every((r) => r !== null)
    const result = {
      status: allMined ? 200 : 100,
      receipts: receipts.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => ({
        transactionHash: r.transactionHash,
        blockHash: r.blockHash,
        blockNumber: '0x' + r.blockNumber.toString(16),
        gasUsed: '0x' + r.gasUsed.toString(16),
        status: r.status === 'success' ? '0x1' : '0x0',
        logs: r.logs,
      })),
    }

    await wc.respondSessionRequest({
      topic: event.topic,
      response: { id: event.id, jsonrpc: '2.0', result },
    })
  } catch {
    await wc.respondSessionRequest({
      topic: event.topic,
      response: { id: event.id, jsonrpc: '2.0', error: { code: -32000, message: 'getCallsStatus failed' } },
    })
  }
}

// Métodos que respondemos automáticamente, sin tarjeta de aprobación.
// Devuelve true si lo manejó.
async function autoHandle(wc: Wc, event: PendingRequestTypes.Struct): Promise<boolean> {
  const m = event.params.request.method
  if (isChainSwitch(m)) { await autoRespondChainSwitch(wc, event); return true }
  if (m === 'wallet_getCapabilities') { await autoRespondCapabilities(wc, event); return true }
  if (m === 'wallet_getCallsStatus') { await autoRespondCallsStatus(wc, event); return true }
  return false
}

export function useWcWallet(walletAddress: string | null, chainId = 421614) {
  const [sessions, setSessions] = useState<WcSession[]>([])
  // Bandeja de peticiones pendientes (estilo Safe): persisten en el store de WC
  // aunque la pestaña estuviera cerrada/dormida cuando llegaron.
  const [pendingRequests, setPendingRequests] = useState<PendingRequestTypes.Struct[]>([])
  // Propuestas de sesión a la espera de que el usuario acepte o decline.
  const [pendingProposals, setPendingProposals] = useState<WcProposal[]>(proposalQueue)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshPending = useCallback(async () => {
    try {
      const wc = await getWeb3Wallet()
      // El navegador mata el websocket del relay con la pestaña en background;
      // reconectar antes de leer para que entren los mensajes encolados.
      try {
        const relayer = (wc as unknown as { core?: { relayer?: { connected: boolean; restartTransport: () => Promise<void> } } }).core?.relayer
        if (relayer && !relayer.connected) await relayer.restartTransport()
      } catch { /* reconexión best-effort */ }
      const list = wc.getPendingSessionRequests() ?? []
      const queue: PendingRequestTypes.Struct[] = []
      for (const req of list) {
        if (isExpired(req)) {
          // best-effort: limpiar del store; la dApp ya la dio por caducada
          try {
            await wc.respondSessionRequest({
              topic: req.topic,
              response: { id: req.id, jsonrpc: '2.0', error: { code: 4001, message: 'Request expired' } },
            })
          } catch { /* ya purgada por el relay */ }
        } else if (await autoHandle(wc, req)) {
          /* respondido automáticamente (switch chain / capabilities / calls status) */
        } else {
          queue.push(req)
        }
      }
      // Orden de llegada (id = timestamp): se firma SIEMPRE la más antigua primero
      queue.sort((a, b) => a.id - b.id)
      setPendingRequests(queue)
    } catch {
      /* WC aún no inicializado */
    }
  }, [])

  useEffect(() => {
    if (!walletAddress) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    getWeb3Wallet()
      .then((wc) => {
        if (cancelled) return

        // Cargar sesiones existentes + peticiones que llegaron con la pestaña dormida
        const activeSessions = wc.getActiveSessions()
        setSessions(Object.values(activeSessions) as WcSession[])
        setReady(true)
        void refreshPending()

        // Propuestas que llegaron con la pestaña cerrada o dormida: el store de
        // WC las guarda igual que las peticiones de firma. Las caducadas no
        // entran — aprobarlas falla y la tarjeta solo confundiría.
        for (const p of Object.values(wc.getPendingSessionProposals() ?? {})) {
          if (p.expiryTimestamp * 1000 > Date.now()) addProposal(toProposal(p.id, p, undefined))
        }

        // Cualquier cambio en la cola compartida —desde esta instancia o desde
        // la otra— repinta la bandeja y reelee las sesiones activas.
        const onProposalStore = () => {
          if (cancelled) return
          setPendingProposals(proposalQueue)
          setSessions(Object.values(wc.getActiveSessions()) as WcSession[])
        }
        proposalSubs.add(onProposalStore)
        setPendingProposals(proposalQueue)

        // Nueva conexión: la dApp manda una propuesta. NO se aprueba sola — pasa
        // a la bandeja y espera acción explícita. El emparejamiento lo inicia el
        // usuario pegando un URI, pero ese URI puede venir copiado de una página
        // de phishing: la pantalla que enseña QUÉ dominio ha quedado emparejado
        // es justo la que caza ese caso.
        const onProposal = (proposal: { id: number; params: ProposalTypes.Struct; verifyContext?: unknown }) => {
          if (cancelled) return
          addProposal(toProposal(proposal.id, proposal.params, proposal.verifyContext))
        }

        // Caducada en el relay: fuera de la bandeja, no se puede aprobar ya.
        const onProposalExpire = ({ id }: { id: number }) => {
          removeProposal(id)
        }

        // dApp pide firmar / enviar tx / cambiar de red
        const onRequest = async (event: PendingRequestTypes.Struct) => {
          if (cancelled) return
          if (await autoHandle(wc, event)) return
          setPendingRequests((prev) =>
            prev.some((r) => r.id === event.id) ? prev : [...prev, event]
          )
        }

        // dApp cierra la sesión
        const onDelete = () => {
          if (cancelled) return
          const updated = wc.getActiveSessions()
          setSessions(Object.values(updated) as WcSession[])
        }

        wc.on('session_proposal', onProposal)
        wc.on('proposal_expire', onProposalExpire)
        wc.on('session_request', onRequest)
        wc.on('session_delete', onDelete)

        // El relay puede perder eventos con la pestaña en background: re-leer el
        // store al recuperar foco/visibilidad y con un poll ligero (lectura local).
        const onFocus = () => void refreshPending()
        const onVisibility = () => {
          if (document.visibilityState === 'visible') void refreshPending()
        }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)
        const interval = setInterval(() => {
          if (document.visibilityState === 'visible') void refreshPending()
        }, 10_000)

        cleanup = () => {
          proposalSubs.delete(onProposalStore)
          wc.off('session_proposal', onProposal)
          wc.off('proposal_expire', onProposalExpire)
          wc.off('session_request', onRequest)
          wc.off('session_delete', onDelete)
          window.removeEventListener('focus', onFocus)
          document.removeEventListener('visibilitychange', onVisibility)
          clearInterval(interval)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError('Error inicializando WalletConnect: ' + (e?.message ?? String(e)))
        }
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [walletAddress, chainId, refreshPending])

  const pair = useCallback(async (uri: string) => {
    // Red de seguridad: las dos pantallas que emparejan validan antes para poder
    // dar el mensaje en el idioma del usuario, pero el hook no se fía de eso.
    if (!parseWcUri(uri)) throw new Error('Invalid WalletConnect URI')
    const wc = await getWeb3Wallet()
    await wc.pair({ uri: uri.trim() })
  }, [])

  const approveProposal = useCallback(async (id: number) => {
    if (!walletAddress) throw new Error('No wallet address')
    const wc = await getWeb3Wallet()
    try {
      await wc.approveSession({ id, namespaces: buildNamespaces(walletAddress, chainId) })
    } finally {
      removeProposal(id)
    }
  }, [walletAddress, chainId])

  const rejectProposal = useCallback(async (id: number) => {
    const wc = await getWeb3Wallet()
    try {
      // 5000 = USER_REJECTED en el catálogo de errores de WalletConnect.
      await wc.rejectSession({ id, reason: { code: 5000, message: 'User rejected.' } })
    } finally {
      removeProposal(id)
    }
  }, [])

  const respondSuccess = useCallback(async (topic: string, id: number, result: string) => {
    const wc = await getWeb3Wallet()
    await wc.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', result },
    })
    setPendingRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const respondError = useCallback(async (topic: string, id: number, message: string) => {
    const wc = await getWeb3Wallet()
    try {
      await wc.respondSessionRequest({
        topic,
        response: { id, jsonrpc: '2.0', error: { code: 4001, message } },
      })
    } finally {
      // Si la petición ya expiró en el relay, sacarla de la bandeja igualmente
      setPendingRequests((prev) => prev.filter((r) => r.id !== id))
    }
  }, [])

  const disconnect = useCallback(async (topic: string) => {
    const wc = await getWeb3Wallet()
    await wc.disconnectSession({
      topic,
      reason: { code: 6000, message: 'User disconnected' },
    })
    setSessions((prev) => prev.filter((s) => s.topic !== topic))
    setPendingRequests((prev) => prev.filter((r) => r.topic !== topic))
  }, [])

  return {
    sessions,
    pendingRequests,
    pendingProposals,
    ready,
    error,
    pair,
    approveProposal,
    rejectProposal,
    respondSuccess,
    respondError,
    disconnect,
  }
}
