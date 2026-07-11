import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseReady } from '@/lib/supabase/client'
import { logger } from '@/core/logger'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseReady) {
      // No credentials (e.g. tests) — behave as logged-out.
      setLoading(false)
      return
    }
    const supabase = getSupabaseClient()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: displayName ? { display_name: displayName } : undefined },
      })
      if (error) throw error
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) logger.error('Sign out failed', { error: error.message })
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [session, loading, signInWithPassword, signUpWithPassword, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
