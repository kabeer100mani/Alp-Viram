import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  backlogItems,
  confirmItems,
  listProjects,
  listRoles,
  listRollover,
  listTriageQueue,
  rescheduleItems,
  type TriageResult,
} from '@/modules/review/data/review-repository'
import { updateItem, type UpdateItemInput } from '@/modules/items/data/items-repository'

export function useRollover(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['review', 'rollover', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listRollover(organizationId as string),
  })
}

export function useTriageQueue(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['review', 'queue', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listTriageQueue(organizationId as string),
  })
}

/** Projects are optional (PDL-008) — commonly empty, and that is fine. */
export function useProjects(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['projects', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listProjects(organizationId as string),
  })
}

/** Pass enabled=false for a solo user: roles must not even be fetched (PDL-022). */
export function useRoles(organizationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['roles', organizationId],
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => listRoles(organizationId as string),
  })
}

function useTriageMutation<TArgs>(fn: (args: TArgs) => Promise<TriageResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Triage moves items between views and empties the Inbox badge.
      void queryClient.invalidateQueries({ queryKey: ['review'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['writable-items'] })
    },
  })
}

export function useConfirmItems() {
  return useTriageMutation(({ ids }: { ids: string[] }) => confirmItems(ids))
}

export function useBacklogItems() {
  return useTriageMutation(({ ids }: { ids: string[] }) => backlogItems(ids))
}

export function useRescheduleItems() {
  return useTriageMutation(({ ids, dueAt }: { ids: string[]; dueAt: string }) =>
    rescheduleItems(ids, dueAt),
  )
}

/** Editing a single chip before confirming (Type / Project / Role / Due). */
export function useEditChip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateItemInput }) => updateItem(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}
