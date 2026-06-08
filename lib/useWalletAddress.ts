'use client'
import { useState, useEffect } from 'react'

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
      const credential = JSON.parse(localStorage.getItem('bvcc_wallet_credential') || '{}')
      const activeWallet = localStorage.getItem('bvcc_active_wallet')
      const addr: string | null = credential?.walletAddress || activeWallet || null
      const cid: string | null = credential?.credentialId || null
      setAddress(addr)
      setCredentialId(cid)
    } catch {
      setAddress(null)
      setCredentialId(null)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  return { address, credentialId, isLoaded }
}
