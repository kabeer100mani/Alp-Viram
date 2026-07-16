import { getSupabaseClient } from '@/lib/supabase/client'
import type { Item } from '@/modules/items/types'
import type { Tables } from '@/lib/supabase/database.types'

export type Project = Tables<'projects'>
export type Folder = Tables<'folders'>
export type List = Tables<'lists'>

/**
 * The container hierarchy (PDL-035): Organization → Project → Folder → List → Item.
 * A List may sit inside a Folder or straight under a Project (folderless lists).
 * All of it is optional: an Item needs no List (it lives in the Inbox).
 *
 * Projects/folders/lists are member-writable (organising, not responsibility) and
 * archived (is_archived), never deleted, to keep history.
 */

const client = () => getSupabaseClient()

export interface FolderWithLists {
  folder: Folder
  lists: List[]
}
export interface ProjectNode {
  project: Project
  folders: FolderWithLists[]
  /** Lists directly under the project (no folder). */
  rootLists: List[]
}

export async function getProjectTree(organizationId: string): Promise<ProjectNode[]> {
  const [projectsRes, foldersRes, listsRes] = await Promise.all([
    client().from('projects').select('*').eq('organization_id', organizationId).eq('is_archived', false).order('position').order('name'),
    client().from('folders').select('*').eq('organization_id', organizationId).eq('is_archived', false).order('position').order('name'),
    client().from('lists').select('*').eq('organization_id', organizationId).eq('is_archived', false).order('position').order('name'),
  ])
  if (projectsRes.error) throw projectsRes.error
  if (foldersRes.error) throw foldersRes.error
  if (listsRes.error) throw listsRes.error

  const projects = (projectsRes.data ?? []) as Project[]
  const folders = (foldersRes.data ?? []) as Folder[]
  const lists = (listsRes.data ?? []) as List[]

  return projects.map((project) => {
    const projectFolders = folders.filter((f) => f.project_id === project.id)
    const projectLists = lists.filter((l) => l.project_id === project.id)
    return {
      project,
      folders: projectFolders.map((folder) => ({
        folder,
        lists: projectLists.filter((l) => l.folder_id === folder.id),
      })),
      rootLists: projectLists.filter((l) => l.folder_id === null),
    }
  })
}

/** Flat list of all active lists (for the item's List picker). */
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

// ── create (member-writable) ────────────────────────────────────────────────

export async function createProject(organizationId: string, name: string, createdBy: string): Promise<Project> {
  const { data, error } = await client()
    .from('projects')
    .insert({ organization_id: organizationId, name: name.trim(), created_by: createdBy })
    .select('*')
    .single()
  if (error) throw error
  return data as Project
}

export async function createFolder(
  organizationId: string,
  projectId: string,
  name: string,
  createdBy: string,
): Promise<Folder> {
  const { data, error } = await client()
    .from('folders')
    .insert({ organization_id: organizationId, project_id: projectId, name: name.trim(), created_by: createdBy })
    .select('*')
    .single()
  if (error) throw error
  return data as Folder
}

export async function createList(
  organizationId: string,
  projectId: string,
  name: string,
  createdBy: string,
  folderId: string | null,
): Promise<List> {
  const { data, error } = await client()
    .from('lists')
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      folder_id: folderId,
      name: name.trim(),
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as List
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
