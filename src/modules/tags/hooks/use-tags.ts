import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTagToItem,
  createTag,
  deleteTag,
  getTagsForItems,
  listTags,
  removeTagFromItem,
  renameTag,
} from '@/modules/tags/data/tags-repository'

export function useTags(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['tags', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listTags(organizationId as string),
  })
}

/**
 * Every visible item's tags in ONE query, keyed by the id set — the same discipline
 * as `item_assignee_summary` (PDL-034). A per-row query would be N round trips on a
 * dense table.
 */
export function useItemTags(itemIds: string[], enabled = true) {
  const key = [...itemIds].sort().join(',')
  return useQuery({
    queryKey: ['item-tags', key],
    enabled: enabled && itemIds.length > 0,
    queryFn: () => getTagsForItems(itemIds),
  })
}

function useTagMutation<TArgs>(organizationId: string | undefined, fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tags', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['item-tags'] })
      // A tag change can add or drop an item from any tag-filtered view.
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useCreateTag(organizationId: string | undefined) {
  return useTagMutation(organizationId, ({ name }: { name: string }) => createTag(organizationId as string, name))
}

export function useRenameTag(organizationId: string | undefined) {
  return useTagMutation(organizationId, ({ id, name }: { id: string; name: string }) => renameTag(id, name))
}

/** Hard delete, cascading org-wide (TD-010). Admin-gated by the caller. */
export function useDeleteTag(organizationId: string | undefined) {
  return useTagMutation(organizationId, ({ id }: { id: string }) => deleteTag(id))
}

export function useAddTagToItem(organizationId: string | undefined) {
  return useTagMutation(organizationId, ({ itemId, tagId }: { itemId: string; tagId: string }) =>
    addTagToItem(organizationId as string, itemId, tagId),
  )
}

export function useRemoveTagFromItem(organizationId: string | undefined) {
  return useTagMutation(organizationId, ({ itemId, tagId }: { itemId: string; tagId: string }) =>
    removeTagFromItem(itemId, tagId),
  )
}
