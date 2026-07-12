import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createItem, listItems, type CreateItemInput } from '@/modules/items/data/items-repository'

export function useItems(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['items', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listItems(organizationId as string),
  })
}

export function useCreateItem(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreateItemInput, 'organizationId'>) =>
      createItem({ ...input, organizationId: organizationId as string }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items', organizationId] }),
  })
}
