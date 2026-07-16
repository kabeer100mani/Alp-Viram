import { Check, Clock, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useSnoozeItem,
  useUpdateItem,
} from '@/modules/items/hooks/use-items'
import type { Item } from '@/modules/items/types'
import type { List } from '@/modules/lists/data/lists-repository'
import { itemStateLabel, itemTypeLabel } from '@/modules/items/presentation'
import { ResponsibilityBar, type ResponsibilityContext } from '@/modules/items/components/ResponsibilityBar'
import { ChecklistPanel } from '@/modules/items/components/ChecklistPanel'

/**
 * One item, with its actions inline.
 *
 * "Status changes and completion are one action from the item card" (user
 * journey §Execution) — there is no drill-through, and no detail screen.
 *
 * `canWrite` comes from the database (`writable_item_ids`), so we never offer an
 * action RLS will refuse. It is an affordance only: the repository still turns a
 * refused write into a PermissionError.
 */
export function ItemCard({
  item,
  canWrite,
  onError,
  responsibility,
  organizationId,
  currentUserId,
  lists,
}: {
  item: Item
  canWrite: boolean
  onError?: (message: string) => void
  /** Present only in team mode (PDL-022 hides responsibility from solo users). */
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
  /** Checklist/DoD need no team — they work solo too, so they're passed directly. */
  organizationId?: string
  currentUserId?: string
  /** Optional lists to file this item into (PDL-032); omitted when none exist. */
  lists?: List[]
}) {
  const complete = useCompleteItem()
  const reopen = useReopenItem()
  const snooze = useSnoozeItem()
  const setState = useSetItemState()
  const update = useUpdateItem()

  const busy =
    complete.isPending || reopen.isPending || snooze.isPending || setState.isPending || update.isPending
  const fail = (err: unknown) =>
    onError?.(err instanceof Error ? err.message : 'That change could not be saved.')

  // A Note has no done-state and no owner-to-execute (IA §Item types).
  const completable = item.type !== 'note'
  const isDone = item.state === 'done'

  function snoozeUntilTomorrow() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    snooze.mutate({ id: item.id, until: d.toISOString() }, { onError: fail })
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {itemTypeLabel(item)}
        </span>
        <span className={`truncate text-sm ${isDone ? 'text-muted-foreground line-through' : ''}`}>
          {item.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* File into an optional List (PDL-032) — only when lists exist and the
            user may write; capture never needs one. */}
        {canWrite && lists && lists.length > 0 && (
          <select
            aria-label={`List for ${item.title}`}
            value={item.list_id ?? ''}
            disabled={busy}
            onChange={(e) => update.mutate({ id: item.id, patch: { listId: e.target.value || null } }, { onError: fail })}
            className="h-7 rounded-md border border-input bg-background px-1 text-xs text-muted-foreground"
          >
            <option value="">No list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-muted-foreground">{itemStateLabel(item.state)}</span>

        {canWrite && !isDone && (
          <>
            {item.state !== 'in_progress' && completable && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                aria-label={`Start ${item.title}`}
                onClick={() => setState.mutate({ id: item.id, state: 'in_progress' }, { onError: fail })}
              >
                <Play className="h-4 w-4" /> Start
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`Snooze ${item.title}`}
              onClick={snoozeUntilTomorrow}
            >
              <Clock className="h-4 w-4" /> Snooze
            </Button>
            {completable && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                aria-label={`Complete ${item.title}`}
                onClick={() => complete.mutate({ id: item.id, type: item.type }, { onError: fail })}
              >
                <Check className="h-4 w-4" /> Done
              </Button>
            )}
          </>
        )}

        {canWrite && isDone && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={`Reopen ${item.title}`}
            onClick={() => reopen.mutate({ id: item.id }, { onError: fail })}
          >
            <RotateCcw className="h-4 w-4" /> Reopen
          </Button>
        )}
      </div>
      </div>

      {/* Responsibility — team mode only (PDL-022 hides it from solo users). A
          Note has no owner-to-execute (IA), so no responsibility on notes. */}
      {responsibility && item.type !== 'note' && (
        <ResponsibilityBar
          itemId={item.id}
          ctx={{ ...responsibility, canWrite }}
          onError={(m) => onError?.(m)}
        />
      )}

      {/* Checklist + Definition of Done (PDL-033). Works solo — no team needed.
          A Note has no done-state (IA), so neither applies to one. */}
      {organizationId && currentUserId && item.type !== 'note' && (
        <ChecklistPanel
          item={item}
          organizationId={organizationId}
          currentUserId={currentUserId}
          canWrite={canWrite}
          onError={(m) => onError?.(m)}
        />
      )}
    </li>
  )
}
