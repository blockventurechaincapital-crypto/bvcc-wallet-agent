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
      warnApproveExcessive: 'Approval for more than {n}× what you hold of this token',
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

      // ── Where the money ends up ──
      toThirdParty: '→ {addr}',
      warnRecipient: 'The funds end up at {addr}, NOT in your wallet',
      warnRecipientKnown: 'The funds end up at {addr} (from your address book), not in this wallet',
      fee: 'fee {pct}% → {addr}',
      warnFeeHuge: 'A “fee” of {pct}% is taken out of this operation',
      sweepToken: 'Withdraw the remaining {sym} from the router',
      aaveOnBehalf: 'debt in the name of {addr}',

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
      swapV4: 'Swap on Uniswap v4',
      refundEth: 'Refund leftover ETH',
      permit2: 'Permit2 permission',
      urGeneric: 'Uniswap operation (Universal Router)',
      warnUrGeneric: 'Universal Router commands not detailed',
      urSweep: 'Withdraw the remaining {sym}',
      urTransfer: 'Send {sym}',
      urPermitTransfer: 'Move {sym} via Permit2',
      urPermitTransferBatch: 'Move {n} token(s) via Permit2',
      urPayPortion: 'Interface fee in {sym}',
      urBalanceCheck: 'Check balance',
      warnPermit2Unknown: 'Permit2 permission granted to {addr}, an address this wallet does not know',
      urPositionCall: 'Liquidity position call (Uniswap)',
      warnUrPositionCall: 'Includes a position call that is not broken down here',
      urUndecoded: '{n} command(s) this wallet CANNOT read: {cmds}',
      warnUrUndecoded: 'Includes Universal Router commands that could not be decoded — the summary above is incomplete',

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

      // ── What a signature authorises (lib/wcSignatures.ts) ──
      sigPermitOne: 'You authorise {spender} to spend {amt}',
      sigPermitMany: 'You authorise {spender} to spend {n} token(s)',
      sigPermitTransfer: 'You authorise {spender} to take {amt}',
      sigGeneric: 'Signature of type {type}',
      sigUnreadable: 'Unreadable signature payload',
      warnSigUnreadable: 'This wallet could not read what you are being asked to sign',
      warnSigSpenderUnknown: 'You are authorising {addr}, an address this wallet does not know, to move your tokens without asking you again',
      warnSigUnlimited: 'The permission is UNLIMITED: there is no cap on how much can be spent',
      warnSigGeneric: 'This wallet cannot tell what this signature authorises. Read the fields before signing.',
      sigSelf: 'your wallet',
      sigKnownAddr: 'known',
      sigUnknownAddr: 'UNKNOWN',
      sigNoExpiry: 'never expires',
      sigExpired: 'already expired',
      sigFarFuture: 'in {n} days',
      sigTruncated: '(+{n} characters)',
      sigMoreFields: '{n} more field(s) not shown',
      sigFieldSpender: 'Who can spend it',
      sigFieldOwner: 'Owner',
      sigFieldToken: 'Token',
      sigFieldAmount: 'Amount',
      sigFieldExpiration: 'Permission expires',
      sigFieldDeadline: 'Signature valid until',
      warnSigHash: 'This is not a message: it is 32 raw bytes, a hash. Signing it can authorise something you cannot see.',
      warnSigBinary: 'The content is not readable text — it is shown raw',
      warnSigBidi: 'The message contains characters that reorder the text: what you read may not be what you sign',
      warnSigControl: 'The message contains invisible characters, marked below',

      // ── Generic ──
      fnSendEth: 'send ETH',
      emptyCall: 'empty call',
      multicall: 'multicall ({n})',
      unrecognized: 'unrecognized action ({sel})',
      warnUnrecognized: 'Unrecognized action',
      warnUnrecognizedUnknown: 'Unrecognized action on a contract this wallet does not know either',
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
      warnApproveExcessive: 'Aprobación de más de {n} veces lo que tienes de este token',
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

      // ── A dónde acaba el dinero ──
      toThirdParty: '→ {addr}',
      warnRecipient: 'El dinero acaba en {addr}, NO en tu wallet',
      warnRecipientKnown: 'El dinero acaba en {addr} (de tu agenda), no en esta wallet',
      fee: 'comisión {pct} % → {addr}',
      warnFeeHuge: 'Se lleva una «comisión» del {pct} % de la operación',
      sweepToken: 'Sacar del router los {sym} que queden',
      aaveOnBehalf: 'deuda a nombre de {addr}',

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
      swapV4: 'Swap en Uniswap v4',
      refundEth: 'Devolver el ETH sobrante',
      permit2: 'Permiso Permit2',
      urGeneric: 'Operación en Uniswap (Universal Router)',
      warnUrGeneric: 'Comandos del Universal Router no detallados',
      urSweep: 'Sacar los {sym} que queden',
      urTransfer: 'Enviar {sym}',
      urPermitTransfer: 'Mover {sym} vía Permit2',
      urPermitTransferBatch: 'Mover {n} token(s) vía Permit2',
      urPayPortion: 'Comisión de la interfaz en {sym}',
      urBalanceCheck: 'Comprobar saldo',
      warnPermit2Unknown: 'Permiso de Permit2 a {addr}, una dirección que esta wallet no conoce',
      urPositionCall: 'Llamada a una posición de liquidez (Uniswap)',
      warnUrPositionCall: 'Incluye una llamada a posiciones que no se desglosa aquí',
      urUndecoded: '{n} comando(s) que esta wallet NO sabe leer: {cmds}',
      warnUrUndecoded: 'Incluye comandos del Universal Router que no se han podido descifrar — el resumen de arriba está incompleto',

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

      // ── Qué autoriza una firma (lib/wcSignatures.ts) ──
      sigPermitOne: 'Autorizas a {spender} a gastar {amt}',
      sigPermitMany: 'Autorizas a {spender} a gastar {n} token(s)',
      sigPermitTransfer: 'Autorizas a {spender} a llevarse {amt}',
      sigGeneric: 'Firma de tipo {type}',
      sigUnreadable: 'Contenido de firma ilegible',
      warnSigUnreadable: 'Esta wallet no ha podido leer lo que te piden firmar',
      warnSigSpenderUnknown: 'Autorizas a {addr}, una dirección que esta wallet no conoce, a mover tus tokens sin volver a pedirte permiso',
      warnSigUnlimited: 'El permiso es ILIMITADO: no hay tope de cuánto puede gastar',
      warnSigGeneric: 'Esta wallet no sabe qué autoriza esta firma. Lee los campos antes de firmar.',
      sigSelf: 'tu wallet',
      sigKnownAddr: 'conocida',
      sigUnknownAddr: 'DESCONOCIDA',
      sigNoExpiry: 'sin caducidad',
      sigExpired: 'ya caducado',
      sigFarFuture: 'dentro de {n} días',
      sigTruncated: '(+{n} caracteres)',
      sigMoreFields: '{n} campo(s) más sin mostrar',
      sigFieldSpender: 'Quién podrá gastarlo',
      sigFieldOwner: 'Titular',
      sigFieldToken: 'Token',
      sigFieldAmount: 'Cuánto',
      sigFieldExpiration: 'El permiso caduca',
      sigFieldDeadline: 'Firma válida hasta',
      warnSigHash: 'Esto no es un mensaje: son 32 bytes en crudo, un hash. Firmarlo puede autorizar algo que no puedes ver.',
      warnSigBinary: 'El contenido no es texto legible — se muestra en crudo',
      warnSigBidi: 'El mensaje lleva caracteres que reordenan el texto: lo que lees puede no ser lo que firmas',
      warnSigControl: 'El mensaje lleva caracteres invisibles, marcados abajo',

      // ── Genérico ──
      fnSendEth: 'enviar ETH',
      emptyCall: 'llamada vacía',
      multicall: 'multicall ({n})',
      unrecognized: 'acción no reconocida ({sel})',
      warnUnrecognized: 'Acción no reconocida',
      warnUnrecognizedUnknown: 'Acción no reconocida sobre un contrato que tampoco conocemos',
      warnUnknownContract: 'Interactúa con un contrato no reconocido',
    },
  },
}
