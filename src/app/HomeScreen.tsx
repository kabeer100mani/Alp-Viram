import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/modules/auth/auth-context'
import { useActiveOrg } from '@/modules/organizations/use-active-org'
import { CaptureBox } from '@/modules/items/components/CaptureBox'
import { ItemList } from '@/modules/items/components/ItemList'

/** Authenticated landing screen for Milestone 1 — proves identity + tenancy. */
export function HomeScreen() {
  const { user, signOut } = useAuth()
  const { data: org, isLoading } = useActiveOrg(user?.id)
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'there'
  const userId = user?.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Milestone 1 · Identity &amp; Tenancy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome, {displayName}</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Loading your workspace…'
              : org
                ? `You're in "${org.name}".`
                : 'No workspace found.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
        <h2 className="text-sm font-semibold">Your account</h2>
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Workspace</dt>
          <dd>{org?.name ?? '—'}</dd>
          <dt className="text-muted-foreground">Mode</dt>
          <dd>{org ? (org.isPersonal ? 'Personal (solo)' : 'Team') : '—'}</dd>
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="capitalize">{org?.role ?? '—'}</dd>
        </dl>
      </div>

      {org && userId && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Capture</h2>
          <CaptureBox organizationId={org.id} userId={userId} />
          <ItemList organizationId={org.id} />
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Next milestone: the AI Inbox — natural-language capture with classification.
      </p>
    </motion.div>
  )
}
