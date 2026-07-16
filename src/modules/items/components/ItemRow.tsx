import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useUpdateItem,
} from '@/modules/items/hooks/use-items'
import { itemStateLabel, itemTypeLabel, priorityLabel, priorityOptions } from '@/modules/items/presentation'
import { ResponsibilityBar, type ResponsibilityContext } from '@/modules/items/components/ResponsibilityBar'
import { ChecklistPanel } from '@/modules/items/components/ChecklistPanel'
import type { Item, ItemState } from '@/modules/items/types'
import type { List } from '@/modules/lists/data/lists-repository'

/** Statuses offered in the row's Status editor, in lifecycle order. */
const STATUS_OPTIONS: ItemState[] = ['captured', 'committed', 'in_progress', 'done', 'snoozed', 'backlog']

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
// Local noon → an unambiguous absolute instant (TD-005 discipline).
const toInstant = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null)

export interface RowColumns {
  showAssignee: boolean
}

/**
 * One dense table row. Priority, Start and Due are edited inline (PDL-034); the
 * heavier editors — checklist, DoD, responsibility — live in the row-expand.
 *
 * Every locked behaviour is kept: Status shows human labels, never the enum
 * (PDL-027); a Note has no Done; dates are neutral (no "overdue" colour, FR-12b);
 * and edits are offered only when `canWrite` (the DB rule, via writable_item_ids).
 */
export function ItemRow({
  item,
  canWrite,
  columns,
  assigneeName,
  responsibility,
  organizationId,
  currentUserId,
  lists,
  onError,
}: {
  item: Item
  canWrite: boolean
  columns: RowColumns
  assigneeName: string | null
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
  organizationId: string
  currentUserId: string
  lists?: List[]
  onError: (m: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const update = useUpdateItem()
  const complete = useCompleteItem()
  const reopen = useReopenItem()
  const setState = useSetItemState()

  const busy = update.isPending || complete.isPending || reopen.isPending || setState.isPending
  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const isNote = item.type === 'note'
  const isDone = item.state === 'done'

  const cell = 'px-2 py-1.5 text-xs'
  const editor = 'h-7 w-full rounded border border-input bg-background px-1 text-xs disabled:opacity-60'

  function changeStatus(next: ItemState) {
    if (next === item.state) return
    if (next === 'done') complete.mutate({ id: item.id, type: item.type }, { onError: fail })
    else if (isDone) {
      // Leaving Done: reopen clears completed_at, then move to the chosen state.
      reopen.mutate({ id: item.id }, { onError: fail, onSuccess: () => {
        if (next !== 'committed') setState.mutate({ id: item.id, state: next }, { onError: fail })
      } })
    } else setState.mutate({ id: item.id, state: next }, { onError: fail })
  }

  return (
    <>
      <div role="row" className="col-span-full grid grid-cols-subgrid items-center border-b border-border hover:bg-secondary/30">
        {/* Title + expand + type */}
        <div className={`${cell} flex min-w-0 items-center gap-1.5`}>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={`Details for ${item.title}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
            {itemTypeLabel(item)}
          </span>
          <span className={`truncate ${isDone ? 'text-muted-foreground line-through' : ''}`}>{item.title}</span>
        </div>

        {/* Assignee (team-only) */}
        {columns.showAssignee && (
          <div className={`${cell} truncate text-muted-foreground`}>{assigneeName ?? '—'}</div>
        )}

        {/* Priority — inline */}
        <div className={cell}>
          {canWrite ? (
            <select
              aria-label={`Priority for ${item.title}`}
              className={editor}
              value={item.priority}
              disabled={busy}
              onChange={(e) => update.mutate({ id: item.id, patch: { priority: e.target.value as Item['priority'] } }, { onError: fail })}
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-muted-foreground">{priorityLabel(item.priority)}</span>
          )}
        </div>

        {/* Start — inline (task/meeting only; a Note has no execution) */}
        <div className={cell}>
          {canWrite && !isNote ? (
            <input
              type="date"
              aria-label={`Start date for ${item.title}`}
              className={editor}
              value={dateInput(item.start_at)}
              disabled={busy}
              onChange={(e) => update.mutate({ id: item.id, patch: { startAt: toInstant(e.target.value) } }, { onError: fail })}
            />
          ) : (
            <span className="text-muted-foreground">{dateInput(item.start_at)}</span>
          )}
        </div>

        {/* Due — inline. Neutral, never a red "overdue" cell (FR-12b). */}
        <div className={cell}>
          {canWrite && !isNote ? (
            <input
              type="date"
              aria-label={`Due date for ${item.title}`}
              className={editor}
              value={dateInput(item.due_at)}
              disabled={busy}
              onChange={(e) => update.mutate({ id: item.id, patch: { dueAt: toInstant(e.target.value) } }, { onError: fail })}
            />
          ) : (
            <span className="text-muted-foreground">{dateInput(item.due_at)}</span>
          )}
        </div>

        {/* Status — inline. Human labels only (PDL-027); no Done for a Note. */}
        <div className={`${cell} flex items-center gap-1`}>
          {canWrite ? (
            <select
              aria-label={`Status for ${item.title}`}
              className={editor}
              value={item.state}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value as ItemState)}
            >
              {STATUS_OPTIONS.filter((s) => !(isNote && s === 'done')).map((s) => (
                <option key={s} value={s}>
                  {itemStateLabel(s)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-muted-foreground">{itemStateLabel(item.state)}</span>
          )}
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

      {/* Row-expand: the heavier editors, one click away. */}
      {expanded && (
        <div role="row" className="col-span-full border-b border-border bg-background/60 py-2">
          {responsibility && !isNote && (
            <ResponsibilityBar itemId={item.id} ctx={{ ...responsibility, canWrite }} onError={onError} />
          )}
          {!isNote && (
            <ChecklistPanel
              item={item}
              organizationId={organizationId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              onError={onError}
            />
          )}
          {isNote && <p className="pl-[3.25rem] text-xs text-muted-foreground">Notes have no status, dates or checklist.</p>}
          {/* List picker stays available in the expand (it's on every item). */}
          {canWrite && lists && lists.length > 0 && (
            <div className="flex items-center gap-2 pl-[3.25rem] pt-2 text-xs">
              <span className="text-muted-foreground">List</span>
              <select
                aria-label={`List for ${item.title}`}
                className={`${editor} max-w-[12rem]`}
                value={item.list_id ?? ''}
                disabled={busy}
                onChange={(e) => update.mutate({ id: item.id, patch: { listId: e.target.value || null } }, { onError: fail })}
              >
                <option value="">No list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  )
}
