import { useState, useEffect, useCallback } from 'react'
import { getWeb3Wallet } from './wcWallet'
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

function buildNamespaces(address: string, chainId: number) {
  return {
    eip155: {
      chains: [`eip155:${chainId}`],
      methods: [
        'eth_sendTransaction',
        'eth_signTypedData',
        'eth_signTypedData_v4',
        'personal_sign',
        'eth_sign',
      ],
      events: ['chainChanged', 'accountsChanged'],
      accounts: [`eip155:${chainId}:${address}`],
    },
  }
}

export function useWcWallet(walletAddress: string | null, chainId = 421614) {
  const [sessions, setSessions] = useState<WcSession[]>([])
  const [pendingRequest, setPendingRequest] = useState<PendingRequestTypes.Struct | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walletAddress) return

    let cancelled = false

    getWeb3Wallet()
      .then((wc) => {
        if (cancelled) return

        // Cargar sesiones existentes
        const activeSessions = wc.getActiveSessions()
        setSessions(Object.values(activeSessions) as WcSession[])
        setReady(true)

        // Nueva conexión: dApp envía proposal
        wc.on('session_proposal', async ({ id, params }) => {
          if (cancelled) return
          try {
            const namespaces = buildNamespaces(walletAddress, chainId)
            await wc.approveSession({ id, namespaces })
            const updated = wc.getActiveSessions()
            setSessions(Object.values(updated) as WcSession[])
          } catch (e) {
            console.error('[WC] session_proposal error', e)
          }
        })

        // dApp pide firmar / enviar tx
        wc.on('session_request', (event) => {
          if (cancelled) return
          setPendingRequest(event)
        })

        // dApp cierra la sesión
        wc.on('session_delete', () => {
          if (cancelled) return
          const updated = wc.getActiveSessions()
          setSessions(Object.values(updated) as WcSession[])
        })
      })
      .catch((e) => {
        if (!cancelled) {
          setError('Error inicializando WalletConnect: ' + (e?.message ?? String(e)))
        }
      })

    return () => {
      cancelled = true
    }
  }, [walletAddress])

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
    setPendingRequest(null)
  }, [])

  const respondError = useCallback(async (topic: string, id: number, message: string) => {
    const wc = await getWeb3Wallet()
    await wc.respondSessionRequest({
      topic,
      response: { id, jsonrpc: '2.0', error: { code: 4001, message } },
    })
    setPendingRequest(null)
  }, [])

  const disconnect = useCallback(async (topic: string) => {
    const wc = await getWeb3Wallet()
    await wc.disconnectSession({
      topic,
      reason: { code: 6000, message: 'User disconnected' },
    })
    setSessions((prev) => prev.filter((s) => s.topic !== topic))
  }, [])

  return {
    sessions,
    pendingRequest,
    ready,
    error,
    pair,
    respondSuccess,
    respondError,
    disconnect,
  }
}
