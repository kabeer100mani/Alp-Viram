import { Check, Clock, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useSnoozeItem,
} from '@/modules/items/hooks/use-items'
import type { Item } from '@/modules/items/types'
import { itemStateLabel, itemTypeLabel } from '@/modules/items/presentation'

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
}: {
  item: Item
  canWrite: boolean
  onError?: (message: string) => void
}) {
  const complete = useCompleteItem()
  const reopen = useReopenItem()
  const snooze = useSnoozeItem()
  const setState = useSetItemState()

  const busy = complete.isPending || reopen.isPending || snooze.isPending || setState.isPending
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
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {itemTypeLabel(item)}
        </span>
        <span className={`truncate text-sm ${isDone ? 'text-muted-foreground line-through' : ''}`}>
          {item.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
    </li>
  )
}
