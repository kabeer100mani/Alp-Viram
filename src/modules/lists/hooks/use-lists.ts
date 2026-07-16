import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveFolder,
  archiveList,
  createFolder,
  createList,
  getListTree,
  listAllLists,
  listItemsInList,
  renameFolder,
  renameList,
} from '@/modules/lists/data/lists-repository'

export function useListTree(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['list-tree', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => getListTree(organizationId as string),
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
      void queryClient.invalidateQueries({ queryKey: ['list-tree', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['all-lists', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useCreateFolder(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(organizationId, ({ name }: { name: string }) =>
    createFolder(organizationId as string, name, createdBy),
  )
}

export function useCreateList(organizationId: string | undefined, createdBy: string) {
  return useTreeMutation(organizationId, ({ name, folderId }: { name: string; folderId: string | null }) =>
    createList(organizationId as string, name, createdBy, folderId),
  )
}

export function useRenameFolder(organizationId: string | undefined) {
  return useTreeMutation(organizationId, ({ id, name }: { id: string; name: string }) => renameFolder(id, name))
}

export function useRenameList(organizationId: string | undefined) {
  return useTreeMutation(organizationId, ({ id, name }: { id: string; name: string }) => renameList(id, name))
}

export function useArchiveFolder(organizationId: string | undefined) {
  return useTreeMutation(organizationId, ({ id }: { id: string }) => archiveFolder(id))
}

export function useArchiveList(organizationId: string | undefined) {
  return useTreeMutation(organizationId, ({ id }: { id: string }) => archiveList(id))
}
