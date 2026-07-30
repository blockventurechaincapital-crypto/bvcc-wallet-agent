export const walletversion = {
  en: {
    wallet: {
      outdatedTitle: 'You are on BVCC Wallet V{version}',
      outdatedBody:
        'The current generation is V{current}. Your wallet still runs V{version} bytecode, which a later release fixed — it keeps working, but it does not carry the newer protections.',
      outdatedHow:
        'A wallet address derives from your passkey and the factory that created it, so upgrading in place is not possible: create a V{current} wallet with the same passkey and move your funds across.',
      outdatedNewAddress: 'Your V4 address will be',
      outdatedCta: 'Create V4 wallet',
      outdatedLater: 'Later',
      recoveryMissingTitle: 'Recovery is not set up',
      recoveryMissingBody:
        'This wallet has no guardians registered, so if you lose your passkey there is no way to recover it. Setting them takes one signature.',
      recoveryMissingCta: 'Set up now',
    },
  },
  es: {
    wallet: {
      outdatedTitle: 'Estás usando BVCC Wallet V{version}',
      outdatedBody:
        'La versión actual es la V{current}. Tu wallet sigue ejecutando bytecode de V{version}, que una versión posterior corrigió — funciona igual, pero no lleva las protecciones nuevas.',
      outdatedHow:
        'La dirección de una wallet se deriva de tu passkey y de la factory que la creó, así que no se puede actualizar en el sitio: crea una wallet V{current} con la misma passkey y mueve tus fondos.',
      outdatedNewAddress: 'Tu dirección V4 será',
      outdatedCta: 'Crear wallet V4',
      outdatedLater: 'Más tarde',
      recoveryMissingTitle: 'La recuperación no está configurada',
      recoveryMissingBody:
        'Esta wallet no tiene guardianes registrados, así que si pierdes la passkey no hay forma de recuperarla. Configurarlos es una sola firma.',
      recoveryMissingCta: 'Configurar ahora',
    },
  },
} as const
