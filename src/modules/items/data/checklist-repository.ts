import { getSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type ChecklistItem = Tables<'checklist_items'>

/**
 * Checklists and the Definition of Done (PDL-033).
 *
 * Writes follow `can_write_item` (RLS, migration 0010) — the same rule as every
 * other item child table. Neither applies to a Note: a Note has no done-state
 * (IA §Item types), so sub-steps and a "definition of done" are meaningless on one.
 */

export async function listChecklist(itemId: string): Promise<ChecklistItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('checklist_items')
    .select('*')
    .eq('item_id', itemId)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChecklistItem[]
}

export async function addChecklistItem(
  organizationId: string,
  itemId: string,
  text: string,
  createdBy: string,
  position: number,
): Promise<void> {
  const { error } = await getSupabaseClient().from('checklist_items').insert({
    organization_id: organizationId,
    item_id: itemId,
    text: text.trim(),
    position,
    created_by: createdBy,
  })
  if (error) throw error
}

export async function setChecklistDone(id: string, isDone: boolean): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('checklist_items')
    .update({ is_done: isDone })
    .eq('id', id)
  if (error) throw error
}

export async function removeChecklistItem(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('checklist_items').delete().eq('id', id)
  if (error) throw error
}

/**
 * The Definition of Done — a plain note, deliberately not enforced (PDL-033):
 * completing an item does not require it to be satisfied. Tightening later is a
 * column-compatible change.
 */
export async function setDefinitionOfDone(itemId: string, text: string | null): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('items')
    .update({ definition_of_done: text && text.trim() ? text.trim() : null })
    .eq('id', itemId)
  if (error) throw error
}
