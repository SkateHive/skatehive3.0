'use client'

import { AuthKitProvider } from '@farcaster/auth-kit'
import '@farcaster/auth-kit/styles.css'
import { useState, useEffect, ReactNode } from 'react'

interface ClientOnlyAuthKitProps {
  children: ReactNode
  config: {
    rpcUrl: string
    domain: string
    siweUri: string
    relay: string
  }
}

/**
 * Client-only wrapper for Farcaster AuthKit to prevent indexedDB SSR errors.
 * 
 * @farcaster/auth-kit uses indexedDB for auth state persistence, which crashes
 * during server-side rendering. This wrapper ensures the provider only mounts
 * on the client after hydration.
 */
export function ClientOnlyAuthKit({ children, config }: ClientOnlyAuthKitProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR and before hydration, render children without AuthKit
  if (!mounted) {
    return <>{children}</>
  }

  // After client-side mount, wrap with AuthKitProvider
  return (
    <AuthKitProvider config={config}>
      {children}
    </AuthKitProvider>
  )
}
