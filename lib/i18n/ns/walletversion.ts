export const walletversion = {
  en: {
    wallet: {
      outdatedTitle: 'You are on BVCC Wallet V{version}',
      outdatedBody:
        'The current generation is V{current}. Your wallet still runs V{version} bytecode, which a later release fixed — it keeps working, but it does not carry the newer protections.',
      outdatedHow:
        'A wallet address derives from your passkey and the factory that created it, so upgrading in place is not possible: create a V{current} wallet with the same passkey and move your funds across.',
      outdatedNewAddress: 'Your V{current} address will be',
      outdatedCta: 'Create V{current} wallet',
      outdatedLater: 'Later',
      recoveryMissingTitle: 'Recovery is not set up',
      recoveryMissingBody:
        'This wallet has no guardians registered, so if you lose your passkey there is no way to recover it. Setting them takes one signature.',
      recoveryMissingCta: 'Set up now',
      recoveryMissingLastAttempt: 'Last attempt:',
      staleCredentialTitle: 'Your passkey changed',
      staleCredentialBody:
        'This wallet now answers to a different passkey than the one this browser remembers, probably after a recovery. Pick your current passkey so you can sign again.',
      staleCredentialCta: 'Pick my passkey',
      staleCredentialBusy: 'Waiting for the passkey…',
      staleCredentialWrong: 'That passkey is not the owner of this wallet. Pick the other one.',
      staleCredentialFailed: 'The passkey could not be read. Try again.',
    },
  },
  es: {
    wallet: {
      outdatedTitle: 'Estás usando BVCC Wallet V{version}',
      outdatedBody:
        'La versión actual es la V{current}. Tu wallet sigue ejecutando bytecode de V{version}, que una versión posterior corrigió — funciona igual, pero no lleva las protecciones nuevas.',
      outdatedHow:
        'La dirección de una wallet se deriva de tu passkey y de la factory que la creó, así que no se puede actualizar en el sitio: crea una wallet V{current} con la misma passkey y mueve tus fondos.',
      outdatedNewAddress: 'Tu dirección V{current} será',
      outdatedCta: 'Crear wallet V{current}',
      outdatedLater: 'Más tarde',
      recoveryMissingTitle: 'La recuperación no está configurada',
      recoveryMissingBody:
        'Esta wallet no tiene guardianes registrados, así que si pierdes la passkey no hay forma de recuperarla. Configurarlos es una sola firma.',
      recoveryMissingCta: 'Configurar ahora',
      recoveryMissingLastAttempt: 'Último intento:',
      staleCredentialTitle: 'Tu passkey ha cambiado',
      staleCredentialBody:
        'Esta wallet responde ahora a una passkey distinta de la que recuerda este navegador, seguramente tras una recuperación. Elige tu passkey actual para poder firmar de nuevo.',
      staleCredentialCta: 'Elegir mi passkey',
      staleCredentialBusy: 'Esperando a la passkey…',
      staleCredentialWrong: 'Esa passkey no es la dueña de esta wallet. Elige la otra.',
      staleCredentialFailed: 'No se pudo leer la passkey. Inténtalo de nuevo.',
    },
  },
} as const
