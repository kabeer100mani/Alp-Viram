import { Bell, RotateCcw } from 'lucide-react'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useUpdateItem,
} from '@/modules/items/hooks/use-items'
import { DateCell } from '@/modules/items/components/DateCell'
import { itemTypeLabel } from '@/modules/items/presentation'
import { Avatar } from '@/components/ui/avatar'
import { StatusPill } from '@/components/app/StatusPill'
import { PriorityFlag } from '@/components/app/PriorityFlag'
import { TagChip } from '@/modules/tags/components/TagChip'
import type { Tag } from '@/modules/tags/data/tags-repository'
import type { Item, ItemState } from '@/modules/items/types'

// 'snoozed' is deliberately NOT here (D-c / TD-011): snooze is a defer-*until*
// action with a wake date (set in Daily Review), not a status you pick by hand —
// hand-setting it with no date was the trap that hid work forever. A currently
// snoozed item still shows "Snoozed" (its option is added at render so the control
// reflects the real state).
const STATUS_OPTIONS: ItemState[] = ['captured', 'committed', 'in_progress', 'done', 'backlog']
const statusOptionsFor = (state: ItemState): ItemState[] =>
  state === 'snoozed' ? [...STATUS_OPTIONS, 'snoozed'] : STATUS_OPTIONS

export interface RowColumns {
  showAssignee: boolean
}
export interface RowAssignee {
  userId: string
  name: string | null
}

/**
 * One dense table row: Name | Assignee | Priority | Due date | Status.
 *
 * The four common fields stay inline-editable here (PDL-034); everything heavier —
 * description, checklist, definition of done, responsibility, activity — moved to
 * the task detail panel (PDL-036), which opens on clicking the name. The row no
 * longer expands.
 *
 * Locked behaviour kept: Status shows human labels, never the enum (PDL-027); a
 * Note has no Done; dates are neutral (no "overdue" colour, FR-12b); edits appear
 * only when `canWrite`.
 */
export function ItemRow({
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
  /** Resolved by the table in one batched call — never fetched per row. */
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

  const cell = 'px-2 py-1 text-xs'

  function changeStatus(next: ItemState) {
    if (next === item.state) return
    if (next === 'done') complete.mutate({ id: item.id, type: item.type }, { onError: fail })
    else if (isDone) {
      reopen.mutate({ id: item.id }, { onError: fail, onSuccess: () => {
        if (next !== 'committed') setState.mutate({ id: item.id, state: next }, { onError: fail })
      } })
    } else setState.mutate({ id: item.id, state: next }, { onError: fail })
  }

  return (
    <div role="row" className="col-span-full grid min-h-[40px] grid-cols-subgrid items-center border-b border-[--border-subtle] hover:bg-[--bg-hover]">
      {/* Name — the click target that opens the detail panel */}
      <div className={`${cell} flex min-w-0 items-center gap-1.5`}>
        <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
          {itemTypeLabel(item)}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className={`truncate text-left hover:underline ${isDone ? 'text-muted-foreground line-through' : ''}`}
        >
          {item.title}
        </button>
        {/* A reminder is set — surfaced here so it's visible while scanning, since a
            reminder-only item now appears in Today/Upcoming (PDL-011). */}
        {item.remind_at && (
          <Bell className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Has a reminder" />
        )}
        {/* Tags read-only here — the row is for scanning; editing lives in the panel
            (PDL-036). Clicking one filters, which is the point of a flat model. */}
        {tags.map((tag) => (
          <TagChip key={tag.id} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
        ))}
      </div>

      {/* Assignee (team-only) — avatar only; the name lives in the panel */}
      {columns.showAssignee && (
        <div className={cell}>
          {assignee ? (
            <Avatar userId={assignee.userId} name={assignee.name} size="xs" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      )}

      {/* Priority — a ClickUp-style flag (§3.2). Read-only shows the flag + label. */}
      <div className={`${cell} flex items-center`}>
        <PriorityFlag
          value={item.priority}
          canWrite={canWrite}
          disabled={busy}
          ariaLabel={`Priority for ${item.title}`}
          onChange={(p) => update.mutate({ id: item.id, patch: { priority: p } }, { onError: fail })}
        />
      </div>

      {/* Due date — neutral, never a red "overdue" cell (FR-12b) */}
      <div className={cell}>
        {isNote ? (
          <span className="text-muted-foreground" />
        ) : (
          <DateCell
            value={item.due_at}
            label={`Due date for ${item.title}`}
            canWrite={canWrite}
            busy={busy}
            className="w-full"
            assumed={item.due_assumed}
            onChange={(iso) => update.mutate({ id: item.id, patch: { dueAt: iso } }, { onError: fail })}
          />
        )}
      </div>

      {/* Status — a coloured pill with a dropdown (§3.1). Human labels only
          (PDL-027); no Done on a Note. */}
      <div className={`${cell} flex items-center gap-1`}>
        <StatusPill
          state={item.state}
          options={statusOptionsFor(item.state).filter((s) => !(isNote && s === 'done'))}
          canWrite={canWrite}
          disabled={busy}
          ariaLabel={`Status for ${item.title}`}
          onChange={(s) => changeStatus(s)}
        />
        {canWrite && isDone && (
          <button
            type="button"
            aria-label={`Reopen ${item.title}`}
            title="Reopen"
            disabled={busy}
            onClick={() => reopen.mutate({ id: item.id }, { onError: fail })}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
