import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Item } from '@/modules/items/types'

/**
 * Full-text search over items.
 *
 * Doc 5 makes views + search the substitute for hierarchy navigation — "users
 * never scroll a giant flat list; they filter". Backed by the `items.search`
 * tsvector generated in migration 0002, so this is a real index scan, not a LIKE.
 *
 * Tenant scoping and per-row visibility are enforced by RLS.
 */
export function useSearch(organizationId: string | undefined, query: string) {
  const q = query.trim()
  return useQuery<Item[]>({
    queryKey: ['search', organizationId, q],
    enabled: Boolean(organizationId) && q.length >= 2,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('items')
        .select('*')
        .eq('organization_id', organizationId as string)
        .is('deleted_at', null)
        // websearch syntax: quoted phrases and OR behave as a user expects.
        .textSearch('search', q, { type: 'websearch', config: 'english' })
        .order('updated_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Item[]
    },
  })
}
