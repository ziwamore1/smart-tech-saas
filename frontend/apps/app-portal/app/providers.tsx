"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { FeatureLockProvider } from "@/lib/feature-lock-context"

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          retry: 1,
        },
      },
    })
  )

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <FeatureLockProvider>
          {children}
        </FeatureLockProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
