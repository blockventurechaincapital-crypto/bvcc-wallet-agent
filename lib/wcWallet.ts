import { Core } from '@walletconnect/core'
import { Web3Wallet } from '@walletconnect/web3wallet'

// Singleton — una sola instancia por sesión de navegador
let web3wallet: InstanceType<typeof Web3Wallet> | null = null
let initPromise: Promise<InstanceType<typeof Web3Wallet>> | null = null

export async function getWeb3Wallet(): Promise<InstanceType<typeof Web3Wallet>> {
  // Guard: solo en el cliente
  if (typeof window === 'undefined') {
    throw new Error('getWeb3Wallet solo puede llamarse en el cliente')
  }

  if (web3wallet) return web3wallet

  // Evitar inicialización múltiple concurrente
  if (initPromise) return initPromise

  initPromise = (async () => {
    const core = new Core({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
      // 'silent' evita que el logger interno de WalletConnect emita console.error
      // (errores/reintentos benignos del relay que el overlay de Next.js mostraba como error)
      logger: 'silent',
    })

    const instance = await Web3Wallet.init({
      core,
      metadata: {
        name: 'BVCC Wallet',
        description: 'Smart wallet auto-custodiada con Face ID',
        url: 'https://bvccwallet.blockventurechaincapital.com',
        icons: ['https://bvccwallet.blockventurechaincapital.com/icon.png'],
      },
    })

    web3wallet = instance
    return instance
  })().catch((e) => {
    // Permitir reintentar en la siguiente llamada en vez de cachear un promise rechazado
    initPromise = null
    throw e
  })

  return initPromise
}

export type { Web3Wallet }
