import { http, createConfig } from 'wagmi'
import { arbitrumSepolia, base, arbitrum, mainnet, bsc } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo'

export const config = createConfig({
  chains: [arbitrumSepolia, base, arbitrum, mainnet, bsc],
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: false }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
})
