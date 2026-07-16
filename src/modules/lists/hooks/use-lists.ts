import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFolder,
  createList,
  createProject,
  getProjectTree,
  listAllLists,
  listItemsInList,
} from '@/modules/lists/data/lists-repository'

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
    },
  })
}

export function useCreateProject(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(organizationId, ({ name }: { name: string }) =>
    createProject(organizationId as string, name, createdBy),
  )
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
