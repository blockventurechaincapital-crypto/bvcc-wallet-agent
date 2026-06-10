import { http, createConfig } from 'wagmi'
import { arbitrumSepolia, base, arbitrum, mainnet, bsc } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo'

export const config = createConfig({
  chains: [arbitrumSepolia, base, arbitrum, mainnet, bsc],
  connectors: [
    injected(),
    // 'silent' evita que el Core interno del connector emita console.error
    // por errores benignos del relay (igual que en lib/wcWallet.ts)
    walletConnect({ projectId, showQrModal: false, logger: 'silent' }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
})
