import { useState, type FormEvent } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCreateInvitation,
  useMembers,
  usePendingInvitations,
  useRevokeInvitation,
} from '@/modules/people/hooks/use-people'

/**
 * People & Roles surface (Gate A: People). Admin-only management; hidden entirely
 * from solo users by the caller (PDL-022).
 *
 * Roles + role-assignments arrive in Gate B; this gate is Members + invites, so a
 * second person can actually join and make the rest reachable.
 *
 * Invites are link-based — no email is sent (PDL-011 defers delivery). The admin
 * copies the link and shares it however they like.
 */
export function PeopleScreen({ organizationId, isAdmin }: { organizationId: string; isAdmin: boolean }) {
  const { data: members, isLoading } = useMembers(organizationId)
  const { data: pending } = usePendingInvitations(organizationId, isAdmin)
  const createInvite = useCreateInvitation(organizationId)
  const revoke = useRevokeInvitation(organizationId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setError(null)
    setLink(null)
    setCopied(false)
    try {
      const { link } = await createInvite.mutateAsync({ email: trimmed, role })
      setLink(link)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The invite could not be created.')
    }
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">People</h2>
        <p className="text-sm text-muted-foreground">Who is in this workspace.</p>
      </div>

      {/* ── Members ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {(members ?? []).map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{m.displayName ?? 'Member'}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{m.role}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Invite (admin only) ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="h-4 w-4" /> Invite someone
          </h3>
          <form onSubmit={onInvite} className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              placeholder="their@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              aria-label="Invitee email"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Invitee role"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" disabled={createInvite.isPending || !email.trim()}>
              Create invite link
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {link && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Share this link. No email is sent — copy it and send it however you like.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={link} className="flex-1 text-xs" aria-label="Invite link" />
                <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {pending && pending.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Pending</p>
              <ul className="space-y-1">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm">
                    <span>
                      {inv.email} · <span className="text-muted-foreground">{inv.role}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(inv.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
