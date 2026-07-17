import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/modules/auth/auth-context'
import { credentialsSchema } from '@/modules/auth/validation'

type Mode = 'signin' | 'signup' | 'forgot'

export function AuthScreen() {
  const { session, signInWithPassword, signUpWithPassword, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Return to wherever the user was headed before being sent to /login (e.g. an
  // /invite?token=… link), falling back to the workspace.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // Once authenticated, leave the login page.
  useEffect(() => {
    if (session) navigate(from, { replace: true })
  }, [session, navigate, from])
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Enter your email.')
        return
      }
      setBusy(true)
      try {
        await sendPasswordReset(email.trim())
        // Generic confirmation regardless of whether the address is registered —
        // never let this flow reveal which emails exist.
        setResetSent(true)
      } finally {
        setBusy(false)
      }
      return
    }

    const parsed = credentialsSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password)
      } else {
        await signUpWithPassword(email, password, displayName || undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setResetSent(false)
  }

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

        <h1 className="text-lg font-semibold">
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'signin'
            ? 'Welcome back.'
            : mode === 'signup'
              ? 'Start capturing in seconds.'
              : 'We’ll email you a link to set a new one.'}
        </p>

        {mode === 'forgot' && resetSent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              If an account exists for <span className="font-medium">{email.trim()}</span>, a password-reset
              link is on its way. Check your inbox.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => switchMode('signin')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              {mode === 'signup' && (
                <Input
                  placeholder="Your name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {mode !== 'forgot' && (
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'signin'
                    ? 'Sign in'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Send reset link'}
              </Button>
            </form>

            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </button>
            )}

            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
