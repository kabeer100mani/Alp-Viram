import { getSupabaseClient } from '@/lib/supabase/client'
import { parseViewFilter, viewFilterSchema, type ViewFilter } from '@/modules/views/view-filter'
import { PermissionError } from '@/core/errors'
import type { Item } from '@/modules/items/types'
import type { Tables } from '@/lib/supabase/database.types'

export type SavedView = Tables<'saved_views'>

/** A saved view whose stored filter has been validated (TDL-010). */
export interface ResolvedView {
  id: string
  name: string
  isSystem: boolean
  sortOrder: number
  filter: ViewFilter
  /** True when the stored JSON failed the contract and we fell back to empty. */
  filterInvalid: boolean
}

/** System views come first (rail order), then the user's own, by sort_order. */
export async function listViews(organizationId: string): Promise<ResolvedView[]> {
  const { data, error } = await getSupabaseClient()
    .from('saved_views')
    .select('*')
    .eq('organization_id', organizationId)
    .order('is_system', { ascending: false })
    .order('sort_order', { ascending: true })
  if (error) throw error

  return (data ?? []).map((v) => {
    const filter = parseViewFilter(v.filter)
    return {
      id: v.id,
      name: v.name,
      isSystem: v.is_system,
      sortOrder: v.sort_order,
      // A filter we cannot vouch for must not silently mean "show everything" —
      // fall back to an empty filter and mark it so the UI can say so.
      filter: filter ?? {},
      filterInvalid: filter === null,
    }
  })
}

/**
 * Custom saved views (Doc 4 Must Have: "system … + custom").
 *
 * Owner-private (M6 D4): RLS `p_views_read` serves a custom view only to its owner,
 * and `p_views_write` blocks writing `is_system = true`, so the database already
 * guarantees a user can neither see nor edit anyone else's view, nor touch a system
 * view. The functions below mirror that — a custom view is always created for the
 * current user, and rename/delete/retarget never touch system rows.
 *
 * The filter is **validated by Zod before it is stored** (TDL-010), not only when
 * read — a view that could never be parsed back should never be saved in the first
 * place. New custom views sort after every existing view.
 */
export async function createView(
  organizationId: string,
  ownerId: string,
  name: string,
  filter: ViewFilter,
): Promise<void> {
  const parsed = viewFilterSchema.safeParse(filter)
  if (!parsed.success) throw new Error('That view filter is not valid.')

  const client = getSupabaseClient()
  const { data: maxRow } = await client
    .from('saved_views')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 10

  const { data, error } = await client
    .from('saved_views')
    .insert({
      organization_id: organizationId,
      owner_id: ownerId,
      name: name.trim(),
      filter: parsed.data,
      is_system: false,
      sort_order: nextOrder,
    })
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot create a view here.')
}

export async function renameView(id: string, name: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('saved_views')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('is_system', false) // never rename a system view, even if RLS also blocks it
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot rename this view.')
}

export async function updateViewFilter(id: string, filter: ViewFilter): Promise<void> {
  const parsed = viewFilterSchema.safeParse(filter)
  if (!parsed.success) throw new Error('That view filter is not valid.')
  const { data, error } = await getSupabaseClient()
    .from('saved_views')
    .update({ filter: parsed.data })
    .eq('id', id)
    .eq('is_system', false)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot edit this view.')
}

export async function deleteView(id: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('saved_views')
    .delete()
    .eq('id', id)
    .eq('is_system', false)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot delete this view.')
}

export interface ItemGroup {
  key: string
  label: string
  items: Item[]
}

/**
 * The By Role view: active items grouped by their **primary responsible role**
 * (Doc 5). Items with no responsible role fall under "Unassigned" — which is
 * most of them until responsibility can be set on the card (Gate C); the grouping
 * is the mechanism, and it populates as roles get attached.
 *
 * Responsibility is stored as a role, not a person, so we group by role name and
 * leave "who holds it now" to the derivation shown elsewhere.
 */
export async function runByRole(organizationId: string): Promise<ItemGroup[]> {
  const client = getSupabaseClient()
  const [{ data: items, error: itemsErr }, { data: irr, error: irrErr }] = await Promise.all([
    client
      .from('items')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .neq('state', 'done')
      .order('created_at', { ascending: false }),
    client
      .from('item_responsible_roles')
      .select('item_id, is_primary, roles(name)')
      .eq('organization_id', organizationId),
  ])
  if (itemsErr) throw itemsErr
  if (irrErr) throw irrErr

  // item_id -> primary role name (fall back to any responsible role).
  const roleFor = new Map<string, string>()
  for (const row of irr ?? []) {
    const r = row as { item_id: string; is_primary: boolean; roles: { name: string } | { name: string }[] | null }
    const rel = Array.isArray(r.roles) ? r.roles[0] : r.roles
    if (!rel) continue
    if (r.is_primary || !roleFor.has(r.item_id)) roleFor.set(r.item_id, rel.name)
  }

  const groups = new Map<string, Item[]>()
  for (const item of (items ?? []) as Item[]) {
    const label = roleFor.get(item.id) ?? 'Unassigned'
    groups.set(label, [...(groups.get(label) ?? []), item])
  }

  // Named roles first (alphabetical), Unassigned last.
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)))
    .map(([label, items]) => ({ key: label, label, items }))
}

/** Start of the user's local day, as an absolute instant (TD-005 discipline). */
function startOfLocalDay(offsetDays = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

/**
 * Turn a validated filter into a query against `items`.
 *
 * Tenant scoping and per-row permissions are enforced by RLS — this only
 * expresses *intent*. Soft-deleted items are excluded here; note the database
 * does not hide them (see the register), so every read path must filter them.
 */
export async function runView(organizationId: string, filter: ViewFilter): Promise<Item[]> {
  // Tag filter resolves through `item_tags` first (tags live in a join table, not on
  // `items`). Two round trips, but only when a view actually filters on tags — and
  // far clearer than an embedded inner-join whose row shape differs from `Item`.
  let taggedItemIds: string[] | null = null
  if (filter.tags?.length) {
    const { data, error } = await getSupabaseClient()
      .from('item_tags')
      .select('item_id')
      .eq('organization_id', organizationId)
      .in('tag_id', filter.tags)
    if (error) throw error
    taggedItemIds = [...new Set((data ?? []).map((r) => (r as { item_id: string }).item_id))]
    // No item carries the tag — an empty IN would be a query error, and the answer
    // is already known.
    if (taggedItemIds.length === 0) return []
  }

  let q = getSupabaseClient()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (taggedItemIds) q = q.in('id', taggedItemIds)

  if (filter.states?.length) {
    q = q.in('state', filter.states)
  } else {
    // Default: active work. Done is archived out of active views, not deleted.
    q = q.neq('state', 'done')
  }

  if (filter.types?.length) q = q.in('type', filter.types)

  // Resolve dated windows against `nudge_at` = least(due_at, remind_at), NOT
  // `due_at` — otherwise a reminder-only item (remind_at set, no due date) surfaces
  // in no view at all once triaged (PDL-011; migration 0017). `nudge_at` is the
  // first moment the item needs a human, so Today/Upcoming catch reminders too.
  if (filter.due === 'today') {
    q = q.lt('nudge_at', startOfLocalDay(1)).not('nudge_at', 'is', null)
  } else if (filter.due === 'upcoming') {
    q = q.gte('nudge_at', startOfLocalDay(1))
  }

  // Aging = sitting untouched too long. Deliberately NOT "overdue": there is no
  // raw overdue state (FR-12b), and a shaming state is explicitly rejected.
  if (filter.agingDays !== undefined) {
    q = q.lt('updated_at', startOfLocalDay(-filter.agingDays))
  }

  if (filter.waiting === true) q = q.not('waiting_on', 'is', null)

  switch (filter.sort) {
    case 'due_asc':
      // Sort by nudge_at too — a reminder-only item has a null due_at, and ordering
      // by due_at would bury it at the end of the very view it appears in for.
      q = q.order('nudge_at', { ascending: true, nullsFirst: false })
      break
    case 'updated_desc':
      q = q.order('updated_at', { ascending: false })
      break
    default:
      q = q.order('created_at', { ascending: false })
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Item[]
}
