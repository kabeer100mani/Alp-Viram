import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFolder,
  createList,
  createListInGeneralProject,
  createProject,
  getProjectTree,
  listAllLists,
  listItemsInList,
  listsForRanking,
  updateProjectContext,
} from '@/modules/lists/data/lists-repository'
import type { List } from '@/modules/lists/data/lists-repository'

export function useProjectTree(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['project-tree', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => getProjectTree(organizationId as string),
  })
}

export function useAllLists(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['all-lists', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listAllLists(organizationId as string),
  })
}

/** Lists + their project name/context, for keyword-ranking the capture follow-up. */
export function useListsForRanking(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['lists-ranking', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listsForRanking(organizationId as string),
  })
}

export function useItemsInList(organizationId: string | undefined, listId: string | undefined) {
  return useQuery({
    queryKey: ['items', organizationId, 'list', listId],
    enabled: Boolean(organizationId) && Boolean(listId),
    queryFn: () => listItemsInList(organizationId as string, listId as string),
  })
}

function useTreeMutation<TArgs>(organizationId: string | undefined, fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-tree', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['all-lists', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['lists-ranking', organizationId] })
    },
  })
}

export function useCreateProject(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(organizationId, ({ name, context }: { name: string; context?: string | null }) =>
    createProject(organizationId as string, name, createdBy, context),
  )
}

/** Set a project's free-text context (PDL-044). */
export function useUpdateProjectContext(organizationId: string | undefined) {
  return useTreeMutation(organizationId, ({ id, context }: { id: string; context: string }) =>
    updateProjectContext(id, context),
  )
}

/**
 * Create a list on the fly from the capture follow-up, filed under "General"
 * (PDL-042). Returns the new list so the caller can immediately select it. Typed
 * directly (not via useTreeMutation, which erases the return) but invalidates the
 * same caches so it appears in the rail and the ranking picker.
 */
export function useCreateListInGeneral(organizationId: string | undefined, createdBy: string) {
  const queryClient = useQueryClient()
  return useMutation<List, Error, { name: string }>({
    mutationFn: ({ name }) => createListInGeneralProject(organizationId as string, name, createdBy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-tree', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['all-lists', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['lists-ranking', organizationId] })
    },
  })
}

export function useCreateFolder(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(organizationId, ({ projectId, name }: { projectId: string; name: string }) =>
    createFolder(organizationId as string, projectId, name, createdBy),
  )
}

export function useCreateList(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(
    organizationId,
    ({ projectId, name, folderId }: { projectId: string; name: string; folderId: string | null }) =>
      createList(organizationId as string, projectId, name, createdBy, folderId),
  )
}
