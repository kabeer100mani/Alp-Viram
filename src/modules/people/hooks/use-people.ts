import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInvitation,
  listMembers,
  listPendingInvitations,
  revokeInvitation,
} from '@/modules/people/data/people-repository'

export function useMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['members', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listMembers(organizationId as string),
  })
}

/** Admin-only in practice — RLS returns nothing to non-admins. */
export function usePendingInvitations(organizationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['invitations', organizationId],
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => listPendingInvitations(organizationId as string),
  })
}

export function useCreateInvitation(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'admin' | 'member' }) =>
      createInvitation(organizationId as string, email, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] }),
  })
}

export function useRevokeInvitation(organizationId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', organizationId] }),
  })
}
