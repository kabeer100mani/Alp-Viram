import { useQuery } from '@tanstack/react-query'
import {
  listViews,
  runByRole,
  runView,
  type ItemGroup,
  type ResolvedView,
} from '@/modules/views/data/views-repository'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { ViewFilter } from '@/modules/views/view-filter'
import type { Item } from '@/modules/items/types'

export function useViews(organizationId: string | undefined) {
  return useQuery<ResolvedView[]>({
    queryKey: ['views', organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => listViews(organizationId as string),
  })
}

export function useViewItems(organizationId: string | undefined, filter: ViewFilter | undefined) {
  return useQuery<Item[]>({
    queryKey: ['items', organizationId, filter],
    enabled: Boolean(organizationId) && Boolean(filter),
    queryFn: () => runView(organizationId as string, filter as ViewFilter),
  })
}

/** The By Role view: items grouped by their primary responsible role. */
export function useByRoleGroups(organizationId: string | undefined, enabled: boolean) {
  return useQuery<ItemGroup[]>({
    queryKey: ['items', organizationId, 'by-role'],
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => runByRole(organizationId as string),
  })
}

/**
 * Which of these items may the current user write?
 *
 * Answered by the database via the same `can_write_item()` the RLS policies use,
 * so the card's affordances cannot drift from what the database will actually
 * allow. One round trip per page of items — never per item.
 */
export function useWritableItemIds(itemIds: string[]) {
  const key = [...itemIds].sort()
  return useQuery<Set<string>>({
    queryKey: ['writable-items', key],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc('writable_item_ids', { p_ids: key })
      if (error) throw error
      return new Set(((data ?? []) as unknown as string[]).map(String))
    },
  })
}
