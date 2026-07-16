import { getSupabaseClient } from '@/lib/supabase/client'
import { PermissionError } from '@/core/errors'
import type { Tables } from '@/lib/supabase/database.types'

export type Tag = Tables<'tags'>

/**
 * Flat tags (PDL-010) — organisation without hierarchy. No nesting, ever: tags and
 * saved views are the alternative *to* a tree, not a second one.
 *
 * The schema has been here since migration `0002` and is already hardened: the
 * `0003` red-team pass gave `item_tags` composite `(item_id, organization_id)` and
 * `(tag_id, organization_id)` FKs, so a tag cannot be attached across tenants.
 *
 * Permissions (already enforced by RLS; the UI must mirror, never re-implement):
 *  - `p_tags`            — any org member may create/rename a tag (organising, not
 *                          responsibility, same call as lists).
 *  - `p_item_tags_write` — tagging an item requires `can_write_item`, so a tag
 *                          follows the *item's* responsibility rules (Doc 8).
 *
 * ⚠️ Delete is a **hard** delete that cascades `item_tags` org-wide (TD-010). The
 * admin-only restriction lives in the UI and is **not** a security boundary — RLS
 * still permits any member to delete via the API.
 */

const client = () => getSupabaseClient()

export async function listTags(organizationId: string): Promise<Tag[]> {
  const { data, error } = await client()
    .from('tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name')
  if (error) throw error
  return (data ?? []) as Tag[]
}

export async function createTag(organizationId: string, name: string): Promise<Tag> {
  const { data, error } = await client()
    .from('tags')
    .insert({ organization_id: organizationId, name: name.trim() })
    .select()
    .single()
  if (error) throw error
  return data as Tag
}

export async function renameTag(id: string, name: string): Promise<Tag> {
  const { data, error } = await client()
    .from('tags')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Tag
}

/** Hard delete — cascades `item_tags` across the org. Admin-gated in the UI (TD-010). */
export async function deleteTag(id: string): Promise<void> {
  const { error } = await client().from('tags').delete().eq('id', id)
  if (error) throw error
}

/** The tag ids on each of these items, batched — never one query per row. */
export async function getTagsForItems(itemIds: string[]): Promise<Map<string, string[]>> {
  const byItem = new Map<string, string[]>()
  if (itemIds.length === 0) return byItem
  const { data, error } = await client().from('item_tags').select('item_id, tag_id').in('item_id', itemIds)
  if (error) throw error
  for (const row of (data ?? []) as { item_id: string; tag_id: string }[]) {
    const list = byItem.get(row.item_id) ?? []
    list.push(row.tag_id)
    byItem.set(row.item_id, list)
  }
  return byItem
}

/**
 * RLS denies silently — a forbidden write matches zero rows and returns NO error.
 * The caller must not be told "saved" when nothing was. `.select()` forces the
 * result back so a silent denial becomes a real failure.
 */
export async function addTagToItem(organizationId: string, itemId: string, tagId: string): Promise<void> {
  const { data, error } = await client()
    .from('item_tags')
    .insert({ organization_id: organizationId, item_id: itemId, tag_id: tagId })
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot tag this item.')
}

export async function removeTagFromItem(itemId: string, tagId: string): Promise<void> {
  const { data, error } = await client()
    .from('item_tags')
    .delete()
    .eq('item_id', itemId)
    .eq('tag_id', tagId)
    .select()
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError('You cannot untag this item.')
}
