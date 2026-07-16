import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addChecklistItem,
  listChecklist,
  removeChecklistItem,
  setChecklistDone,
  setDefinitionOfDone,
} from '@/modules/items/data/checklist-repository'

export function useChecklist(itemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['checklist', itemId],
    enabled: Boolean(itemId) && enabled,
    queryFn: () => listChecklist(itemId as string),
  })
}

function useChecklistMutation<TArgs>(itemId: string, fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', itemId] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useAddChecklistItem(organizationId: string, itemId: string, createdBy: string) {
  return useChecklistMutation(itemId, ({ text, position }: { text: string; position: number }) =>
    addChecklistItem(organizationId, itemId, text, createdBy, position),
  )
}

export function useSetChecklistDone(itemId: string) {
  return useChecklistMutation(itemId, ({ id, isDone }: { id: string; isDone: boolean }) =>
    setChecklistDone(id, isDone),
  )
}

export function useRemoveChecklistItem(itemId: string) {
  return useChecklistMutation(itemId, ({ id }: { id: string }) => removeChecklistItem(id))
}

export function useSetDefinitionOfDone(itemId: string) {
  return useChecklistMutation(itemId, ({ text }: { text: string | null }) =>
    setDefinitionOfDone(itemId, text),
  )
}
