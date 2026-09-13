// Identificadores de CoinGecko por red. UNA tabla, no tres.
//
// Estaban copiadas en `app/api/token-prices/route.ts`, `app/api/price-chart/route.ts`
// y `lib/useTokens.ts`, y como pasa siempre acabaron en tres estados distintos:
// ninguna tenía Polygon. Dos de ellas además caían a `'ethereum'` por defecto, así
// que el POL se pintaba con el precio de ETH —inflado unas 26.000 veces— en la
// pantalla donde se decide cuánto dinero mandar.
//
// ⚠️ NO añadas un valor por defecto aquí. Un hueco que devuelve 0 se lee como «no
// hay dato»; un hueco tapado con el nativo de otra red se lee como verdad.

/** Plataforma de CoinGecko para precios de ERC-20 por contrato.
 *  Los testnets no están indexados y por eso no aparecen: sin plataforma no se
 *  piden precios de token, que es lo correcto. */
export const CG_PLATFORM: Record<string, string> = {
  '1': 'ethereum',
  '42161': 'arbitrum-one',
  '8453': 'base',
  '56': 'binance-smart-chain',
  '137': 'polygon-pos',
}

/** Id de CoinGecko del token NATIVO de cada red.
 *
 *  POL es `polygon-ecosystem-token`, no `matic-network`: el segundo sigue en
 *  CoinGecko pero está muerto —capitalización 0 y céntimos de volumen en 24 h—,
 *  o sea que devuelve un precio fosilizado. Comprobado contra la API el
 *  2026-09-12. */
export const CG_NATIVE_ID: Record<string, string> = {
  '1': 'ethereum',
  '42161': 'ethereum',
  '8453': 'ethereum',
  '421614': 'ethereum',
  '56': 'binancecoin',
  '137': 'polygon-ecosystem-token',
}
