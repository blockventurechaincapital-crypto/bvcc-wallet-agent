'use client'
// Retratos de agentes IA — PNG cuadrados (1254x1254) en public/agents/. Añade los tuyos ahí
// y registra los nombres en AGENT_AVATARS para que aparezcan en el selector.
// La elección por agente se guarda en localStorage (sin DB, igual que los alias).

export const AGENT_AVATARS: string[] = [
  'agent-01.png', 'agent-02.png', 'agent-03.png', 'agent-04.png', 'agent-05.png',
  'agent-06.png', 'agent-07.png', 'agent-08.png', 'agent-09.png', 'agent-10.png',
  'agent-11.png', 'agent-12.png', 'agent-13.png', 'agent-14.png',
]

export function avatarUrl(file?: string | null): string | null {
  return file ? `/agents/${file}` : null
}

const KEY = (wallet: string) => `bvcc_agent_avatars_${wallet.toLowerCase()}`

export function getAgentAvatars(wallet: string): Record<string, string> {
  if (typeof window === 'undefined' || !wallet) return {}
  try { return JSON.parse(localStorage.getItem(KEY(wallet)) || '{}') } catch { return {} }
}

export function setAgentAvatar(wallet: string, agent: string, file: string): void {
  if (typeof window === 'undefined') return
  const all = getAgentAvatars(wallet)
  all[agent.toLowerCase()] = file
  localStorage.setItem(KEY(wallet), JSON.stringify(all))
}
