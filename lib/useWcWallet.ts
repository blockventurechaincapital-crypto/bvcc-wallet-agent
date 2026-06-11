import { useState, useEffect, useCallback } from 'react'
import { getWeb3Wallet } from './wcWallet'
import { NETWORKS } from './networks'
import type { SessionTypes, PendingRequestTypes } from '@walletconnect/types'

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
        'eth_sign',
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
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

// Los ids JSON-RPC de WC derivan del timestamp (ms*1000). El relay caduca las
// peticiones a los ~5 min: las viejas se rechazan y purgan para que no queden
// tarjetas zombi que la dApp ya dio por muertas.
const REQUEST_TTL_MS = 4.5 * 60 * 1000
function isExpired(req: PendingRequestTypes.Struct): boolean {
  const ageMs = Date.now() - Math.floor(req.id / 1000)
  return ageMs > REQUEST_TTL_MS
}

// Cambio de red: todas las redes ya están en la sesión — responder OK y emitir
// chainChanged, sin UI.
async function autoRespondChainSwitch(wc: Wc, event: PendingRequestTypes.Struct) {
  try {
    const params = event.params.request.params as { chainId?: string }[] | undefined
    const newChainId = parseInt(params?.[0]?.chainId ?? '0x0', 16)
    await wc.respondSessionRequest({
      topic: event.topic,
      response: { id: event.id, jsonrpc: '2.0', result: null },
    })
    if (newChainId > 0) {
      await wc.emitSessionEvent({
        topic: event.topic,
        event: { name: 'chainChanged', data: newChainId },
        chainId: `eip155:${newChainId}`,
      })
    }
  } catch (e) {
    console.warn('[WC] switchChain error', e)
  }
}

export function useWcWallet(walletAddress: string | null, chainId = 421614) {
  const [sessions, setSessions] = useState<WcSession[]>([])
  // Bandeja de peticiones pendientes (estilo Safe): persisten en el store de WC
  // aunque la pestaña estuviera cerrada/dormida cuando llegaron.
  const [pendingRequests, setPendingRequests] = useState<PendingRequestTypes.Struct[]>([])
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
        } else if (isChainSwitch(req.params.request.method)) {
          await autoRespondChainSwitch(wc, req)
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

        // Nueva conexión: dApp envía proposal
        const onProposal = async ({ id }: { id: number; params: unknown }) => {
          if (cancelled) return
          try {
            const namespaces = buildNamespaces(walletAddress, chainId)
            await wc.approveSession({ id, namespaces })
            const updated = wc.getActiveSessions()
            setSessions(Object.values(updated) as WcSession[])
          } catch (e) {
            console.warn('[WC] session_proposal error', e)
          }
        }

        // dApp pide firmar / enviar tx / cambiar de red
        const onRequest = async (event: PendingRequestTypes.Struct) => {
          if (cancelled) return
          if (isChainSwitch(event.params.request.method)) {
            await autoRespondChainSwitch(wc, event)
            return
          }
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
          wc.off('session_proposal', onProposal)
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
    const wc = await getWeb3Wallet()
    await wc.pair({ uri })
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
    ready,
    error,
    pair,
    respondSuccess,
    respondError,
    disconnect,
  }
}
