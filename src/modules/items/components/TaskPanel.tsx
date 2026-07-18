import { useEffect, useState } from 'react'
import { Check, Flag, X } from 'lucide-react'
import {
  useCompleteItem,
  useReopenItem,
  useSetItemState,
  useUpdateItem,
} from '@/modules/items/hooks/use-items'
import { useItemActivity } from '@/modules/items/hooks/use-activity'
import {
  activityLabel,
  formatEstimate,
  formatScheduleWindow,
  hasTimeOfDay,
  itemStateLabel,
  itemTypeLabel,
  parseEstimate,
  priorityColor,
  priorityLabel,
  statusColor,
} from '@/modules/items/presentation'
import { Avatar } from '@/components/ui/avatar'
import { ResponsibilityBar, type ResponsibilityContext } from '@/modules/items/components/ResponsibilityBar'
import { ChecklistPanel } from '@/modules/items/components/ChecklistPanel'
import { PrioritySelect } from '@/modules/items/components/PrioritySelect'
import { TagPicker } from '@/modules/tags/components/TagPicker'
import type { Item, ItemState } from '@/modules/items/types'
import type { List } from '@/modules/lists/data/lists-repository'

// 'snoozed' is deliberately not hand-selectable (D-c / TD-011) — snooze is a
// defer-until action with a date, set in Daily Review. A currently snoozed item
// still shows "Snoozed" (added at render) so the control reflects its real state.
const STATUS_OPTIONS: ItemState[] = ['captured', 'committed', 'in_progress', 'done', 'backlog']
const statusOptionsFor = (state: ItemState): ItemState[] =>
  state === 'snoozed' ? [...STATUS_OPTIONS, 'snoozed'] : STATUS_OPTIONS

// Start/end and reminder are precise instants — date + time. `remind_at` is
// stored as an absolute UTC instant; a `datetime-local` control edits it in the
// user's own wall-clock zone. new Date('…T09:00') reads the input as LOCAL time and
// toISOString() renders the absolute UTC instant — the TD-005-correct round trip, so
// a 9am reminder fires at 9am in the user's zone, not shifted by the UTC offset.
function dtLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const toInstantFromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

/** A labelled row: label left, value right, "Empty" when unset. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1 text-right text-xs">{children}</div>
    </div>
  )
}

function QuickField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-0.5 text-[10px] text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/**
 * The task detail side-panel (PDL-036) — replaces the old row-expand.
 *
 * UI only: every write goes through the same hooks the row used, so permissions
 * (writable_item_ids / RLS) and Zod validation are unchanged. The Activity feed is
 * the existing append-only `activity_events` trail, read-only — comment-writing is
 * deferred, not silently added here.
 */
export function TaskPanel({
  item,
  canWrite,
  responsibility,
  organizationId,
  currentUserId,
  lists,
  onClose,
}: {
  item: Item
  canWrite: boolean
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
  organizationId: string
  currentUserId: string
  lists?: List[]
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body ?? '')
  const [estimate, setEstimate] = useState(formatEstimate(item.time_estimate_minutes))

  const update = useUpdateItem()
  const complete = useCompleteItem()
  const reopen = useReopenItem()
  const setState = useSetItemState()
  const { data: activity, isLoading: activityLoading } = useItemActivity(item.id)

  // `busy` gates the one-shot controls (selects, dates, the complete button) only.
  // The free-text fields — title, description, estimate — are deliberately NOT
  // disabled by it: they save on blur, so a save triggered by any *other* field
  // would disable the box mid-typing and silently drop the keystrokes.
  const busy = update.isPending || complete.isPending || reopen.isPending || setState.isPending
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'That change could not be saved.')
  const isNote = item.type === 'note'
  const isDone = item.state === 'done'

  // Re-seed the local draft when the panel is pointed at a different item, and when
  // a value changes underneath us (someone else's edit, or our own save landing).
  useEffect(() => setTitle(item.title), [item.id, item.title])
  useEffect(() => setBody(item.body ?? ''), [item.id, item.body])
  useEffect(() => setEstimate(formatEstimate(item.time_estimate_minutes)), [item.id, item.time_estimate_minutes])

  // Escape closes — the panel must feel as cheap to leave as to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function changeStatus(next: ItemState) {
    if (next === item.state) return
    if (next === 'done') complete.mutate({ id: item.id, type: item.type }, { onError: fail })
    else if (isDone) {
      reopen.mutate({ id: item.id }, { onError: fail, onSuccess: () => {
        if (next !== 'committed') setState.mutate({ id: item.id, state: next }, { onError: fail })
      } })
    } else setState.mutate({ id: item.id, state: next }, { onError: fail })
  }

  function saveTitle() {
    const next = title.trim()
    if (!next || next === item.title) {
      setTitle(item.title)
      return
    }
    update.mutate({ id: item.id, patch: { title: next } }, { onError: fail })
  }

  function saveBody() {
    if (body === (item.body ?? '')) return
    update.mutate({ id: item.id, patch: { body: body || null } }, { onError: fail })
  }

  function saveEstimate() {
    const minutes = parseEstimate(estimate)
    if (minutes === item.time_estimate_minutes) {
      setEstimate(formatEstimate(item.time_estimate_minutes))
      return
    }
    update.mutate(
      { id: item.id, patch: { timeEstimateMinutes: minutes } },
      { onError: fail, onSuccess: () => setEstimate(formatEstimate(minutes)) },
    )
  }

  const field = 'h-7 w-full rounded border border-transparent bg-transparent px-1 text-xs hover:border-input disabled:opacity-60'
  const listName = lists?.find((l) => l.id === item.list_id)?.name ?? 'Inbox (no list)'

  return (
    <>
      {/* Scrim — click-away closes. */}
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-foreground/10"
      />

      <aside
        role="dialog"
        aria-label={`Details for ${item.title}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-border bg-background shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
            {itemTypeLabel(item)}
          </span>
          <span className="text-xs text-muted-foreground">{listName}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left: the task itself */}
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-3">
            {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

            {/* Title — inline-editable */}
            <div className="mb-3 flex items-start gap-2">
              {canWrite && !isNote && (
                <button
                  type="button"
                  aria-label={isDone ? `Reopen ${item.title}` : `Complete ${item.title}`}
                  title={isDone ? 'Reopen' : 'Mark complete'}
                  disabled={busy}
                  onClick={() =>
                    isDone
                      ? reopen.mutate({ id: item.id }, { onError: fail })
                      : complete.mutate({ id: item.id, type: item.type }, { onError: fail })
                  }
                  className={`mt-1 shrink-0 rounded-full border p-0.5 ${
                    isDone
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-input text-transparent hover:border-emerald-600 hover:text-emerald-600'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              {canWrite ? (
                <input
                  aria-label="Title"
                  className={`w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-lg font-medium hover:border-input focus:border-input focus:outline-none ${
                    isDone ? 'text-muted-foreground line-through' : ''
                  }`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setTitle(item.title)
                  }}
                />
              ) : (
                <h2 className={`px-1 text-lg font-medium ${isDone ? 'text-muted-foreground line-through' : ''}`}>
                  {item.title}
                </h2>
              )}
            </div>

            {/* Quick fields */}
            {/* Dates needs two tracks — a start and a due input do not fit in one. */}
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <QuickField label="Status">
                {canWrite ? (
                  <select
                    aria-label="Status"
                    className={`h-7 cursor-pointer rounded-full px-2 text-[11px] font-medium focus:outline-none ${statusColor(item.state)}`}
                    value={item.state}
                    disabled={busy}
                    onChange={(e) => changeStatus(e.target.value as ItemState)}
                  >
                    {statusOptionsFor(item.state).filter((s) => !(isNote && s === 'done')).map((s) => (
                      <option key={s} value={s} className="bg-background text-foreground">
                        {itemStateLabel(s)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(item.state)}`}>
                    {itemStateLabel(item.state)}
                  </span>
                )}
              </QuickField>

              <QuickField label="Priority">
                {canWrite ? (
                  <PrioritySelect
                    value={item.priority}
                    label="Priority"
                    disabled={busy}
                    onChange={(p) => update.mutate({ id: item.id, patch: { priority: p } }, { onError: fail })}
                  />
                ) : (
                  <span className={`flex items-center gap-1 text-xs ${priorityColor(item.priority)}`}>
                    <Flag className="h-3 w-3 shrink-0" fill="currentColor" />
                    {priorityLabel(item.priority)}
                  </span>
                )}
              </QuickField>

              {!isNote && (
                <QuickField label="Start & end" className="col-span-2">
                  {canWrite ? (
                    <div className="space-y-1">
                      <input
                        type="datetime-local"
                        aria-label="Start"
                        className={field}
                        value={dtLocalInput(item.start_at)}
                        disabled={busy}
                        onChange={(e) => update.mutate({ id: item.id, patch: { startAt: toInstantFromLocal(e.target.value) } }, { onError: fail })}
                      />
                      <input
                        type="datetime-local"
                        aria-label="End"
                        className={field}
                        value={dtLocalInput(item.due_at)}
                        disabled={busy}
                        onChange={(e) => update.mutate({ id: item.id, patch: { dueAt: toInstantFromLocal(e.target.value) } }, { onError: fail })}
                      />
                      {/* Show how a no-clock-time date is interpreted (PDL-043): the
                          06:00–24:00 default window, so "no time" reads sensibly. */}
                      {(item.start_at || item.due_at) &&
                        (!hasTimeOfDay(item.start_at) || !hasTimeOfDay(item.due_at)) && (
                          <p className="text-[10px] text-muted-foreground">
                            Reads as {formatScheduleWindow(item.start_at, item.due_at)}
                          </p>
                        )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatScheduleWindow(item.start_at, item.due_at) || '—'}
                    </span>
                  )}
                </QuickField>
              )}

              {!isNote && (
                <QuickField label="Time estimate">
                  {canWrite ? (
                    <input
                      aria-label="Time estimate"
                      placeholder="e.g. 2h 30m"
                      className={field}
                      value={estimate}
                      onChange={(e) => setEstimate(e.target.value)}
                      onBlur={saveEstimate}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEstimate(formatEstimate(item.time_estimate_minutes))
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatEstimate(item.time_estimate_minutes) || '—'}
                    </span>
                  )}
                </QuickField>
              )}

              {!isNote && (
                <QuickField label="Remind me">
                  {canWrite ? (
                    <input
                      type="datetime-local"
                      aria-label="Reminder"
                      className={field}
                      value={dtLocalInput(item.remind_at)}
                      disabled={busy}
                      onChange={(e) => update.mutate({ id: item.id, patch: { remindAt: toInstantFromLocal(e.target.value) } }, { onError: fail })}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {item.remind_at
                        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.remind_at))
                        : '—'}
                    </span>
                  )}
                </QuickField>
              )}

              {!isNote && lists && lists.length > 0 && (
                <QuickField label="List">
                  {canWrite ? (
                    <select
                      aria-label="List"
                      className={`${field} cursor-pointer`}
                      value={item.list_id ?? ''}
                      disabled={busy}
                      onChange={(e) => update.mutate({ id: item.id, patch: { listId: e.target.value || null } }, { onError: fail })}
                    >
                      <option value="">Inbox (no list)</option>
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{listName}</span>
                  )}
                </QuickField>
              )}
            </div>

            {/* Description */}
            <div className="mb-4">
              {canWrite ? (
                <textarea
                  aria-label="Description"
                  placeholder="Add description..."
                  rows={3}
                  className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 text-xs hover:border-input focus:border-input focus:outline-none"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onBlur={saveBody}
                />
              ) : (
                <p className="px-2 text-xs text-muted-foreground">{item.body || 'No description.'}</p>
              )}
            </div>

            {/* Fields — labelled rows, value on the right */}
            <section className="mb-4">
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">Fields</h3>

              {/* Tags apply to EVERY type — they are the flat organising primitive
                  (PDL-010 / Doc 4), unlike checklist+DoD, which need a done-state. */}
              <FieldRow label="Tags">
                <div className="flex justify-end">
                  <TagPicker
                    itemId={item.id}
                    organizationId={organizationId}
                    canWrite={canWrite}
                    onError={setError}
                  />
                </div>
              </FieldRow>

              {!isNote && responsibility && (
                <FieldRow label="Responsibility">
                  <ResponsibilityBar itemId={item.id} ctx={{ ...responsibility, canWrite }} onError={setError} />
                </FieldRow>
              )}

              {!isNote && (
                <div className="py-1.5">
                  <ChecklistPanel
                    item={item}
                    organizationId={organizationId}
                    currentUserId={currentUserId}
                    canWrite={canWrite}
                    onError={setError}
                    embedded
                  />
                </div>
              )}
            </section>

            {isNote && <p className="text-xs text-muted-foreground">A note has no status, dates, checklist or definition of done.</p>}
          </div>

          {/* Right: activity — the existing audit trail, read-only */}
          <div className="hidden w-72 shrink-0 flex-col border-l border-border bg-secondary/20 lg:flex">
            <h3 className="border-b border-border px-3 py-2 text-xs font-medium">Activity</h3>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
              {activityLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
              {!activityLoading && (activity?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              )}
              {activity?.map((e) => (
                <div key={e.id} className="flex gap-2">
                  <Avatar userId={e.actorId ?? 'system'} name={e.actorName} size="xs" />
                  <div className="min-w-0 text-xs">
                    <p>
                      <span className="font-medium">{e.actorName ?? 'Someone'}</span>{' '}
                      <span className="text-muted-foreground">{activityLabel(e.eventType, e.payload)}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(e.recordedAt),
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
