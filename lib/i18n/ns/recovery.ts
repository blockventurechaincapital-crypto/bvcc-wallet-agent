export const recovery = {
  en: {
    recovery: {
      // ── recover/page.tsx ──────────────────────────────────────────────────
      back: 'Back',
      title: 'Recover wallet',
      subtitle: '2 of 3 guardians required. The owner generates a new key and shares it with their guardians.',

      // Section: wallet address
      walletToRecover: 'Wallet to recover',
      load: 'Load',
      invalidAddress: 'Invalid Ethereum address',

      // Section: guardians list
      guardiansLabel: 'Guardians',
      youLabel: '← you',
      approved: '✓ approved',
      pending: '○ pending',

      // Recovery state banner
      stateIdle: 'No active recovery',
      stateInProgress: 'In progress — {approvals}/2 signatures',
      stateReady: 'Ready to execute',
      timelockRemaining: 'Timelock: {time} remaining',
      waitingSecondGuardian: 'Waiting for 2nd guardian signature',
      timelockExpiredAny: 'Timelock expired — any guardian can execute',

      // Section: owner
      ownerTitle: "I'm the owner — generate new key",
      ownerDesc: 'Register a new passkey on this device. Share the X and Y coordinates with 2 of your guardians.',
      generatePasskey: 'Generate new passkey',
      waitingBiometrics: 'Waiting for biometrics…',
      passkeyGenerated: '✓ Passkey generated — copy these values and share them with your guardians',
      coordX: 'Coordinate X (newX)',
      coordY: 'Coordinate Y (newY)',
      copied: '✓ copied',
      copy: 'copy',
      generateAnother: 'Generate another',
      savePasskeyAndAccess: 'Save new passkey and access →',
      errorGenerating: 'Error generating passkey',

      // Section: guardian
      guardianTitle: "I'm a guardian — sign recovery",
      connectMetaMaskDesc: 'Connect your MetaMask wallet to verify if you are a guardian of this wallet.',
      connectMetaMask: 'Connect MetaMask',
      switchNetwork: 'Switch to {network}',
      notGuardian: 'The connected wallet ({addr}) is not a guardian of this wallet.',
      connectAnotherAccount: 'Connect another account',
      connectedAsGuardian: '✓ Connected as Guardian {n} ({addr})',

      // Idle state (guardian)
      pasteCoords: 'Paste the new key coordinates that the owner shared with you.',
      newKeyX: 'New key X (newX)',
      newKeyY: 'New key Y (newY)',
      invalidCoords: 'Invalid coordinates (must be hex 0x…)',
      coordsNotOnCurve: 'These are not a valid P-256 public key — a digit is wrong or missing. Do not send them: the contract only checks the curve on the last step, and by then a recovery started with a bad key can no longer be finished, restarted, or cancelled without the passkey you are trying to replace.',
      coordsMismatchGenerated: 'These are not the coordinates of the passkey generated on this device. If you are starting a recovery for someone else\'s key, clear the generated one first with "Generate another".',
      initiateRecovery: 'Initiate recovery',
      waitingSignature: 'Waiting for signature…',
      confirming: 'Confirming…',

      // In-progress state (guardian)
      approveDesc: 'A recovery is already in progress. Approve it to reach the 2/2 threshold.',
      approveRecovery: 'Approve recovery',

      // The key the pending recovery would install (shown to every guardian)
      pendingKeyTitle: 'Key this recovery would install',
      pendingKeyDesc: 'Once two guardians approve and the timelock expires, this key becomes the wallet owner. Whoever holds it controls the wallet and everything in it. Check both values with the owner over a channel you trust — a phone call, in person — and not over whatever sent them to you.',
      pendingKeyMatches: '✓ Matches the passkey generated on this device',
      pendingKeyDiffers: '⚠ Does NOT match the passkey generated on this device',
      pendingVerifiedCheckbox: 'I checked these coordinates with the owner through another channel',

      // Timelock active
      timelockActive: 'Timelock active — {time} remaining',
      timelockActiveDesc: 'The owner can cancel the recovery during this window. Come back when it expires.',

      // Already approved
      alreadyApproved: 'You have already approved this recovery. Waiting for {waiting}.',
      waitingOtherGuardian: 'another guardian signature.',
      waitingTimelockExpiry: 'the timelock to expire ({time}).',

      // Ready state (guardian)
      readyDesc: 'Timelock expired. Execute the recovery to change the wallet signer.',
      executeRecovery: 'Execute recovery',
      recoveryExecuted: '✓ recovery executed',

      // TX status
      txConfirming: '— confirming…',
      txConfirmed: '✓ confirmed',

      // ── cancel-recovery/page.tsx ──────────────────────────────────────────
      cancelTitle: 'Cancel recovery',
      cancelDesc: 'Sign with your current biometrics to cancel this recovery. Guardians can initiate a new one in the future if needed.',
      cancelWarningTitle: '⚠️ Recovery in progress',
      cancelWarningDesc: "A guardian has initiated the recovery of your wallet. If you did not authorise this process, cancel it now with your biometrics.",
      cancelBtn: 'Cancel recovery with biometrics',
      cancelBtnSigning: 'Waiting for biometrics…',
      cancelBtnSending: 'Sending…',
      walletLabel: 'Wallet',
      successTitle: 'Recovery cancelled',
      successDesc: 'Your wallet is secure. The recovery process has been cancelled.',
      backToDashboard: 'Back to dashboard',
      retry: 'Retry',
    },
  },
  es: {
    recovery: {
      // ── recover/page.tsx ──────────────────────────────────────────────────
      back: 'Volver',
      title: 'Recuperar wallet',
      subtitle: '2 de 3 guardians necesarios. El dueño genera una nueva clave y la comparte con sus guardians.',

      // Section: wallet address
      walletToRecover: 'Wallet a recuperar',
      load: 'Cargar',
      invalidAddress: 'Dirección Ethereum inválida',

      // Section: guardians list
      guardiansLabel: 'Guardians',
      youLabel: '← tú',
      approved: '✓ aprobó',
      pending: '○ pendiente',

      // Recovery state banner
      stateIdle: 'Sin recovery activo',
      stateInProgress: 'En progreso — {approvals}/2 firmas',
      stateReady: 'Listo para ejecutar',
      timelockRemaining: 'Timelock: {time} restantes',
      waitingSecondGuardian: 'Esperando 2ª firma de guardian',
      timelockExpiredAny: 'Timelock expirado — cualquier guardian puede ejecutar',

      // Section: owner
      ownerTitle: 'Soy el dueño — generar nueva clave',
      ownerDesc: 'Registra una nueva passkey en este dispositivo. Comparte las coordenadas X e Y con 2 de tus guardians.',
      generatePasskey: 'Generar nueva passkey',
      waitingBiometrics: 'Esperando biometría...',
      passkeyGenerated: '✓ Passkey generada — copia estos valores y compártelos con tus guardians',
      coordX: 'Coordenada X (newX)',
      coordY: 'Coordenada Y (newY)',
      copied: '✓ copiado',
      copy: 'copiar',
      generateAnother: 'Generar otra',
      savePasskeyAndAccess: 'Guardar nueva passkey y acceder →',
      errorGenerating: 'Error generando la passkey',

      // Section: guardian
      guardianTitle: 'Soy guardian — firmar recovery',
      connectMetaMaskDesc: 'Conecta tu wallet MetaMask para verificar si eres guardian de esta wallet.',
      connectMetaMask: 'Conectar MetaMask',
      switchNetwork: 'Cambiar a {network}',
      notGuardian: 'La wallet conectada ({addr}) no es guardian de esta wallet.',
      connectAnotherAccount: 'Conectar otra cuenta',
      connectedAsGuardian: '✓ Conectado como Guardian {n} ({addr})',

      // Idle state (guardian)
      pasteCoords: 'Pega las coordenadas de la nueva clave que el dueño te compartió.',
      newKeyX: 'Nueva clave X (newX)',
      newKeyY: 'Nueva clave Y (newY)',
      invalidCoords: 'Coordenadas inválidas (deben ser hex 0x...)',
      coordsNotOnCurve: 'Esto no es una clave pública P-256 válida — falta un dígito o hay uno cambiado. No las envíes: el contrato solo comprueba la curva en el último paso, y para entonces un recovery iniciado con una clave mala ya no se puede terminar, ni reiniciar, ni cancelar sin la passkey que estás intentando sustituir.',
      coordsMismatchGenerated: 'Estas no son las coordenadas de la passkey generada en este dispositivo. Si estás iniciando el recovery de la clave de otra persona, borra antes la generada con «Generar otra».',
      initiateRecovery: 'Iniciar recovery',
      waitingSignature: 'Esperando firma...',
      confirming: 'Confirmando...',

      // In-progress state (guardian)
      approveDesc: 'Ya hay un recovery en curso. Apruébalo para alcanzar el umbral de 2/2.',
      approveRecovery: 'Aprobar recovery',

      // The key the pending recovery would install (shown to every guardian)
      pendingKeyTitle: 'Clave que instalaría este recovery',
      pendingKeyDesc: 'Cuando dos guardianes aprueben y expire el timelock, esta clave pasa a ser la dueña de la wallet. Quien la tenga controla la wallet y todo lo que hay dentro. Verifica los dos valores con el propietario por un canal del que te fíes — una llamada, en persona — y no por el mismo por el que te llegaron.',
      pendingKeyMatches: '✓ Coincide con la passkey generada en este dispositivo',
      pendingKeyDiffers: '⚠ NO coincide con la passkey generada en este dispositivo',
      pendingVerifiedCheckbox: 'He verificado estas coordenadas con el propietario por otro canal',

      // Timelock active
      timelockActive: 'Timelock activo — {time} restantes',
      timelockActiveDesc: 'El dueño puede cancelar el recovery durante esta ventana. Vuelve cuando expire.',

      // Already approved
      alreadyApproved: 'Ya aprobaste este recovery. Esperando {waiting}.',
      waitingOtherGuardian: 'otra firma de guardian.',
      waitingTimelockExpiry: 'que expire el timelock ({time}).',

      // Ready state (guardian)
      readyDesc: 'Timelock expirado. Ejecuta el recovery para cambiar el signer de la wallet.',
      executeRecovery: 'Ejecutar recovery',
      recoveryExecuted: '✓ recovery ejecutado',

      // TX status
      txConfirming: '— confirmando...',
      txConfirmed: '✓ confirmada',

      // ── cancel-recovery/page.tsx ──────────────────────────────────────────
      cancelTitle: 'Cancelar recovery',
      cancelDesc: 'Firma con tu biometría actual para anular este recovery. Los guardians podrán iniciar uno nuevo en el futuro si es necesario.',
      cancelWarningTitle: '⚠️ Recovery en progreso',
      cancelWarningDesc: 'Un guardian ha iniciado la recuperación de tu wallet. Si no autorizaste este proceso, cancélalo ahora con tu biometría.',
      cancelBtn: 'Cancelar recovery con biometría',
      cancelBtnSigning: 'Esperando biometría...',
      cancelBtnSending: 'Enviando...',
      walletLabel: 'Wallet',
      successTitle: 'Recovery cancelado',
      successDesc: 'Tu wallet está segura. El proceso de recovery ha sido anulado.',
      backToDashboard: 'Volver al dashboard',
      retry: 'Reintentar',
    },
  },
}
