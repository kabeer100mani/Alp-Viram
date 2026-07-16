import { getSupabaseClient } from '@/lib/supabase/client'
import { parseViewFilter, type ViewFilter } from '@/modules/views/view-filter'
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
  let q = getSupabaseClient()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (filter.states?.length) {
    q = q.in('state', filter.states)
  } else {
    // Default: active work. Done is archived out of active views, not deleted.
    q = q.neq('state', 'done')
  }

  if (filter.types?.length) q = q.in('type', filter.types)

  if (filter.due === 'today') {
    q = q.lt('due_at', startOfLocalDay(1)).not('due_at', 'is', null)
  } else if (filter.due === 'upcoming') {
    q = q.gte('due_at', startOfLocalDay(1))
  }

  // Aging = sitting untouched too long. Deliberately NOT "overdue": there is no
  // raw overdue state (FR-12b), and a shaming state is explicitly rejected.
  if (filter.agingDays !== undefined) {
    q = q.lt('updated_at', startOfLocalDay(-filter.agingDays))
  }

  if (filter.waiting === true) q = q.not('waiting_on', 'is', null)

  switch (filter.sort) {
    case 'due_asc':
      q = q.order('due_at', { ascending: true, nullsFirst: false })
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
