import { Check, Clock, Inbox as InboxIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEditChip } from '@/modules/review/hooks/use-review'
import { useItemResponsibility, useSetPrimaryResponsibleRole } from '@/modules/items/hooks/use-responsibility'
import { itemTypeLabel } from '@/modules/items/presentation'
import { DateCell } from '@/modules/items/components/DateCell'
import type { List, Role } from '@/modules/review/data/review-repository'
import type { Item, ItemType } from '@/modules/items/types'

// Radix Select forbids an empty-string item value; unset List/Role use this sentinel.
const NONE = '__none__'

/**
 * A triage card: the item plus its AI chips — `Type ▸ List ▸ Role ▸ Due`.
 *
 * Confirm accepts all chips at once; tapping a chip changes one field
 * (user journey, Stage 6). The AI pre-sorts and the user confirms — it proposes,
 * never autopilots (PDL-012 / PDL-028).
 *
 * Chips appear only when they can mean something: Lists are optional and lazily
 * created (PDL-008/PDL-032), and Roles are hidden entirely from solo users
 * (PDL-022). So with no lists and no team, this is Type ▸ Due — which is the
 * common case, not a degraded one.
 */
export function TriageCard({
  item,
  lists,
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
  lists: List[]
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
  const primaryRoleId = resp?.responsibleRoles.find((r) => r.isPrimary)?.roleId ?? ''

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelected}
          aria-label={`Select ${item.title}`}
          className="mt-1"
        />
        <p className="min-w-0 flex-1 text-sm">{item.title}</p>
        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {itemTypeLabel(item)}
        </span>
      </div>

      {/* Chips: Type ▸ List ▸ Role ▸ Due */}
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <Select
          value={item.type}
          disabled={busy}
          onValueChange={(v) => editChip.mutate({ id: item.id, patch: { type: v as ItemType } as never })}
        >
          <SelectTrigger aria-label={`Type for ${item.title}`} className={`${chip} w-auto gap-1`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            {/* Meeting dropped for MVP (PDL-039) — no scheduling built. The enum
                stays valid, so an existing meeting-typed item still shows its type. */}
            {item.type === 'meeting' && <SelectItem value="meeting">Meeting</SelectItem>}
          </SelectContent>
        </Select>

        {lists.length > 0 && (
          <Select
            value={item.list_id ?? NONE}
            disabled={busy}
            onValueChange={(v) => editChip.mutate({ id: item.id, patch: { listId: v === NONE ? null : v } })}
          >
            <SelectTrigger aria-label={`List for ${item.title}`} className={`${chip} w-auto gap-1`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No list</SelectItem>
              {lists.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {roles.length > 0 && (
          <Select
            value={primaryRoleId || NONE}
            disabled={busy}
            onValueChange={(v) => setRole.mutate({ roleId: v === NONE ? null : v })}
          >
            <SelectTrigger aria-label={`Responsible role for ${item.title}`} className={`${chip} w-auto gap-1`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No responsible role</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DateCell
          value={item.due_at}
          label={`Due date for ${item.title}`}
          canWrite
          busy={busy}
          placeholder="Due date"
          assumed={item.due_assumed}
          className={`${chip} inline-flex items-center`}
          onChange={(dueAt) => editChip.mutate({ id: item.id, patch: { dueAt } })}
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
