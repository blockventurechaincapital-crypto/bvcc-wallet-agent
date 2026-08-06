export const connect = {
  en: {
    connect: {
      errNoWallet: 'No active wallet. Go back to the start.',
      errNoToken: 'No token selected.',
      errNoCalls: 'Nothing to execute.',
      errNoPool: 'No pool with liquidity for this pair.',
      errSwapUnavailable: 'Swap is not available on this network.',
      errInsufficientFee: 'Not enough balance to cover the wallet fee (0.05% / 0.15%).',
      errCancelled: 'Operation cancelled.',
      errNoGas: 'The wallet does not have enough ETH to pay for this operation.',
      errMoreGas: 'The operation needed more gas than estimated. Try again.',
      errWrongChain: 'The dApp asked for a network this wallet does not support.',
      unknownDapp: 'Unknown dApp',
      known: 'known',
      unknownTarget: 'unknown',
      unlimited: 'Unlimited',
      signNumber: 'Sign #{n} with biometrics',
      // ConnectButton
      connectWallet: 'Connect wallet',
      connectWith: 'Connect with',
      copyAddressTitle: 'Copy address',
      disconnect: 'Disconnect',

      // WC QR modal (inside ConnectButton)
      wcScanTitle: 'Scan with your wallet',
      wcScanHint: 'Open your mobile wallet and scan the QR to connect',
      wcCopyUri: 'Copy URI',

      // WcConnectModal
      dappRequest: 'dApp request',
      reject: 'Reject',
      approveWithFaceId: 'Approve with biometrics',
      processing: 'Processing…',
      // tx detail labels
      to: 'To',
      value: 'Value',
      data: 'Data',
      // loading steps
      fetchingNonce: 'Fetching nonce…',
      computingHash: 'Computing hash…',
      waitingFaceId: 'Waiting for biometrics…',
      sendingTx: 'Sending transaction…',

      // pending requests inbox (Safe-style)
      pendingTitle: 'Pending signature',
      pendingFrom: 'Request from',
      pendingSign: 'Review & sign',
      pendingTx: 'Transaction',
      pendingSignature: 'Signature',
      pendingQueued: 'Queued',
      pendingWaiting: 'Waiting for previous tx…',
    },
  },
  es: {
    connect: {
      errNoWallet: 'No hay wallet activa. Vuelve al inicio.',
      errNoToken: 'No hay token seleccionado.',
      errNoCalls: 'No hay llamadas que ejecutar.',
      errNoPool: 'No hay pool con liquidez para este par.',
      errSwapUnavailable: 'El swap no está disponible en esta red.',
      errInsufficientFee: 'Saldo insuficiente para cubrir el fee de la wallet (0,05 % / 0,15 %).',
      errCancelled: 'Operación cancelada.',
      errNoGas: 'La wallet no tiene suficiente ETH para pagar esta operación.',
      errMoreGas: 'La operación necesitó más gas del estimado. Reinténtala.',
      errWrongChain: 'La dApp pidió una red que esta wallet no soporta.',
      unknownDapp: 'dApp desconocida',
      known: 'conocido',
      unknownTarget: 'desconocido',
      unlimited: 'Ilimitado',
      signNumber: 'Firmar #{n} con biometría',
      // ConnectButton
      connectWallet: 'Conectar wallet',
      connectWith: 'Conectar con',
      copyAddressTitle: 'Copiar dirección',
      disconnect: 'Desconectar',

      // WC QR modal (inside ConnectButton)
      wcScanTitle: 'Escanea con tu wallet',
      wcScanHint: 'Abre tu wallet móvil y escanea el QR para conectar',
      wcCopyUri: 'Copiar URI',

      // WcConnectModal
      dappRequest: 'Solicitud de dApp',
      reject: 'Rechazar',
      approveWithFaceId: 'Aprobar con biometría',
      processing: 'Procesando…',
      // tx detail labels
      to: 'Para',
      value: 'Valor',
      data: 'Data',
      // loading steps
      fetchingNonce: 'Obteniendo nonce…',
      computingHash: 'Calculando hash…',
      waitingFaceId: 'Esperando biometría…',
      sendingTx: 'Enviando transacción…',

      // pending requests inbox (Safe-style)
      pendingTitle: 'Firma pendiente',
      pendingFrom: 'Solicitud de',
      pendingSign: 'Revisar y firmar',
      pendingTx: 'Transacción',
      pendingSignature: 'Firma',
      pendingQueued: 'En cola',
      pendingWaiting: 'Esperando la tx anterior…',
    },
  },
}
