import { getSupabaseClient } from '@/lib/supabase/client'
import type { Item } from '@/modules/items/types'
import type { Tables } from '@/lib/supabase/database.types'

export type Folder = Tables<'folders'>
export type List = Tables<'lists'>

/**
 * Folders → Lists (PDL-032). Optional structure: a List may sit inside a Folder or
 * at the Org root, and an Item needs no List at all (it lives in the Inbox).
 *
 * Lists and folders are member-writable (RLS `p_lists` / `p_folders` = org member),
 * unlike roles which are admin-only — a List is lightweight organising, not
 * responsibility. They are archived (is_archived), not deleted, to keep history.
 */

const client = () => getSupabaseClient()

export interface FolderWithLists {
  folder: Folder
  lists: List[]
}

/** The tree: folders with their lists, plus lists that sit at the org root. */
export interface ListTree {
  folders: FolderWithLists[]
  rootLists: List[]
}

export async function getListTree(organizationId: string): Promise<ListTree> {
  const [foldersRes, listsRes] = await Promise.all([
    client()
      .from('folders')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('position')
      .order('name'),
    client()
      .from('lists')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_archived', false)
      .order('position')
      .order('name'),
  ])
  if (foldersRes.error) throw foldersRes.error
  if (listsRes.error) throw listsRes.error

  const folders = (foldersRes.data ?? []) as Folder[]
  const lists = (listsRes.data ?? []) as List[]
  return {
    folders: folders.map((folder) => ({
      folder,
      lists: lists.filter((l) => l.folder_id === folder.id),
    })),
    rootLists: lists.filter((l) => l.folder_id === null),
  }
}

/** Flat list of all active lists (for pickers). */
export async function listAllLists(organizationId: string): Promise<List[]> {
  const { data, error } = await client()
    .from('lists')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_archived', false)
    .order('name')
  if (error) throw error
  return (data ?? []) as List[]
}

export async function createFolder(organizationId: string, name: string, createdBy: string): Promise<Folder> {
  const { data, error } = await client()
    .from('folders')
    .insert({ organization_id: organizationId, name: name.trim(), created_by: createdBy })
    .select('*')
    .single()
  if (error) throw error
  return data as Folder
}

export async function createList(
  organizationId: string,
  name: string,
  createdBy: string,
  folderId: string | null,
): Promise<List> {
  const { data, error } = await client()
    .from('lists')
    .insert({ organization_id: organizationId, name: name.trim(), created_by: createdBy, folder_id: folderId })
    .select('*')
    .single()
  if (error) throw error
  return data as List
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const { error } = await client().from('folders').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

export async function renameList(id: string, name: string): Promise<void> {
  const { error } = await client().from('lists').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

/** Archive, not delete — items keep their history; item.list_id nulls on delete anyway. */
export async function archiveFolder(id: string): Promise<void> {
  const { error } = await client().from('folders').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

export async function archiveList(id: string): Promise<void> {
  const { error } = await client().from('lists').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

/** Items in a given list (active, non-deleted). */
export async function listItemsInList(organizationId: string, listId: string): Promise<Item[]> {
  const { data, error } = await client()
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('list_id', listId)
    .is('deleted_at', null)
    .neq('state', 'done')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Item[]
}
