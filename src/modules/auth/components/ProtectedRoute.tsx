import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/modules/auth/auth-context'

/** Renders children only for an authenticated user; otherwise redirects to /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (!session) {
    // Preserve where the user was headed — otherwise an invite link
    // (/invite?token=…) loses its token across the login redirect, and a new
    // user signing up to accept an invite would never actually join.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}
