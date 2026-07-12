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
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const { data, error } = await getSupabaseClient()
    .from('items')
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      type: input.type ?? 'task',
      body: input.body ?? null,
      created_by: input.createdBy,
      source: 'manual',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Item
}
