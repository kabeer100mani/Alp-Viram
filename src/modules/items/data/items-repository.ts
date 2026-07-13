import { getSupabaseClient } from '@/lib/supabase/client'
import type { Item, ItemType } from '@/modules/items/types'

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
