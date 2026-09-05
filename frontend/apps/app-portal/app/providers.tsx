"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { Toaster } from "sonner"
import { AuthProvider } from "@/lib/auth-context"
import { FeatureLockProvider } from "@/lib/feature-lock-context"
import { PermissionProvider } from "@/lib/permission-context"

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          retry: (failureCount, error) => {
            // Never retry rate-limited requests — each retry re-uses the same
            // IP bucket and only keeps a 429 regime alive.
            const status = (error as any)?.response?.status
            return status !== 429 && failureCount < 2
          },
        },
      },
    })
  )

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <FeatureLockProvider>
          <PermissionProvider>
            <Toaster position="top-right" richColors closeButton />
            {children}
          </PermissionProvider>
        </FeatureLockProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
