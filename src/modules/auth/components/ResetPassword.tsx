import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/modules/auth/auth-context'
import { credentialsSchema } from '@/modules/auth/validation'

/**
 * The page the password-reset email links to. Supabase turns the emailed link into
 * a short-lived **recovery session** (detectSessionInUrl → a PASSWORD_RECOVERY auth
 * event), so by the time this renders the user is transiently authenticated and
 * `updateUser({ password })` will work.
 *
 * Public route (not behind ProtectedRoute): the recovery session is what authorises
 * the change, and the whole point is to reach it while otherwise locked out.
 */
export function ResetPassword() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Give the recovery token a moment to resolve into a session before deciding the
  // link is stale — onAuthStateChange fires just after mount.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 1200)
    return () => clearTimeout(t)
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Reuse the shared password rule so reset and signup can't diverge.
    const parsed = credentialsSchema.safeParse({ email: 'placeholder@example.com', password })
    if (!parsed.success) {
      setError(parsed.error.issues.find((i) => i.path[0] === 'password')?.message ?? 'That password is too weak.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That password could not be set.')
    } finally {
      setBusy(false)
    }
  }

  const noSession = settled && !loading && !session

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <span className="font-semibold tracking-tight">Alp-Viram</span>
        </div>

        <h1 className="text-lg font-semibold">Set a new password</h1>

        {done ? (
          <p className="mt-4 text-sm">Password updated. Taking you in…</p>
        ) : noSession ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a fresh one from the sign-in page.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-label="New password"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? 'Please wait…' : 'Update password'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
