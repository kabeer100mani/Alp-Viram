import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMyOrgs, renameOrganization } from '@/modules/organizations/data/organizations-repository'
import { setActiveOrgId } from '@/modules/organizations/active-org-store'

export function useMyOrgs(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-orgs', userId],
    enabled: Boolean(userId),
    queryFn: () => listMyOrgs(userId as string),
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
