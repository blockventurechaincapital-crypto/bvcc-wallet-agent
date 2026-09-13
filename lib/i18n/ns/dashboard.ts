export const dashboard = {
  en: {
    dashboard: {
      // Page heading
      assets: 'Assets',

      // Multi-chain view selector
      networksCount: '{n} networks',
      networksFilter: 'Networks shown',

      // Pending activation badge
      pendingActivation: 'Pending activation',

      // Balance card
      totalBalance: 'Total balance',
      contract: 'Contract',

      // Action buttons
      send: 'Send',
      receive: 'Receive',
      swap: 'Swap Fast',

      // WalletConnect card
      wcSubtitle: 'Connect this wallet to any dApp',
      wcInputPlaceholder: 'Paste WalletConnect URI (wc:abc123...@2?...)',
      wcConnect: 'Connect',
      wcConnecting: 'Connecting…',
      wcHint: 'Copy the WalletConnect URI from any dApp and paste it here',
      wcActiveSessions: 'Active connections',

      // Account status card
      accountTitle: 'Account',
      statusActive: 'Active',
      statusPending: 'Not deployed',
      accountType: 'Type',
      typeSmart: 'Smart Wallet',
      typeAgent: 'Agent Wallet',
      accountOps: 'Operations',
      accountGuardians: 'Guardians',
      accountSigner: 'Signer (P256)',

      // Deploy on this network (cross-chain)
      depBtn: 'Deploy on this network',
      depTitle: 'Deploy wallet',
      depDesc: 'Your wallet already exists on another network. Deploying here recreates it with the same address, the same passkey and the same guardians. The connected wallet pays the gas.',
      depLoading: 'Reading wallet data from the source network…',
      depNoSource: 'Could not find this wallet deployed on any other network.',
      depSameAddr: 'Address (same on every network)',
      depSource: 'Copied from',
      depConnect: 'Connect a wallet (top-right button) to pay the deployment gas.',
      depSwitch: 'Switch network in your wallet',
      depAction: 'Deploy',
      depDeploying: 'Deploying…',
      depSuccess: 'Wallet deployed on this network',
      depRecoveryPending: 'Recovery is not set up on this network yet. Open the wallet and sign it with your passkey — until you do, this wallet has no guardians here.',
      depAgentMissing: 'The Agent Wallet factory is not available on this network yet.',
      depCredential: 'Passkey credential',
      depCredFound: 'Found',
      depRecoverCred: 'Recover with passkey',
      depRecovering: 'Waiting for passkey…',
      depWrongPasskey: 'That passkey does not match this wallet’s owner.',
      depRecoverFailed: 'Could not recover the credential from this device.',
      depAddrMismatch: 'Deploying here would create this wallet at a different address ({target}), not at {address}. The factory derives the address from the owner key, and this wallet’s key is no longer the one it was created with — after a guardian recovery — or it was made by an older factory. Funds sent to your usual address on this network would not reach it, so the deploy is not offered.',
      depAddrUnverified: 'Could not confirm which address the wallet would get on this network, so the deploy is not offered. Close this and try again.',

      // Token detail modal
      chartUnavailable: 'Price chart not available',
      yourBalance: 'Your balance',
      value: 'Value',

      // Agents card
      agentsTitle: 'Agents',
      agentsPaused: 'Paused',
      agentsManage: 'Manage agents',
      agentsEmpty: 'No agents authorized yet.',
      agentsAuthorize: 'Authorize an agent',
      agentPeriod: 'period',
      agentDaily: 'daily',
      agentTotal: 'total',
      agentUnlimited: 'Unlimited',
      agentLastActivity: 'Last activity',
      agentNever: 'No activity yet',
      agentPause: 'Pause',
      agentResume: 'Resume',

      // Recent transactions header
      recentTransactions: 'Recent transactions',
      viewAll: 'View all →',
    },
  },
  es: {
    dashboard: {
      // Page heading
      assets: 'Activos',

      // Multi-chain view selector
      networksCount: '{n} redes',
      networksFilter: 'Redes mostradas',

      // Pending activation badge
      pendingActivation: 'Pendiente de activación',

      // Balance card
      totalBalance: 'Balance total',
      contract: 'Contrato',

      // Action buttons
      send: 'Enviar',
      receive: 'Recibir',
      swap: 'Swap Fast',

      // WalletConnect card
      wcSubtitle: 'Conecta esta wallet a cualquier dApp',
      wcInputPlaceholder: 'Pega URI de WalletConnect (wc:abc123...@2?...)',
      wcConnect: 'Conectar',
      wcConnecting: 'Conectando…',
      wcHint: 'Copia la URI de WalletConnect desde cualquier dApp y pégala aquí',
      wcActiveSessions: 'Conexiones activas',

      // Account status card
      accountTitle: 'Cuenta',
      statusActive: 'Activa',
      statusPending: 'Sin desplegar',
      accountType: 'Tipo',
      typeSmart: 'Smart Wallet',
      typeAgent: 'Agent Wallet',
      accountOps: 'Operaciones',
      accountGuardians: 'Guardianes',
      accountSigner: 'Firmante (P256)',

      // Desplegar en esta red (cross-chain)
      depBtn: 'Desplegar en esta red',
      depTitle: 'Desplegar wallet',
      depDesc: 'Tu wallet ya existe en otra red. Desplegarla aquí la recrea con la misma dirección, la misma passkey y los mismos guardianes. La wallet conectada paga el gas.',
      depLoading: 'Leyendo los datos de la wallet desde la red de origen…',
      depNoSource: 'No se encontró esta wallet desplegada en ninguna otra red.',
      depSameAddr: 'Dirección (la misma en todas las redes)',
      depSource: 'Copiada desde',
      depConnect: 'Conecta una wallet (botón arriba a la derecha) para pagar el gas del despliegue.',
      depSwitch: 'Cambia de red en tu wallet',
      depAction: 'Desplegar',
      depDeploying: 'Desplegando…',
      depSuccess: 'Wallet desplegada en esta red',
      depRecoveryPending: 'La recuperación aún no está configurada en esta red. Entra en la wallet y fírmala con tu passkey — hasta entonces esta wallet no tiene guardianes aquí.',
      depAgentMissing: 'La factory de Agent Wallet aún no está disponible en esta red.',
      depCredential: 'Credencial passkey',
      depCredFound: 'Encontrada',
      depRecoverCred: 'Recuperar con passkey',
      depRecovering: 'Esperando la passkey…',
      depWrongPasskey: 'Esa passkey no coincide con el dueño de esta wallet.',
      depRecoverFailed: 'No se pudo recuperar la credencial desde este dispositivo.',
      depAddrMismatch: 'Desplegar aquí crearía esta wallet en otra dirección ({target}), no en {address}. La factory calcula la dirección a partir de la clave del dueño, y la de esta wallet ya no es con la que se creó —tras una recuperación con guardianes— o la creó una factory anterior. Lo que se envíe a tu dirección de siempre en esta red no llegaría a ella, así que no se ofrece el despliegue.',
      depAddrUnverified: 'No se pudo confirmar qué dirección tendría la wallet en esta red, así que no se ofrece el despliegue. Cierra y vuelve a intentarlo.',

      // Token detail modal
      chartUnavailable: 'Gráfica de precio no disponible',
      yourBalance: 'Tu balance',
      value: 'Valor',

      // Agents card
      agentsTitle: 'Agentes',
      agentsPaused: 'Pausados',
      agentsManage: 'Gestionar agentes',
      agentsEmpty: 'Aún no hay agentes autorizados.',
      agentsAuthorize: 'Autorizar un agente',
      agentPeriod: 'periodo',
      agentDaily: 'diario',
      agentTotal: 'total',
      agentUnlimited: 'Sin límite',
      agentLastActivity: 'Última actividad',
      agentNever: 'Sin actividad aún',
      agentPause: 'Pausar',
      agentResume: 'Reactivar',

      // Recent transactions header
      recentTransactions: 'Transacciones recientes',
      viewAll: 'Ver todo →',
    },
  },
}
