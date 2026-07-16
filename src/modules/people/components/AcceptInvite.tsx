import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '@/modules/people/data/people-repository'
import { setActiveOrgId } from '@/modules/organizations/active-org-store'

type State = 'working' | 'done' | 'error'

/**
 * Landing for an invite link (/invite?token=…). The route is protected, so the
 * user is already signed in by the time we get here; if they signed up to accept,
 * their email must match the invite (enforced server-side).
 */
export function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>('working')
  const [message, setMessage] = useState('')
  const ran = useRef(false) // React 18 StrictMode double-invokes effects; accept once.

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!token) {
      setState('error')
      setMessage('This invite link is missing its token.')
      return
    }
    acceptInvitation(token)
      .then(({ organizationId }) => {
        // Land in the org they just joined, not their own personal org.
        setActiveOrgId(organizationId)
        // Membership changed — org lists, views and members are all stale now.
        void queryClient.invalidateQueries()
        setState('done')
      })
      .catch((err) => {
        setState('error')
        setMessage(err instanceof Error ? err.message : 'This invite could not be accepted.')
      })
  }, [token, queryClient])

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      {state === 'working' && <p className="text-sm text-muted-foreground">Joining the workspace…</p>}
      {state === 'done' && (
        <>
          <h1 className="text-xl font-semibold">You’re in.</h1>
          <p className="text-sm text-muted-foreground">You’ve joined the workspace.</p>
          <Button onClick={() => navigate('/', { replace: true })}>Go to the workspace</Button>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="text-xl font-semibold">This invite didn’t work</h1>
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
            Go to your workspace
          </Button>
        </>
      )}
    </div>
  )
}
