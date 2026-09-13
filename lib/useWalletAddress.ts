'use client'
import { useState, useEffect } from 'react'
import { loadCredential } from './webauthn'

export interface WalletAddressState {
  address: string | null
  credentialId: string | null
  isLoaded: boolean
}

export function useWalletAddress(): WalletAddressState {
  const [address, setAddress] = useState<string | null>(null)
  const [credentialId, setCredentialId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      // Una credencial corrupta cuenta como ninguna: antes el JSON.parse lanzaba y
      // se perdía también la wallet activa, así que ninguna pantalla cargaba.
      const credential = loadCredential()
      const activeWallet = localStorage.getItem('bvcc_active_wallet')
      setAddress(credential?.walletAddress || activeWallet || null)
      setCredentialId(credential?.credentialId || null)
    } catch {
      setAddress(null)
      setCredentialId(null)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  return { address, credentialId, isLoaded }
}
