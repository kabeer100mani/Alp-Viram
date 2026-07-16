import { useQuery } from '@tanstack/react-query'
import { listItemActivity } from '@/modules/items/data/activity-repository'

/** The item's audit trail. Read-only; fetched only when the panel is open. */
export function useItemActivity(itemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['activity', itemId],
    enabled: Boolean(itemId) && enabled,
    queryFn: () => listItemActivity(itemId as string),
  })
}
