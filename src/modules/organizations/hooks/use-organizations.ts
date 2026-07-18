import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createOrganization, deleteOrganization, listMyOrgs, renameOrganization } from '@/modules/organizations/data/organizations-repository'
import { setActiveOrgId } from '@/modules/organizations/active-org-store'

export function useMyOrgs(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-orgs', userId],
    enabled: Boolean(userId),
    queryFn: () => listMyOrgs(userId as string),
  })
}

/**
 * Create a new personal workspace and drop the user straight into it (PDL-045).
 *
 * On success the new org becomes active and the cache is cleared — mirroring
 * useSwitchOrg, because every cached query was scoped to the previous org. The new
 * org is empty (its own system views seed server-side), so there is nothing stale
 * to keep.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createOrganization(name),
    onSuccess: (newOrgId) => {
      setActiveOrgId(newOrgId)
      queryClient.clear()
    },
  })
}

export function useRenameOrganization(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameOrganization(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-orgs', userId] })
      void queryClient.invalidateQueries({ queryKey: ['active-org', userId] })
    },
  })
}

/**
 * Delete an organization. On success, clear the persisted active-org choice (it may
 * point at the org just deleted) and wipe the cache — every cached query was scoped
 * to an org that may no longer exist.
 */
export function useDeleteOrganization(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteOrganization(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-orgs', userId] })
      void queryClient.invalidateQueries({ queryKey: ['active-org', userId] })
      queryClient.clear()
    },
  })
}

/**
 * Switch the active organization (PDL-009: one at a time).
 *
 * Everything cached is scoped to the old org, so the whole cache is cleared rather
 * than selectively invalidated. Anything less risks the previous tenant's rows
 * rendering under the new one — RLS would never *serve* them again, but a stale
 * cache would still *show* them, which looks identical to a leak.
 */
export function useSwitchOrg() {
  const queryClient = useQueryClient()
  return (orgId: string) => {
    setActiveOrgId(orgId)
    queryClient.clear()
  }
}
