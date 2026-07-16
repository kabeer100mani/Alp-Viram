import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignUserToRole,
  closeAssignment,
  createRole,
  listAssignments,
  listRoles,
  renameRole,
  retireRole,
} from '@/modules/people/data/roles-repository'

export function useRoles(organizationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['roles', organizationId],
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => listRoles(organizationId as string),
  })
}

export function useAssignments(roleId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', roleId],
    enabled: Boolean(roleId),
    queryFn: () => listAssignments(roleId as string),
  })
}

function useRoleMutation<TArgs>(
  organizationId: string | undefined,
  fn: (args: TArgs) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      // A handover changes who is responsible for items → the By Role view moves.
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
}

export function useCreateRole(organizationId: string | undefined) {
  return useRoleMutation(organizationId, ({ name, createdBy }: { name: string; createdBy: string }) =>
    createRole(organizationId as string, name, createdBy),
  )
}

export function useRenameRole(organizationId: string | undefined) {
  return useRoleMutation(organizationId, ({ id, name }: { id: string; name: string }) =>
    renameRole(id, name),
  )
}

export function useRetireRole(organizationId: string | undefined) {
  return useRoleMutation(organizationId, ({ id }: { id: string }) => retireRole(id))
}

export function useAssignUser(organizationId: string | undefined) {
  return useRoleMutation(
    organizationId,
    ({ roleId, userId, createdBy }: { roleId: string; userId: string; createdBy: string }) =>
      assignUserToRole(organizationId as string, roleId, userId, createdBy),
  )
}

export function useCloseAssignment(organizationId: string | undefined) {
  return useRoleMutation(organizationId, ({ assignmentId }: { assignmentId: string }) =>
    closeAssignment(assignmentId),
  )
}
