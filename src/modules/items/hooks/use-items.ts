import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  completeItem,
  createItem,
  listItems,
  reopenItem,
  snoozeItem,
  setItemState,
  updateItem,
  wakeDueSnoozes,
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

/**
 * Wake due snoozes (TD-011) once when the workspace is ready, and again whenever
 * `trigger` changes (e.g. Daily Review opening). If anything woke, refresh items and
 * views so the woken work reappears in Today without a manual reload.
 */
export function useWakeDueSnoozes(organizationId: string | undefined, trigger?: unknown) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!organizationId) return
    void wakeDueSnoozes()
      .then((woken) => {
        if (woken > 0) {
          void queryClient.invalidateQueries({ queryKey: ['items'] })
          void queryClient.invalidateQueries({ queryKey: ['views'] })
        }
      })
      .catch(() => {
        /* waking is best-effort — a failure must not break the workspace load */
      })
  }, [organizationId, trigger, queryClient])
}
