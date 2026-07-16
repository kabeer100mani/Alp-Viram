import { useState } from 'react'
import { UserMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAssignments, useAssignUser, useCloseAssignment, useRetireRole } from '@/modules/people/hooks/use-roles'
import { isCurrent, type Role } from '@/modules/people/data/roles-repository'
import type { Member } from '@/modules/people/data/people-repository'

/**
 * One role, with its current holders and (admin) controls to assign or hand over.
 *
 * "Who holds this role now" is the set of assignments whose window is open. A
 * handover = close one, open another; concurrent holders are allowed by design
 * (Doc 9), so this shows all current holders, not just one.
 */
export function RoleCard({
  role,
  members,
  isAdmin,
  currentUserId,
  onError,
}: {
  role: Role
  members: Member[]
  isAdmin: boolean
  currentUserId: string
  onError: (m: string) => void
}) {
  const { data: assignments } = useAssignments(role.id)
  const assign = useAssignUser(role.organization_id)
  const close = useCloseAssignment(role.organization_id)
  const retire = useRetireRole(role.organization_id)
  const [pick, setPick] = useState('')

  const current = (assignments ?? []).filter(isCurrent)
  const currentUserIds = new Set(current.map((a) => a.userId))
  const assignable = members.filter((m) => !currentUserIds.has(m.userId))
  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const nameFor = (userId: string, fallback: string | null) =>
    members.find((m) => m.userId === userId)?.displayName ?? fallback ?? 'Member'

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{role.name}</span>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Retire ${role.name}`}
            onClick={() => retire.mutate({ id: role.id }, { onError: fail })}
          >
            <X className="h-4 w-4" /> Retire
          </Button>
        )}
      </div>

      {/* Current holders — derived, time-bounded. */}
      <div className="flex flex-wrap items-center gap-2">
        {current.length === 0 ? (
          <span className="text-xs text-muted-foreground">UNFILLED — needs owner</span>
        ) : (
          current.map((a) => (
            <span
              key={a.assignmentId}
              className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {nameFor(a.userId, a.displayName)}
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Remove ${nameFor(a.userId, a.displayName)} from ${role.name}`}
                  onClick={() => close.mutate({ assignmentId: a.assignmentId }, { onError: fail })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {isAdmin && assignable.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            aria-label={`Assign someone to ${role.name}`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Assign someone…</option>
            {assignable.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName ?? 'Member'}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!pick || assign.isPending}
            onClick={() =>
              assign.mutate(
                { roleId: role.id, userId: pick, createdBy: currentUserId },
                { onSuccess: () => setPick(''), onError: fail },
              )
            }
          >
            Assign
          </Button>
        </div>
      )}
    </li>
  )
}
