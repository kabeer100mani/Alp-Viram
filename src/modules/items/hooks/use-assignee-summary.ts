import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'

export interface AssigneeSummary {
  assignedUser: string | null
  responsibleUser: string | null
}

/**
 * Assignee + derived responsible holder for a whole page of items, in ONE round
 * trip (migration 0014). The card fetched this per-item; a dense table over many
 * rows would otherwise be N queries.
 *
 * Only meaningful in team mode (a solo user has no assignees) — callers pass
 * enabled=false when solo, so it isn't fetched at all (PDL-022).
 */
export function useAssigneeSummary(itemIds: string[], enabled: boolean) {
  const key = [...itemIds].sort()
  return useQuery<Map<string, AssigneeSummary>>({
    queryKey: ['assignee-summary', key],
    enabled: enabled && itemIds.length > 0,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('item_assignee_summary', { p_ids: key })
      if (error) throw error
      const map = new Map<string, AssigneeSummary>()
      for (const row of (data ?? []) as {
        item_id: string
        assigned_user: string | null
        responsible_user: string | null
      }[]) {
        map.set(row.item_id, { assignedUser: row.assigned_user, responsibleUser: row.responsible_user })
      }
      return map
    },
  })
}
