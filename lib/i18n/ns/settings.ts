export const settings = {
  en: {
    settings: {
      title: 'Settings',
      back: 'Back',
      // Section labels
      sectionNetwork: 'Current network',
      sectionGuardians: 'Recovery guardians',
      sectionSecurity: 'Security',
      sectionSession: 'Session & data',
      // Security
      atomicTitle: 'Atomic batch signing (EIP-5792)',
      atomicDesc: 'OFF (recommended): dApp batch requests are signed one by one, like a hardware wallet — one biometric confirmation per call, stopping if one fails. ON: the whole batch is signed with a single biometric confirmation and executed atomically (all-or-nothing). Useful for operations that must be indivisible (approve + action in one step, flash loans) and for fewer prompts.',
      atomicWarn: 'Risk: one signature authorizes several actions at once. A malicious dApp could hide a harmful action next to a legitimate one. Always review every call before approving.',
      maxGasTitle: 'Max gas per operation',
      maxGasDesc: 'Ceiling for the estimated gas limit of each operation. Leave empty for automatic per-network defaults (Ethereum L1: 3M · L2: 8M). Lower it if you want a tighter cap; it never overrides gas you set by hand in the Advanced panel.',
      maxGasAuto: 'Auto',
      // Network card
      entryPoint: 'EntryPoint',
      viewOnArbiscan: 'View wallet on Arbiscan',
      noActiveWallet: 'No active wallet',
      // Guardians
      guardiansHint: '2 of 3 signatures required to start wallet recovery',
      manageRecovery: 'Manage recovery',
      loading: 'Loading...',
      notAvailable: 'Not available',
      copyBtn: 'Copy',
      copyTitle: 'Copy',
      // Session
      credentialId: 'Credential ID (WebAuthn)',
      signOut: 'Sign out',
      clearAll: 'Delete all local data',
      clearConfirm: 'Delete all local data? This will remove your session, biometric credential and address book. You will not be able to recover access without your original WebAuthn device.',
      // Footer
      version: 'v1.0.3',
    },
  },
  es: {
    settings: {
      title: 'Configuración',
      back: 'Volver',
      // Section labels
      sectionNetwork: 'Red actual',
      sectionGuardians: 'Guardians de recuperación',
      sectionSecurity: 'Seguridad',
      sectionSession: 'Sesión y datos',
      // Security
      atomicTitle: 'Firmas en lote atómicas (EIP-5792)',
      atomicDesc: 'OFF (recomendado): las peticiones en lote de las dApps se firman una a una, como un hardware wallet — una confirmación biométrica por llamada, y si una falla se detiene. ON: todo el lote se firma con una sola confirmación biométrica y se ejecuta de forma atómica (todo o nada). Útil para operaciones que deben ser indivisibles (approve + acción en un paso, flash loans) y para menos confirmaciones.',
      atomicWarn: 'Riesgo: una sola firma autoriza varias acciones a la vez. Una dApp maliciosa podría colar una acción dañina junto a la legítima. Revisa siempre cada llamada antes de aprobar.',
      maxGasTitle: 'Gas máximo por operación',
      maxGasDesc: 'Tope para el gas limit estimado de cada operación. Déjalo vacío para los valores automáticos por red (Ethereum L1: 3M · L2: 8M). Bájalo si quieres un límite más estricto; nunca sobrescribe el gas que pongas a mano en el panel Avanzado.',
      maxGasAuto: 'Auto',
      // Network card
      entryPoint: 'EntryPoint',
      viewOnArbiscan: 'Ver wallet en Arbiscan',
      noActiveWallet: 'Sin wallet activa',
      // Guardians
      guardiansHint: 'Se requieren 2 de 3 firmas para iniciar la recuperación de tu wallet',
      manageRecovery: 'Gestionar recuperación',
      loading: 'Cargando...',
      notAvailable: 'No disponible',
      copyBtn: 'Copiar',
      copyTitle: 'Copiar',
      // Session
      credentialId: 'Credential ID (WebAuthn)',
      signOut: 'Cerrar sesión',
      clearAll: 'Borrar todos los datos locales',
      clearConfirm: '¿Borrar todos los datos locales? Esta acción eliminará tu sesión, credencial biométrica y libreta de direcciones. No podrás recuperar acceso sin tu dispositivo WebAuthn original.',
      // Footer
      version: 'v1.0.3',
    },
  },
}
