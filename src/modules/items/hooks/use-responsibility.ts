import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addAssignedUser,
  addCollaborator,
  addResponsibleRole,
  getItemResponsibility,
  removeAssignedUser,
  removeCollaborator,
  removeResponsibleRole,
  setPrimaryResponsibleRole,
} from '@/modules/items/data/responsibility-repository'

export function useItemResponsibility(itemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['responsibility', itemId],
    enabled: Boolean(itemId) && enabled,
    queryFn: () => getItemResponsibility(itemId as string),
  })
}

function useResponsibilityMutation<TArgs>(itemId: string, fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['responsibility', itemId] })
      // Responsibility drives the By Role view.
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useAddResponsibleRole(organizationId: string, itemId: string, createdBy: string) {
  return useResponsibilityMutation(itemId, ({ roleId, makePrimary }: { roleId: string; makePrimary?: boolean }) =>
    addResponsibleRole(organizationId, itemId, roleId, createdBy, makePrimary),
  )
}

export function useRemoveResponsibleRole(itemId: string) {
  return useResponsibilityMutation(itemId, ({ id }: { id: string }) => removeResponsibleRole(id))
}

export function useSetPrimaryResponsibleRole(organizationId: string, itemId: string, createdBy: string) {
  return useResponsibilityMutation(itemId, ({ roleId }: { roleId: string | null }) =>
    setPrimaryResponsibleRole(organizationId, itemId, roleId, createdBy),
  )
}

export function useAddAssignedUser(organizationId: string, itemId: string, createdBy: string) {
  return useResponsibilityMutation(itemId, ({ userId }: { userId: string }) =>
    addAssignedUser(organizationId, itemId, userId, createdBy),
  )
}

export function useRemoveAssignedUser(itemId: string) {
  return useResponsibilityMutation(itemId, ({ id }: { id: string }) => removeAssignedUser(id))
}

export function useAddCollaborator(organizationId: string, itemId: string) {
  return useResponsibilityMutation(itemId, ({ userId }: { userId: string }) =>
    addCollaborator(organizationId, itemId, userId),
  )
}

export function useRemoveCollaborator(itemId: string) {
  return useResponsibilityMutation(itemId, ({ id }: { id: string }) => removeCollaborator(id))
}
