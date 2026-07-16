import type { Item, ItemState, ItemType } from '@/modules/items/types'

/**
 * How items are *spoken about* in the UI.
 *
 * Storage internals must never reach the user (PDL-027). `captured` and
 * `in_progress` are database words; nobody says them. Previously `ItemList`
 * rendered `{item.state}` verbatim, which leaked both the enum and the fact that
 * a Reminder is really a Task.
 *
 * Also note what is absent: nothing here says "overdue". There is no raw overdue
 * state (FR-12b), and a shaming state is explicitly rejected (Doc 4). Lateness is
 * surfaced as Aging, a view — not a label stamped on an item.
 */

const stateLabels: Record<ItemState, string> = {
  captured: 'Inbox',
  committed: 'Committed',
  in_progress: 'In progress',
  done: 'Done',
  snoozed: 'Snoozed',
  backlog: 'Backlog',
}

export function itemStateLabel(state: ItemState): string {
  return stateLabels[state] ?? ''
}

const typeLabels: Record<ItemType, string> = {
  task: 'Task',
  note: 'Note',
  meeting: 'Meeting',
}

/**
 * A Reminder is stored as Task metadata but must *present* as a Reminder —
 * never leaking "it's really a task" (PDL-027).
 */
export function itemTypeLabel(item: Pick<Item, 'type' | 'is_reminder'>): string {
  if (item.type === 'task' && item.is_reminder) return 'Reminder'
  return typeLabels[item.type] ?? ''
}

export type Priority = Item['priority']
export const priorityOptions: Priority[] = ['none', 'low', 'medium', 'high', 'urgent']

const priorityLabels: Record<string, string> = {
  none: '—',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
export function priorityLabel(p: Priority): string {
  return priorityLabels[p] ?? '—'
}

/**
 * A neutral due-date presentation. Deliberately NOT red/shaming for past dates:
 * there is no raw "overdue" state (FR-12b) and Doc 4 rejects a shaming state —
 * lateness is surfaced by the Aging view, not by colouring a cell.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

// ── Colour ──────────────────────────────────────────────────────────────────
// Semantic colour for priority and status (the app read as monochrome before).

const priorityColors: Record<string, string> = {
  none: 'text-muted-foreground',
  low: 'text-sky-600 dark:text-sky-400',
  medium: 'text-amber-600 dark:text-amber-400',
  high: 'text-orange-600 dark:text-orange-400',
  urgent: 'text-rose-600 dark:text-rose-400',
}
export const priorityColor = (p: Priority): string => priorityColors[p] ?? priorityColors.none

const statusColors: Record<string, string> = {
  captured: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  committed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  snoozed: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  backlog: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}
export const statusColor = (s: ItemState): string => statusColors[s] ?? statusColors.captured

/**
 * A human sentence for an audit event. The raw `event_type` is a DB enum and must
 * never reach the user (PDL-027) — same rule as item state.
 */
export function activityLabel(eventType: string, payload: Record<string, unknown>): string {
  const from = payload.from as string | undefined
  const to = payload.to as string | undefined
  switch (eventType) {
    case 'created':
      return 'created this item'
    case 'completed':
      return 'completed it'
    case 'state_changed':
      return from && to
        ? `moved it from ${itemStateLabel(from as ItemState)} to ${itemStateLabel(to as ItemState)}`
        : 'changed the status'
    case 'moved_list':
      return to ? 'moved it to another list' : 'removed it from its list'
    case 'responsible_role_added':
      return 'added a responsible role'
    case 'responsible_role_removed':
      return 'removed a responsible role'
    case 'primary_role_changed':
      return 'changed the primary responsible role'
    case 'assigned_user_added':
      return 'assigned someone'
    case 'assigned_user_removed':
      return 'unassigned someone'
    case 'primary_user_changed':
      return 'changed the primary assignee'
    case 'tag_added':
      return 'added a tag'
    case 'tag_removed':
      return 'removed a tag'
    default:
      return 'updated this item'
  }
}

/** "2h 30m" from minutes; empty when unset. */
export function formatEstimate(minutes: number | null): string {
  if (!minutes || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ')
}

/** Parses "2h 30m" / "90m" / "1.5h" / "90" (minutes) → minutes, or null. */
export function parseEstimate(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (hm && (hm[1] || hm[2])) {
    const mins = Math.round((parseFloat(hm[1] ?? '0') || 0) * 60) + (parseInt(hm[2] ?? '0', 10) || 0)
    return mins > 0 ? mins : null
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// Deterministic avatar colour + initials, so people are recognisable at a glance.
const avatarPalette = [
  'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500', 'bg-teal-500',
]
export function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return avatarPalette[h % avatarPalette.length]
}
export function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
