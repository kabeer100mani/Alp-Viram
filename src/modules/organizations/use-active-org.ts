import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

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
 * Loads the user's active organization (their first membership). MVP uses a
 * single active org; a switcher comes with full multi-org later.
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
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      const relation = (data as { organizations: OrgRow | OrgRow[] | null }).organizations
      const org = Array.isArray(relation) ? relation[0] : relation
      if (!org) return null

      return {
        id: org.id,
        name: org.name,
        isPersonal: org.is_personal,
        teamEnabled: org.team_enabled,
        role: (data as { role: string }).role,
      }
    },
  })
}
