import { useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import {
  useAddAssignedUser,
  useAddCollaborator,
  useItemResponsibility,
  useRemoveAssignedUser,
  useRemoveCollaborator,
  useRemoveResponsibleRole,
  useSetPrimaryResponsibleRole,
} from '@/modules/items/hooks/use-responsibility'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Role } from '@/modules/people/data/roles-repository'
import type { Member } from '@/modules/people/data/people-repository'

// Radix Select forbids an empty-string item value; "no responsible role" uses this.
const NONE = '__none__'

export interface ResponsibilityContext {
  organizationId: string
  currentUserId: string
  canWrite: boolean
  roles: Role[]
  members: Member[]
}

/**
 * Responsibility on an item, at a glance and editable inline.
 *
 * Two axes (Doc 9): the **Responsible Role** (durable) with the person currently
 * holding it *derived* from the assignment window, and the **Assigned Users**
 * executing now. An unfilled role reads "UNFILLED — needs owner", never a stale
 * name. Editing is gated on canWrite — the same rule RLS enforces.
 */
export function ResponsibilityBar({
  itemId,
  ctx,
  onError,
}: {
  itemId: string
  ctx: ResponsibilityContext
  onError: (m: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { data } = useItemResponsibility(itemId)
  const setPrimary = useSetPrimaryResponsibleRole(ctx.organizationId, itemId, ctx.currentUserId)
  const removeRole = useRemoveResponsibleRole(itemId)
  const addUser = useAddAssignedUser(ctx.organizationId, itemId, ctx.currentUserId)
  const removeUser = useRemoveAssignedUser(itemId)
  const addCollab = useAddCollaborator(ctx.organizationId, itemId)
  const removeCollab = useRemoveCollaborator(itemId)

  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const nameFor = (userId: string, fallback: string | null) =>
    ctx.members.find((m) => m.userId === userId)?.displayName ?? fallback ?? 'Member'

  const primaryRole = data?.responsibleRoles.find((r) => r.isPrimary) ?? data?.responsibleRoles[0]
  const holderNames = (data?.currentHolders ?? [])
    .filter((h) => !primaryRole || h.roleId === primaryRole.roleId)
    .map((h) => nameFor(h.userId, null))

  // Glance line: "Finance — Priya" or "Finance — UNFILLED — needs owner".
  const glance = primaryRole
    ? `${primaryRole.roleName} — ${holderNames.length ? holderNames.join(', ') : 'UNFILLED — needs owner'}`
    : 'No responsible role'

  const assignedIds = new Set((data?.assignedUsers ?? []).map((u) => u.userId))
  const collabIds = new Set((data?.collaborators ?? []).map((c) => c.userId))

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        aria-label={`Responsibility for this item: ${glance}`}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className={primaryRole && holderNames.length === 0 ? 'text-amber-600 dark:text-amber-500' : ''}>
          {glance}
        </span>
        {data && data.assignedUsers.length > 0 && (
          <span className="text-muted-foreground">· doing: {data.assignedUsers.map((u) => nameFor(u.userId, u.displayName)).join(', ')}</span>
        )}
      </button>

      {open && data && (
        <div className="mt-2 space-y-3 rounded-md border border-border bg-background p-3">
          {/* Responsible role (the differentiator) */}
          <div className="space-y-1">
            <p className="font-medium">Responsible role</p>
            {ctx.canWrite ? (
              <Select
                value={primaryRole?.roleId ?? NONE}
                onValueChange={(v) => setPrimary.mutate({ roleId: v === NONE ? null : v }, { onError: fail })}
              >
                <SelectTrigger aria-label="Responsible role" className="h-8 w-auto min-w-[11rem] gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No responsible role</SelectItem>
                  {ctx.roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p>{glance}</p>
            )}
            {/* Secondary responsible roles, if any */}
            {data.responsibleRoles.filter((r) => r.roleId !== primaryRole?.roleId).map((r) => (
              <span key={r.id} className="mr-1 inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5">
                {r.roleName}
                {ctx.canWrite && (
                  <button type="button" aria-label={`Remove role ${r.roleName}`} onClick={() => removeRole.mutate({ id: r.id }, { onError: fail })}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Assigned users (execution) */}
          <div className="space-y-1">
            <p className="font-medium">Assigned to</p>
            <div className="flex flex-wrap items-center gap-1">
              {data.assignedUsers.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5">
                  {nameFor(u.userId, u.displayName)}
                  {ctx.canWrite && (
                    <button type="button" aria-label={`Unassign ${nameFor(u.userId, u.displayName)}`} onClick={() => removeUser.mutate({ id: u.id }, { onError: fail })}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {ctx.canWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Assign a user"
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    + assign…
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ctx.members.filter((m) => !assignedIds.has(m.userId)).map((m) => (
                      <DropdownMenuItem key={m.userId} onSelect={() => addUser.mutate({ userId: m.userId }, { onError: fail })}>
                        {m.displayName ?? 'Member'}
                      </DropdownMenuItem>
                    ))}
                    {ctx.members.filter((m) => !assignedIds.has(m.userId)).length === 0 && (
                      <DropdownMenuItem disabled>No one to add</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Collaborators (optional, no write authority) */}
          <div className="space-y-1">
            <p className="font-medium">Collaborators</p>
            <div className="flex flex-wrap items-center gap-1">
              {data.collaborators.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-muted-foreground">
                  {nameFor(c.userId, c.displayName)}
                  {ctx.canWrite && (
                    <button type="button" aria-label={`Remove collaborator ${nameFor(c.userId, c.displayName)}`} onClick={() => removeCollab.mutate({ id: c.id }, { onError: fail })}>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {ctx.canWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Add a collaborator"
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    + collaborator…
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ctx.members.filter((m) => !collabIds.has(m.userId)).map((m) => (
                      <DropdownMenuItem key={m.userId} onSelect={() => addCollab.mutate({ userId: m.userId }, { onError: fail })}>
                        {m.displayName ?? 'Member'}
                      </DropdownMenuItem>
                    ))}
                    {ctx.members.filter((m) => !collabIds.has(m.userId)).length === 0 && (
                      <DropdownMenuItem disabled>No one to add</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
