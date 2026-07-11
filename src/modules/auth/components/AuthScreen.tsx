import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/modules/auth/auth-context'
import { credentialsSchema } from '@/modules/auth/validation'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { session, signInWithPassword, signUpWithPassword } = useAuth()
  const navigate = useNavigate()

  // Once authenticated, leave the login page.
  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
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
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'signin' ? 'Welcome back.' : 'Start capturing in seconds.'}
        </p>

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
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>
      </motion.div>
    </div>
  )
}
