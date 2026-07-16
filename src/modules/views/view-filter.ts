import { z } from 'zod'

/**
 * The saved-view filter contract (TDL-010).
 *
 * Filters live in `saved_views.filter` as JSONB so a new filter dimension needs
 * no schema change — the trade-off being that the database validates nothing.
 * Zod is that validation, applied before a filter is ever turned into a query.
 * A stored filter is untrusted input: it may predate a schema change, or have
 * been written by an older client. Never trust it unparsed.
 *
 * Views are how users navigate — by intent, not by tree (IA §4).
 */

export const itemStates = ['captured', 'committed', 'in_progress', 'done', 'snoozed', 'backlog'] as const
export const itemTypes = ['task', 'note', 'meeting'] as const

/** Relative date windows. Stored relatively so a saved view never goes stale. */
export const dueWindows = ['today', 'upcoming', 'any'] as const

export const viewFilterSchema = z
  .object({
    /** Match any of these states. Omitted = all states except done. */
    states: z.array(z.enum(itemStates)).nonempty().optional(),
    /** Match any of these types. Omitted = all types. */
    types: z.array(z.enum(itemTypes)).nonempty().optional(),
    /** Relative due window, resolved against the user's local day at query time. */
    due: z.enum(dueWindows).optional(),
    /** Untouched for at least N days — the Aging surface. */
    agingDays: z.number().int().positive().max(365).optional(),
    /** Task metadata: blocked on someone else (`items.waiting_on`). */
    waiting: z.boolean().optional(),
    /**
     * Match items carrying ANY of these tag ids (PDL-010: tags are flat, and they
     * plus saved views are the alternative to a hierarchy — so a view must be able
     * to filter on them). Ids, not names: a rename must not break a saved view.
     */
    tags: z.array(z.uuid()).nonempty().optional(),
    /** Group the result. Only 'role' is specified today (the By Role view). */
    groupBy: z.literal('role').optional(),
    sort: z.enum(['created_desc', 'due_asc', 'updated_desc']).optional(),
  })
  .strict() // an unknown key means the filter was written by a newer client — fail loudly

export type ViewFilter = z.infer<typeof viewFilterSchema>

/**
 * Parse a stored filter. Returns a typed filter, or null if the stored JSON does
 * not satisfy the contract — the caller decides how to surface that, rather than
 * silently rendering a view that quietly means something else.
 */
export function parseViewFilter(raw: unknown): ViewFilter | null {
  const parsed = viewFilterSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : null
}
