import { http, createConfig } from 'wagmi'
import { arbitrumSepolia, base, arbitrum, mainnet, bsc, polygon } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { NETWORKS } from './networks'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo'

/**
 * El RPC de cada red sale de `lib/networks.ts`, que es de donde sale también la
 * lista `connect-src` de la CSP (`next.config.ts`).
 *
 * ⚠️ Antes esto era `http()` **sin URL**, y viem caía entonces a su RPC por
 * defecto, que NO es el nuestro en tres de las seis redes: `eth.merkle.io` en
 * Ethereum, `56.rpc.thirdweb.com` en BNB y `polygon.drpc.org` en Polygon. Con la
 * CSP en enforce eso significaba que **todas las lecturas de wagmi quedaban
 * bloqueadas en esas tres redes**, y el síntoma no se parecía en nada a la causa:
 * el despliegue de una wallet salía —esa transacción la manda la wallet externa
 * por el conector, no por este transporte— pero el recibo no llegaba nunca, así
 * que el alta no pasaba de ahí y la wallet se quedaba sin guardianes. En Arbitrum
 * y Base coincidían por casualidad, que son justo las redes donde se probaba.
 *
 * Deriva de una sola lista y el problema no puede volver.
 */
function rpcUrlOf(chainId: number): string {
  const n = NETWORKS.find((x) => x.chainId === chainId)
  if (!n) throw new Error(`lib/config.ts: falta el RPC de la red ${chainId} en lib/networks.ts`)
  return n.rpcUrl
}

export const config = createConfig({
  chains: [arbitrumSepolia, base, arbitrum, mainnet, bsc, polygon],
  connectors: [
    injected(),
    // 'silent' evita que el Core interno del connector emita console.error
    // por errores benignos del relay (igual que en lib/wcWallet.ts)
    walletConnect({ projectId, showQrModal: false, logger: 'silent' }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(rpcUrlOf(arbitrumSepolia.id)),
    [base.id]: http(rpcUrlOf(base.id)),
    [arbitrum.id]: http(rpcUrlOf(arbitrum.id)),
    [mainnet.id]: http(rpcUrlOf(mainnet.id)),
    [bsc.id]: http(rpcUrlOf(bsc.id)),
    [polygon.id]: http(rpcUrlOf(polygon.id)),
  },
})
