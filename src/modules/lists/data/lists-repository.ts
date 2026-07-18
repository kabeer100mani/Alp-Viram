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

/** A list plus its project's name + free-text context — the input to keyword ranking. */
export interface ListForRanking {
  id: string
  name: string
  projectName: string | null
  projectContext: string | null
}

/**
 * Lists with their project's name + context (PDL-044), for keyword-ranking the
 * capture follow-up. Two FKs are not in play here — a list has one project — so a
 * plain embed on the project is unambiguous.
 */
export async function listsForRanking(organizationId: string): Promise<ListForRanking[]> {
  const { data, error } = await client()
    .from('lists')
    .select('id, name, projects(name, context)')
    .eq('organization_id', organizationId)
    .eq('is_archived', false)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => {
    const rel = (row as { projects: { name: string | null; context: string | null } | { name: string | null; context: string | null }[] | null }).projects
    const project = Array.isArray(rel) ? rel[0] : rel
    return {
      id: (row as { id: string }).id,
      name: (row as { name: string }).name,
      projectName: project?.name ?? null,
      projectContext: project?.context ?? null,
    }
  })
}

// ── create (member-writable) ────────────────────────────────────────────────

export async function createProject(
  organizationId: string,
  name: string,
  createdBy: string,
  context?: string | null,
): Promise<Project> {
  const { data, error } = await client()
    .from('projects')
    .insert({ organization_id: organizationId, name: name.trim(), created_by: createdBy, context: context?.trim() || null })
    .select('*')
    .single()
  if (error) throw error
  return data as Project
}

/**
 * Create a list quickly from the capture follow-up (PDL-042), filing it under a
 * shared **"General"** project — created once and reused thereafter (the same
 * convention migration 0015 seeds). A list must have a project (`lists.project_id`
 * NOT NULL), so this keeps "+ Create new list" to a single field (the list name):
 * the user never has to name a project. Applied uniformly whether the org has zero
 * projects or many (ruled 2026-07-18).
 */
export async function createListInGeneralProject(
  organizationId: string,
  name: string,
  createdBy: string,
): Promise<List> {
  const { data: existing, error: findErr } = await client()
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_archived', false)
    .ilike('name', 'General')
    .limit(1)
  if (findErr) throw findErr
  let projectId = (existing as { id: string }[] | null)?.[0]?.id
  if (!projectId) {
    const project = await createProject(organizationId, 'General', createdBy)
    projectId = project.id
  }
  return createList(organizationId, projectId, name, createdBy, null)
}

/** Set a project's free-text context (PDL-044). Member-writable, like create. */
export async function updateProjectContext(id: string, context: string): Promise<void> {
  const { error } = await client()
    .from('projects')
    .update({ context: context.trim() || null })
    .eq('id', id)
  if (error) throw error
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
