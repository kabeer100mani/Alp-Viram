import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/auth-context'

/** Renders children only for an authenticated user; otherwise redirects to /login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
