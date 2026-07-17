import { useState, type FormEvent } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useChangeMemberRole,
  useCreateInvitation,
  useMembers,
  usePendingInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useSetMemberActive,
} from '@/modules/people/hooks/use-people'
import type { Member, OrgMemberRole } from '@/modules/people/data/people-repository'
import { RolesSection } from '@/modules/people/components/RolesSection'

/**
 * One member row. For an admin it carries offboarding controls — change role,
 * deactivate/reactivate, remove — each mirroring what RLS already allows. Actions
 * on your OWN row are withheld: self-demotion/self-removal is an easy way to lock
 * yourself out, and the last-owner guard already lives in the database, not here.
 * The database is the real gate; these controls just avoid offering a refused action.
 */
function MemberRow({
  member,
  organizationId,
  isAdmin,
  isSelf,
  onError,
}: {
  member: Member
  organizationId: string
  isAdmin: boolean
  isSelf: boolean
  onError: (m: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const changeRole = useChangeMemberRole(organizationId)
  const setActive = useSetMemberActive(organizationId)
  const remove = useRemoveMember(organizationId)
  const busy = changeRole.isPending || setActive.isPending || remove.isPending
  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')

  const manageable = isAdmin && !isSelf

  return (
    <li className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${member.isActive ? '' : 'opacity-60'}`}>
      <span className="text-sm">
        {member.displayName ?? 'Member'}
        {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
        {!member.isActive && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">Deactivated</span>}
      </span>

      {manageable ? (
        <div className="flex items-center gap-2">
          <select
            aria-label={`Role for ${member.displayName ?? 'member'}`}
            className="h-7 rounded border border-input bg-background px-1 text-xs capitalize"
            value={member.role}
            disabled={busy}
            onChange={(e) => changeRole.mutate({ membershipId: member.id, role: e.target.value as OrgMemberRole }, { onError: fail })}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setActive.mutate({ membershipId: member.id, isActive: !member.isActive }, { onError: fail })}
          >
            {member.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>

          {confirming ? (
            <span className="flex items-center gap-1 text-xs">
              Remove?
              <Button variant="ghost" size="sm" disabled={busy} className="text-destructive hover:text-destructive"
                onClick={() => remove.mutate({ membershipId: member.id }, { onError: (e) => { fail(e); setConfirming(false) }, onSuccess: () => setConfirming(false) })}>
                Yes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>No</Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" disabled={busy} className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          )}
        </div>
      ) : (
        <span className="text-xs capitalize text-muted-foreground">{member.role}</span>
      )}
    </li>
  )
}

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
export function PeopleScreen({
  organizationId,
  isAdmin,
  currentUserId,
}: {
  organizationId: string
  isAdmin: boolean
  currentUserId: string
}) {
  // Admins see deactivated members too (so deactivation isn't a black hole); the
  // responsibility pickers below must only ever see ACTIVE members.
  const { data: members, isLoading } = useMembers(organizationId, isAdmin)
  const activeMembers = (members ?? []).filter((m) => m.isActive)
  const { data: pending } = usePendingInvitations(organizationId, isAdmin)
  const createInvite = useCreateInvitation(organizationId)
  const revoke = useRevokeInvitation(organizationId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [emailed, setEmailed] = useState(false)
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
      const { link, emailed } = await createInvite.mutateAsync({ email: trimmed, role })
      setLink(link)
      setEmailed(emailed)
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Members ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul aria-label="Members" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {(members ?? []).map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              organizationId={organizationId}
              isAdmin={isAdmin}
              isSelf={m.userId === currentUserId}
              onError={setError}
            />
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
                {emailed
                  ? 'Invite emailed. You can also copy the link below to share it directly.'
                  : 'Copy this link and send it however you like.'}
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
              <p className="text-xs text-muted-foreground">Pending</p>
              <ul className="space-y-1">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm">
                    <span>
                      {inv.email} · <span className="capitalize text-muted-foreground">{inv.role}</span>
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

      {/* ── Roles (Gate B) ──────────────────────────────────────────────── */}
      <RolesSection
        organizationId={organizationId}
        members={activeMembers}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </section>
  )
}
