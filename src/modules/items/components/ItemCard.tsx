import { Bell } from 'lucide-react'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useUpdateItem,
} from '@/modules/items/hooks/use-items'
import { DateCell } from '@/modules/items/components/DateCell'
import { StatusPill } from '@/components/app/StatusPill'
import { PriorityFlag } from '@/components/app/PriorityFlag'
import { Avatar } from '@/components/ui/avatar'
import { TagChip } from '@/modules/tags/components/TagChip'
import { itemTypeLabel } from '@/modules/items/presentation'
import { statusOptionsFor, type RowAssignee, type RowColumns } from '@/modules/items/components/ItemRow'
import type { Item, ItemState } from '@/modules/items/types'
import type { Tag } from '@/modules/tags/data/tags-repository'

/**
 * The mobile ($lt;md) card form of a table row (M8 Gate B / PDL-048). The dense
 * multi-column grid doesn't fit a phone, so each item becomes a stacked card: type +
 * name (tap opens the full TaskPanel), then a compact meta row (status pill, priority,
 * due, assignee) and tags. Same handlers as ItemRow — no behaviour change, just layout.
 */
export function ItemCard({
  item,
  canWrite,
  columns,
  assignee,
  tags = [],
  onOpen,
  onTagClick,
  onError,
}: {
  item: Item
  canWrite: boolean
  columns: RowColumns
  assignee: RowAssignee | null
  tags?: Tag[]
  onOpen: () => void
  onTagClick?: (tag: Tag) => void
  onError: (m: string) => void
}) {
  const update = useUpdateItem()
  const complete = useCompleteItem()
  const reopen = useReopenItem()
  const setState = useSetItemState()

  const busy = update.isPending || complete.isPending || reopen.isPending || setState.isPending
  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const isNote = item.type === 'note'
  const isDone = item.state === 'done'

  function changeStatus(next: ItemState) {
    if (next === item.state) return
    if (next === 'done') complete.mutate({ id: item.id, type: item.type }, { onError: fail })
    else if (isDone) {
      reopen.mutate(
        { id: item.id },
        {
          onError: fail,
          onSuccess: () => {
            if (next !== 'committed') setState.mutate({ id: item.id, state: next }, { onError: fail })
          },
        },
      )
    } else setState.mutate({ id: item.id, state: next }, { onError: fail })
  }

  return (
    <div className="rounded-lg border border-[--border-subtle] bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
          {itemTypeLabel(item)}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className={`min-w-0 flex-1 text-left text-sm ${isDone ? 'text-muted-foreground line-through' : ''}`}
        >
          {item.title}
        </button>
        {item.remind_at && <Bell className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has a reminder" />}
        {columns.showAssignee && assignee && (
          <span className="mt-0.5 shrink-0">
            <Avatar userId={assignee.userId} name={assignee.name} size="xs" />
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusPill
          state={item.state}
          options={statusOptionsFor(item.state).filter((s) => !(isNote && s === 'done'))}
          canWrite={canWrite}
          disabled={busy}
          ariaLabel={`Status for ${item.title}`}
          onChange={changeStatus}
        />
        {!isNote && (
          <PriorityFlag
            value={item.priority}
            canWrite={canWrite}
            disabled={busy}
            ariaLabel={`Priority for ${item.title}`}
            onChange={(p) => update.mutate({ id: item.id, patch: { priority: p } }, { onError: fail })}
          />
        )}
        {!isNote && (
          <DateCell
            value={item.due_at}
            label={`Due date for ${item.title}`}
            canWrite={canWrite}
            busy={busy}
            assumed={item.due_assumed}
            onChange={(iso) => update.mutate({ id: item.id, patch: { dueAt: iso } }, { onError: fail })}
          />
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
