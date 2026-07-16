import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getActiveOrgId } from '@/modules/organizations/active-org-store'

export interface ActiveOrg {
  id: string
  name: string
  isPersonal: boolean
  teamEnabled: boolean
  role: string
}

interface OrgRow {
  id: string
  name: string
  is_personal: boolean
  team_enabled: boolean
}

/**
 * Loads the user's active organization. A user can belong to several orgs (their
 * personal one, plus any they were invited to), so we honour their persisted
 * choice (PDL-009: one active org at a time) and fall back to the earliest
 * membership. Without this, an invitee would always land in their own personal
 * org and never see the team they just joined.
 */
export function useActiveOrg(userId: string | undefined) {
  return useQuery<ActiveOrg | null>({
    queryKey: ['active-org', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('organization_members')
        .select('role, organizations(id, name, is_personal, team_enabled)')
        .eq('user_id', userId as string)
        .eq('is_active', true)
        .order('joined_at', { ascending: true })
      if (error) throw error
      if (!data || data.length === 0) return null

      const rows = data.map((row) => {
        const rel = (row as { organizations: OrgRow | OrgRow[] | null }).organizations
        const org = Array.isArray(rel) ? rel[0] : rel
        return { org, role: (row as { role: string }).role }
      })

      const chosenId = getActiveOrgId()
      const chosen = (chosenId && rows.find((r) => r.org?.id === chosenId)) || rows[0]
      const org = chosen.org
      if (!org) return null

      return {
        id: org.id,
        name: org.name,
        isPersonal: org.is_personal,
        teamEnabled: org.team_enabled,
        role: chosen.role,
      }
    },
  })
}
