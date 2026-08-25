import { isAddress } from 'viem'

// ───────────────────────────────────────────────────────────────────────────
// Validación de los tres guardianes, en un solo sitio
// ───────────────────────────────────────────────────────────────────────────
// La misma comprobación estaba escrita dos veces —en el alta (`app/page.tsx`) y
// en el reintento de `GuardianSetup`— y las dos miraban lo mismo: que sean
// direcciones y que no se repitan. Ahora hay tres sitios (el alta, el reintento
// y la rotación), así que la copia deja de ser un detalle y pasa a ser la
// garantía de que arreglar una no deja las otras a medias.
//
// El contrato ya rechaza la dirección cero y los duplicados
// (`BVCCWallet.sol:363-377`), o sea que esto NO tapa un agujero: evita que el
// usuario se entere DESPUÉS de gastar un prompt de passkey y el gas. Lo que
// aporta de verdad son las dos comprobaciones que el contrato no puede hacer,
// porque no sabe qué wallet se está creando ni quién está conectado:
//
//   · un guardián que sea la propia wallet — nunca podría aprobar nada, porque
//     firmar por ella exige la passkey que la recuperación da por perdida;
//   · un guardián que sea la EOA conectada — legítimo (mucha gente se pone a sí
//     misma de guardián en otro dispositivo), pero merece un aviso: si esa
//     cuenta vive en el mismo sitio que la passkey, el 2-de-3 protege menos de
//     lo que parece. Se AVISA, no se bloquea.

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type GuardianCheck = {
  /** Clave i18n del motivo por el que no se puede continuar, o `null`. */
  errorKey: string | null
  /** Clave i18n de un aviso que no bloquea, o `null`. */
  warningKey: string | null
}

export function validateGuardians(
  guardians: readonly string[],
  opts: { walletAddress?: string | null; connectedAddress?: string | null } = {},
): GuardianCheck {
  const gs = guardians.map(g => (g ?? '').trim())

  if (gs.length !== 3 || !gs.every(g => isAddress(g))) {
    return { errorKey: 'appshell.guardianErrorInvalid', warningKey: null }
  }

  const lower = gs.map(g => g.toLowerCase())

  if (lower.some(g => g === ZERO_ADDRESS)) {
    return { errorKey: 'appshell.guardianErrorZero', warningKey: null }
  }
  if (new Set(lower).size !== 3) {
    return { errorKey: 'appshell.guardianErrorNotUnique', warningKey: null }
  }

  const self = opts.walletAddress?.toLowerCase()
  if (self && lower.some(g => g === self)) {
    return { errorKey: 'appshell.guardianErrorSelf', warningKey: null }
  }

  const eoa = opts.connectedAddress?.toLowerCase()
  const warningKey = eoa && lower.some(g => g === eoa) ? 'appshell.guardianWarnConnected' : null

  return { errorKey: null, warningKey }
}
