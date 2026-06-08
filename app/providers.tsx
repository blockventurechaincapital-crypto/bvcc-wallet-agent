'use client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/lib/config'
import { NetworkProvider } from '@/lib/NetworkContext'
import { I18nProvider } from '@/lib/i18n/I18nContext'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Datos on-chain: refrescar al volver a la pestaña / reconectar para
        // que el dashboard refleje acciones recientes sin recargar a mano.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        staleTime: 10_000,
      },
    },
  }))
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <NetworkProvider>
            {children}
          </NetworkProvider>
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
