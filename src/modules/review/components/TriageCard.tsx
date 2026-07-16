import { Check, Clock, Inbox as InboxIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditChip } from '@/modules/review/hooks/use-review'
import { useItemResponsibility, useSetPrimaryResponsibleRole } from '@/modules/items/hooks/use-responsibility'
import { itemTypeLabel } from '@/modules/items/presentation'
import type { Project, Role } from '@/modules/review/data/review-repository'
import type { Item, ItemType } from '@/modules/items/types'

/**
 * A triage card: the item plus its AI chips — `Type ▸ Project ▸ Role ▸ Due`.
 *
 * Confirm accepts all chips at once; tapping a chip changes one field
 * (user journey, Stage 6). The AI pre-sorts and the user confirms — it proposes,
 * never autopilots (PDL-012 / PDL-028).
 *
 * Chips appear only when they can mean something: Projects are optional and
 * lazily created (PDL-008), and Roles are hidden entirely from solo users
 * (PDL-022). So with no projects and no team, this is Type ▸ Due — which is the
 * common case, not a degraded one.
 */
export function TriageCard({
  item,
  projects,
  roles,
  organizationId,
  currentUserId,
  selected,
  onToggleSelected,
  onConfirm,
  onSnooze,
  onDone,
  onBacklog,
  busy,
}: {
  item: Item
  projects: Project[]
  roles: Role[]
  organizationId: string
  currentUserId: string
  selected: boolean
  onToggleSelected: () => void
  onConfirm: () => void
  onSnooze: () => void
  onDone: () => void
  onBacklog: () => void
  busy: boolean
}) {
  const editChip = useEditChip()
  const setRole = useSetPrimaryResponsibleRole(organizationId, item.id, currentUserId)
  // Only fetch responsibility when there are roles to assign — a solo org has none.
  const { data: resp } = useItemResponsibility(item.id, roles.length > 0)
  const chip = 'h-7 rounded-md border border-input bg-background px-2 text-xs'

  // A Note has no done-state (IA) — the 2-minute-rule Done does not apply.
  const completable = item.type !== 'note'
  const dueValue = item.due_at ? item.due_at.slice(0, 10) : ''
  const primaryRoleId = resp?.responsibleRoles.find((r) => r.isPrimary)?.roleId ?? ''

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${item.title}`}
          className="mt-1"
        />
        <p className="min-w-0 flex-1 text-sm">{item.title}</p>
        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {itemTypeLabel(item)}
        </span>
      </div>

      {/* Chips: Type ▸ Project ▸ Role ▸ Due */}
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <select
          aria-label={`Type for ${item.title}`}
          className={chip}
          value={item.type}
          disabled={busy}
          onChange={(e) =>
            editChip.mutate({ id: item.id, patch: { type: e.target.value as ItemType } as never })
          }
        >
          <option value="task">Task</option>
          <option value="note">Note</option>
          <option value="meeting">Meeting</option>
        </select>

        {projects.length > 0 && (
          <select
            aria-label={`Project for ${item.title}`}
            className={chip}
            value={item.project_id ?? ''}
            disabled={busy}
            onChange={(e) =>
              editChip.mutate({ id: item.id, patch: { projectId: e.target.value || null } })
            }
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {roles.length > 0 && (
          <select
            aria-label={`Responsible role for ${item.title}`}
            className={chip}
            value={primaryRoleId}
            disabled={busy}
            onChange={(e) => setRole.mutate({ roleId: e.target.value || null })}
          >
            <option value="">No responsible role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="date"
          aria-label={`Due date for ${item.title}`}
          className={chip}
          value={dueValue}
          disabled={busy}
          onChange={(e) => {
            const v = e.target.value
            // Local noon → an unambiguous absolute instant (TD-005 discipline).
            const dueAt = v ? new Date(`${v}T12:00:00`).toISOString() : null
            editChip.mutate({ id: item.id, patch: { dueAt } })
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 pl-7">
        <Button size="sm" disabled={busy} onClick={onConfirm} aria-label={`Confirm ${item.title}`}>
          <Check className="h-4 w-4" /> Confirm
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onSnooze} aria-label={`Snooze ${item.title}`}>
          <Clock className="h-4 w-4" /> Snooze
        </Button>
        {completable && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDone} aria-label={`Done ${item.title}`}>
            Done
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={onBacklog} aria-label={`Backlog ${item.title}`}>
          <InboxIcon className="h-4 w-4" /> Backlog
        </Button>
      </div>
    </li>
  )
}
