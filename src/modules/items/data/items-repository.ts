import { getSupabaseClient } from '@/lib/supabase/client'
import { PermissionError } from '@/core/errors'
import type { Item, ItemState, ItemType } from '@/modules/items/types'

/** Data layer for items — the only place that talks to the `items` table. */

export async function listItems(organizationId: string): Promise<Item[]> {
  const { data, error } = await getSupabaseClient()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Item[]
}

export interface CreateItemInput {
  organizationId: string
  title: string
  type?: ItemType
  body?: string | null
  createdBy: string
  dueAt?: string | null
  remindAt?: string | null
  isReminder?: boolean
  priority?: Item['priority']
  source?: string
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const type = input.type ?? 'task'
  const { data, error } = await getSupabaseClient()
    .from('items')
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      type,
      body: input.body ?? null,
      created_by: input.createdBy,
      due_at: input.dueAt ?? null,
      remind_at: input.remindAt ?? null,
      // reminder is task-only metadata (DB CHECK enforces this)
      is_reminder: type === 'task' ? (input.isReminder ?? false) : false,
      priority: input.priority ?? 'none',
      source: input.source ?? 'manual',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Item
}

// ── Write path ────────────────────────────────────────────────────────────
// Only an admin, the creator, an assigned user, or a current holder of a
// responsible role may write (migration 0005 / Doc 8). RLS enforces that in the
// database — and it denies SILENTLY: a forbidden UPDATE simply matches no rows
// and returns no error. Every mutation below therefore goes through `patchItem`,
// which treats "no rows affected" as a permission denial rather than success.
//
// State changes and completion are logged to activity_events by DB trigger
// (`log_item_change`), so no audit write is needed here.

export interface UpdateItemInput {
  title?: string
  body?: string | null
  dueAt?: string | null
  remindAt?: string | null
  priority?: Item['priority']
  listId?: string | null
}

async function patchItem(id: string, patch: Record<string, unknown>): Promise<Item> {
  const { data, error } = await getSupabaseClient()
    .from('items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    // Zero rows: RLS refused the write (or the item is gone). Never silently
    // report success — the caller must be able to tell the difference.
    throw new PermissionError('You do not have permission to change this item.')
  }
  return data as Item
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<Item> {
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.body !== undefined) patch.body = input.body
  if (input.dueAt !== undefined) patch.due_at = input.dueAt
  if (input.remindAt !== undefined) patch.remind_at = input.remindAt
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.listId !== undefined) patch.list_id = input.listId
  return patchItem(id, patch)
}

export async function setItemState(id: string, state: ItemState): Promise<Item> {
  return patchItem(id, { state })
}

/**
 * Complete an item. Done archives it out of active views — it is not deleted and
 * stays recoverable (user journey §Done). `completed_at` is stamped here;
 * the DB trigger records the immutable 'completed' audit event.
 *
 * Notes have no done-state and no owner-to-execute (IA §Item types), so callers
 * must not offer this for a Note — guarded here as defence in depth.
 */
export async function completeItem(id: string, type: ItemType): Promise<Item> {
  if (type === 'note') {
    throw new Error('A Note has no done-state and cannot be completed.')
  }
  return patchItem(id, { state: 'done', completed_at: new Date().toISOString() })
}

/** Reopen a completed item (Done is recoverable, never destructive). */
export async function reopenItem(id: string): Promise<Item> {
  return patchItem(id, { state: 'committed', completed_at: null })
}

export async function snoozeItem(id: string, until: string): Promise<Item> {
  return patchItem(id, { state: 'snoozed', snoozed_until: until })
}
