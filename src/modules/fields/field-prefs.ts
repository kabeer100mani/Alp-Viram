import type { ItemState } from '@/modules/items/types'
import type { Priority } from '@/modules/items/presentation'

/**
 * Per-org customization of status & priority labels + colors (PDL-049 / M8 Gate C).
 * Only overridden values are stored; everything else falls back to the frozen §2
 * defaults below. The enum VALUES are fixed — this is relabel/recolour only.
 */
export interface FieldOverride {
  label?: string
  color?: string
}
export interface FieldPrefs {
  status?: Partial<Record<ItemState, FieldOverride>>
  priority?: Partial<Record<Priority, FieldOverride>>
}

// §2 defaults (label + colour hex). Colours mirror the --status-*/--priority-* tokens;
// `solid` (filled vs ghost pill) is NOT customizable — only label + colour are.
export const STATUS_DEFAULTS: Record<ItemState, { label: string; color: string; solid: boolean }> = {
  captured: { label: 'To Do', color: '#87909e', solid: false },
  committed: { label: 'Committed', color: '#3b82f6', solid: true },
  in_progress: { label: 'In progress', color: '#5f55ee', solid: true },
  done: { label: 'Done', color: '#2ea25f', solid: true },
  snoozed: { label: 'Snoozed', color: '#8b3ffb', solid: false },
  backlog: { label: 'Backlog', color: '#8a8d93', solid: false },
}

export const PRIORITY_DEFAULTS: Record<Priority, { label: string; color: string }> = {
  none: { label: 'None', color: '#6b6f76' },
  low: { label: 'Low', color: '#8a8d93' },
  medium: { label: 'Medium', color: '#4b6bfb' },
  high: { label: 'High', color: '#f5c518' },
  urgent: { label: 'Urgent', color: '#e5484d' },
}

export const STATUS_KEYS = Object.keys(STATUS_DEFAULTS) as ItemState[]
export const PRIORITY_KEYS = Object.keys(PRIORITY_DEFAULTS) as Priority[]

/** The org's label/colour for a status — its override if set, else the §2 default. */
export function resolveStatus(state: ItemState, prefs: FieldPrefs) {
  const d = STATUS_DEFAULTS[state]
  const o = prefs.status?.[state]
  return { label: o?.label?.trim() || d.label, color: o?.color || d.color, solid: d.solid }
}

export function resolvePriority(p: Priority, prefs: FieldPrefs) {
  const d = PRIORITY_DEFAULTS[p]
  const o = prefs.priority?.[p]
  return { label: o?.label?.trim() || d.label, color: o?.color || d.color }
}
