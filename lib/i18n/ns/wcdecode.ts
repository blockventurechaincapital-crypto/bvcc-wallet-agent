// Human-readable summaries for the WalletConnect signing modal.
//
// lib/wcCalls.ts decodes the calldata a dApp asks you to sign and turns it into a
// sentence ("Approve 100 USDC to Permit2"). Those strings used to be hardcoded in
// Spanish, so an English user got an English UI with Spanish transaction summaries.
// wcCalls.ts is a plain module with no React context, so classifyCall() takes `t`
// as an argument and the modal passes it in.
//
// Keep the wording short and literal. This is the last thing a user reads before
// signing, so it should describe the call, not reassure them about it.

export const wcdecode = {
  en: {
    wc: {
      // ── Approvals ──
      unlimited: 'UNLIMITED',
      unlimitedAmt: '{sym} UNLIMITED',
      spenderPermit2: 'Permit2 (Uniswap)',
      spenderKnown: 'a known contract',
      spenderUnknown: 'an unknown address',
      approve: 'Approve {amt} to {spender}',
      warnApproveUnknown: 'Approval to an UNKNOWN address',
      warnApproveUnlimited: 'Unlimited approval (to a known contract)',
      incAllowKnown: 'Increase allowance to a known contract',
      incAllowUnknown: 'Increase allowance to an unknown address',
      warnIncAllow: 'Increases allowance to an unknown address',
      nftApproveAll: 'Give control of ALL your NFTs in this collection',
      nftRevokeAll: 'Revoke control of this collection’s NFTs',
      warnNftApproveAll: 'Gives control of ALL your NFTs in this collection',

      // ── Transfers ──
      destKnown: 'known destination',
      destUnknown: 'unknown destination',
      transfer: 'Send {amt} → {dest}',
      transferFrom: 'Move {amt} → {dest}',
      warnTransferUnknown: 'Transfers tokens to an unknown address',
      warnTransferFromUnknown: 'Moves tokens to an unknown address',
      sendEth: 'Send {amt} ETH',
      sendEthUnknown: 'Send {amt} ETH to an unknown address',
      warnSendEthUnknown: 'ETH sent to an unknown address',

      // ── WETH ──
      wrap: 'Wrap {amt} ETH → WETH',
      unwrap: 'Unwrap {amt} WETH → ETH',
      unwrapMin: 'Unwrap WETH → ETH (min {amt})',
      wrapShort: 'Wrap ETH → WETH',
      unwrapShort: 'Unwrap WETH → ETH',

      // ── Aave v3 ──
      aaveSupply: 'Deposit {amt} into Aave',
      aaveWithdraw: 'Withdraw {amt} from Aave',
      aaveBorrow: 'Borrow {amt} on Aave',
      aaveRepay: 'Repay {amt} to Aave',
      warnAaveBorrow: 'Creates debt on Aave',

      // ── Uniswap v3 liquidity ──
      lpMint: 'Add liquidity · {a} + {b}',
      lpIncrease: 'Add liquidity to position #{id}',
      lpDecrease: 'Remove liquidity from position #{id}',
      lpCollect: 'Collect fees from position #{id}',
      lpBurn: 'Close position #{id} (liquidity NFT)',

      // ── Swaps ──
      swapIn: 'Swap {amt} → {sym} (min {min})',
      swapOut: 'Swap {sym} → {amt} (max {max})',
      swapInPath: 'Swap (in {amt}, min out {min})',
      swapOutPath: 'Swap (out {amt}, max in {max})',
      swapV2: 'Swap on Uniswap v2',
      swapV4: 'Swap on Uniswap v4',
      refundEth: 'Refund leftover ETH',
      permit2: 'Permit2 permission',
      urGeneric: 'Uniswap operation (Universal Router)',
      warnUrGeneric: 'Universal Router commands not detailed',

      // ── Uniswap v4 liquidity ──
      v4Add: 'Add liquidity to a position (Uniswap v4)',
      v4Remove: 'Remove liquidity from a position (Uniswap v4)',
      v4Create: 'Create liquidity position (Uniswap v4)',
      v4Close: 'Close position (Uniswap v4)',
      v4Manage: 'Manage liquidity (Uniswap v4)',
      v4Max: ' · max {a} + {b}',
      v4ToPos: ' to position #{id}',
      v4Pos: ' (position #{id})',

      // ── ENS ──
      ensCommit: 'Reserve an ENS name (step 1/2)',
      ensRegister: 'Register {name}.eth · {years} year(s)',
      ensRenew: 'Renew {name}.eth · {years} year(s)',

      // ── Generic ──
      fnSendEth: 'send ETH',
      emptyCall: 'empty call',
      multicall: 'multicall ({n})',
      unrecognized: 'unrecognized action ({sel})',
      warnUnrecognized: 'Unrecognized action',
      warnUnknownContract: 'Interacts with an unrecognized contract',
    },
  },

  es: {
    wc: {
      // ── Aprobaciones ──
      unlimited: 'ILIMITADO',
      unlimitedAmt: '{sym} ILIMITADO',
      spenderPermit2: 'Permit2 (Uniswap)',
      spenderKnown: 'un contrato conocido',
      spenderUnknown: 'una dirección desconocida',
      approve: 'Aprobar {amt} a {spender}',
      warnApproveUnknown: 'Aprobación a dirección DESCONOCIDA',
      warnApproveUnlimited: 'Aprobación ilimitada (a contrato conocido)',
      incAllowKnown: 'Aumentar allowance a un contrato conocido',
      incAllowUnknown: 'Aumentar allowance a dirección desconocida',
      warnIncAllow: 'Aumenta allowance a dirección desconocida',
      nftApproveAll: 'Dar control de TODOS tus NFTs de esta colección',
      nftRevokeAll: 'Revocar control de los NFTs de esta colección',
      warnNftApproveAll: 'Da control de TODOS tus NFTs de esta colección',

      // ── Transferencias ──
      destKnown: 'destino conocido',
      destUnknown: 'destino desconocido',
      transfer: 'Enviar {amt} → {dest}',
      transferFrom: 'Mover {amt} → {dest}',
      warnTransferUnknown: 'Transfiere tokens a dirección desconocida',
      warnTransferFromUnknown: 'Mueve tokens a dirección desconocida',
      sendEth: 'Enviar {amt} ETH',
      sendEthUnknown: 'Enviar {amt} ETH a dirección desconocida',
      warnSendEthUnknown: 'Envío de ETH a dirección desconocida',

      // ── WETH ──
      wrap: 'Envolver {amt} ETH → WETH',
      unwrap: 'Desenvolver {amt} WETH → ETH',
      unwrapMin: 'Desenvolver WETH → ETH (mín {amt})',
      wrapShort: 'Envolver ETH → WETH',
      unwrapShort: 'Desenvolver WETH → ETH',

      // ── Aave v3 ──
      aaveSupply: 'Depositar {amt} en Aave',
      aaveWithdraw: 'Retirar {amt} de Aave',
      aaveBorrow: 'Pedir prestado {amt} en Aave',
      aaveRepay: 'Devolver {amt} a Aave',
      warnAaveBorrow: 'Genera deuda en Aave',

      // ── Liquidez Uniswap v3 ──
      lpMint: 'Añadir liquidez · {a} + {b}',
      lpIncrease: 'Añadir liquidez a la posición #{id}',
      lpDecrease: 'Retirar liquidez de la posición #{id}',
      lpCollect: 'Cobrar comisiones de la posición #{id}',
      lpBurn: 'Cerrar posición #{id} (NFT de liquidez)',

      // ── Swaps ──
      swapIn: 'Swap {amt} → {sym} (mín {min})',
      swapOut: 'Swap {sym} → {amt} (máx {max})',
      swapInPath: 'Swap (entrada {amt}, salida mínima {min})',
      swapOutPath: 'Swap (salida {amt}, entrada máx {max})',
      swapV2: 'Swap en Uniswap v2',
      swapV4: 'Swap en Uniswap v4',
      refundEth: 'Devolver el ETH sobrante',
      permit2: 'Permiso Permit2',
      urGeneric: 'Operación en Uniswap (Universal Router)',
      warnUrGeneric: 'Comandos del Universal Router no detallados',

      // ── Liquidez Uniswap v4 ──
      v4Add: 'Añadir liquidez a una posición (Uniswap v4)',
      v4Remove: 'Retirar liquidez de una posición (Uniswap v4)',
      v4Create: 'Crear posición de liquidez (Uniswap v4)',
      v4Close: 'Cerrar posición (Uniswap v4)',
      v4Manage: 'Gestionar liquidez (Uniswap v4)',
      v4Max: ' · máx {a} + {b}',
      v4ToPos: ' a la posición #{id}',
      v4Pos: ' (posición #{id})',

      // ── ENS ──
      ensCommit: 'Reservar un nombre ENS (paso 1/2)',
      ensRegister: 'Registrar {name}.eth · {years} año(s)',
      ensRenew: 'Renovar {name}.eth · {years} año(s)',

      // ── Genérico ──
      fnSendEth: 'enviar ETH',
      emptyCall: 'llamada vacía',
      multicall: 'multicall ({n})',
      unrecognized: 'acción no reconocida ({sel})',
      warnUnrecognized: 'Acción no reconocida',
      warnUnknownContract: 'Interactúa con un contrato no reconocido',
    },
  },
}
