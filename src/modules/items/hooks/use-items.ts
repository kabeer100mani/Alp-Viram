import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  completeItem,
  createItem,
  listItems,
  reopenItem,
  snoozeItem,
  setItemState,
  updateItem,
  type CreateItemInput,
  type UpdateItemInput,
} from '@/modules/items/data/items-repository'
import type { ItemState, ItemType } from '@/modules/items/types'

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

// ── Mutations ─────────────────────────────────────────────────────────────
// Every mutation can fail with a PermissionError: RLS is authoritative, and the
// card's affordances are only an affordance. Invalidate broadly — a state change
// moves an item between views (e.g. Inbox → Today), so any cached view may now
// be wrong, not just the one on screen.

function useItemMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      // Not scoped to one org key: a state change moves an item *between* views
      // (Inbox → Today → Done), so any cached view may now be stale.
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['writable-items'] })
    },
  })
}

export function useUpdateItem() {
  return useItemMutation(({ id, patch }: { id: string; patch: UpdateItemInput }) =>
    updateItem(id, patch),
  )
}

export function useCompleteItem() {
  return useItemMutation(({ id, type }: { id: string; type: ItemType }) => completeItem(id, type))
}

export function useReopenItem() {
  return useItemMutation(({ id }: { id: string }) => reopenItem(id))
}

export function useSnoozeItem() {
  return useItemMutation(({ id, until }: { id: string; until: string }) => snoozeItem(id, until))
}

export function useSetItemState() {
  return useItemMutation(({ id, state }: { id: string; state: ItemState }) => setItemState(id, state))
}
