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
