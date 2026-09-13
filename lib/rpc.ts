import { fallback, http, type Transport } from 'viem'
import type { NetworkConfig } from './networks'

/**
 * Transporte de LECTURA de una red: sus RPC en orden, pasando al siguiente cuando
 * uno falla.
 *
 * Antes cada red tenía un único RPC público, y cuando fallaba no había plan B: con
 * Base activa, `mainnet.base.org` contesta 429 a buena parte de las lecturas que el
 * panel lanza juntas, y la pantalla se quedaba a medias. viem solo salta al
 * siguiente si el fallo es del proveedor (caído, 429, límite, tiempo agotado); un
 * `revert` o un rechazo del usuario se devuelven tal cual, sin repetirlos en otro.
 *
 * ⚠️ Solo para leer. Quien FIRMA y DIFUNDE transacciones (el bundler de
 * `app/api/send-userop`) usa `network.rpcUrls[0]` y nada más: con reserva podría
 * leer el nonce `pending` de un proveedor y difundir por otro, y la mempool de
 * cada uno es distinta.
 */
export function rpcTransport(network: Pick<NetworkConfig, 'rpcUrls'>): Transport {
  const urls = network.rpcUrls
  return urls.length === 1 ? http(urls[0]) : fallback(urls.map((url) => http(url)))
}
