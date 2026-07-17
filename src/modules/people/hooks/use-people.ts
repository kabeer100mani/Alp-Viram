import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeMemberRole,
  createInvitation,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokeInvitation,
  setMemberActive,
  type OrgMemberRole,
} from '@/modules/people/data/people-repository'

export function useMembers(organizationId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: ['members', organizationId, includeInactive],
    enabled: Boolean(organizationId),
    queryFn: () => listMembers(organizationId as string, { includeInactive }),
  })
}

/**
 * Offboarding mutations. On success, invalidate members AND everything scoped to
 * responsibility — deactivating or removing a person changes who can be an
 * assignee/holder, so those caches must not keep showing them.
 */
function useMemberMutation<TArgs>(organizationId: string | undefined, fn: (a: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', organizationId] })
      void queryClient.invalidateQueries({ queryKey: ['responsibility'] })
    },
  })
}

export function useRemoveMember(organizationId: string | undefined) {
  return useMemberMutation(organizationId, ({ membershipId }: { membershipId: string }) => removeMember(membershipId))
}

export function useSetMemberActive(organizationId: string | undefined) {
  return useMemberMutation(organizationId, ({ membershipId, isActive }: { membershipId: string; isActive: boolean }) =>
    setMemberActive(membershipId, isActive),
  )
}

export function useChangeMemberRole(organizationId: string | undefined) {
  return useMemberMutation(organizationId, ({ membershipId, role }: { membershipId: string; role: OrgMemberRole }) =>
    changeMemberRole(membershipId, role),
  )
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
