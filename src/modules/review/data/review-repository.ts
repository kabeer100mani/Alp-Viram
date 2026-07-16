import { getSupabaseClient } from '@/lib/supabase/client'
import type { Item } from '@/modules/items/types'
import type { Tables } from '@/lib/supabase/database.types'

/**
 * Data for the Daily Review — the ritual that stops capture-first becoming a
 * dumping ground (PDL-016). It is the ONLY way items leave the Inbox.
 */

export type List = Tables<'lists'>
export type Role = Tables<'roles'>

/** Start of the user's local day, as an absolute instant. */
export function startOfLocalDay(offsetDays = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

/**
 * Stage 1 — Rollover: work that was due before today and is still unfinished.
 *
 * Deliberately NOT called "overdue": there is no raw overdue state (FR-12b) and
 * a shaming state is rejected outright (Doc 4). These are simply unfinished, and
 * are offered neutral moves.
 */
export async function listRollover(organizationId: string): Promise<Item[]> {
  const { data, error } = await getSupabaseClient()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('state', ['committed', 'in_progress'])
    .lt('due_at', startOfLocalDay())
    .order('due_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Item[]
}

/** Stage 2 — the Inbox queue awaiting triage (state = captured). */
export async function listTriageQueue(organizationId: string): Promise<Item[]> {
  const { data, error } = await getSupabaseClient()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .eq('state', 'captured')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Item[]
}

/** Lists are optional and lazily created (PDL-008/PDL-032) — often none exist. */
export async function listLists(organizationId: string): Promise<List[]> {
  const { data, error } = await getSupabaseClient()
    .from('lists')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_archived', false)
    .order('name')
  if (error) throw error
  return (data ?? []) as List[]
}

/** Roles are hidden entirely from solo users (PDL-022) — callers must check. */
export async function listRoles(organizationId: string): Promise<Role[]> {
  const { data, error } = await getSupabaseClient()
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Role[]
}

export interface TriageResult {
  confirmed: Item[]
  /** Items RLS refused — the user may see an item they may not triage. */
  refusedIds: string[]
}

/**
 * Confirm items out of the Inbox: captured → committed.
 *
 * Read is org-wide but write is not (Doc 8), so a member can *see* a colleague's
 * captured item and be refused when confirming it. RLS refuses silently — the
 * refused rows simply do not come back — so we diff the returned ids against
 * what was asked and report the difference rather than claim a clean sweep.
 */
export async function confirmItems(ids: string[]): Promise<TriageResult> {
  if (ids.length === 0) return { confirmed: [], refusedIds: [] }
  const { data, error } = await getSupabaseClient()
    .from('items')
    .update({ state: 'committed' })
    .in('id', ids)
    .select('*')
  if (error) throw error
  const confirmed = (data ?? []) as Item[]
  const got = new Set(confirmed.map((i) => i.id))
  return { confirmed, refusedIds: ids.filter((id) => !got.has(id)) }
}

/** Move items to Backlog ("later" only ever means Someday, reviewed on cadence). */
export async function backlogItems(ids: string[]): Promise<TriageResult> {
  if (ids.length === 0) return { confirmed: [], refusedIds: [] }
  const { data, error } = await getSupabaseClient()
    .from('items')
    .update({ state: 'backlog' })
    .in('id', ids)
    .select('*')
  if (error) throw error
  const confirmed = (data ?? []) as Item[]
  const got = new Set(confirmed.map((i) => i.id))
  return { confirmed, refusedIds: ids.filter((id) => !got.has(id)) }
}

/**
 * Rollover move: give unfinished work a new date and commit it. Neutral by
 * design — Today / a day / Backlog, never "overdue".
 */
export async function rescheduleItems(ids: string[], dueAt: string): Promise<TriageResult> {
  if (ids.length === 0) return { confirmed: [], refusedIds: [] }
  const { data, error } = await getSupabaseClient()
    .from('items')
    .update({ due_at: dueAt, state: 'committed' })
    .in('id', ids)
    .select('*')
  if (error) throw error
  const confirmed = (data ?? []) as Item[]
  const got = new Set(confirmed.map((i) => i.id))
  return { confirmed, refusedIds: ids.filter((id) => !got.has(id)) }
}
