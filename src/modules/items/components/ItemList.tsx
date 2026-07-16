import { useState } from 'react'
import { ItemCard } from '@/modules/items/components/ItemCard'
import { useWritableItemIds } from '@/modules/views/hooks/use-views'
import type { ResponsibilityContext } from '@/modules/items/components/ResponsibilityBar'
import type { Item } from '@/modules/items/types'

/**
 * Renders the items of the active view. Users never scroll a giant flat list —
 * they filter (IA §Scale), so this is always a view's result, never "everything".
 */
export function ItemList({
  items,
  isLoading,
  emptyMessage = 'Nothing here.',
  responsibility,
}: {
  items: Item[] | undefined
  isLoading?: boolean
  emptyMessage?: string
  /** Team-mode responsibility context; omitted for solo users. */
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
}) {
  const [error, setError] = useState<string | null>(null)
  // One round trip for the whole page, answered by the database.
  const { data: writable } = useWritableItemIds((items ?? []).map((i) => i.id))

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            // Until the answer arrives, offer nothing: better to briefly show no
            // action than to offer one the database will refuse.
            canWrite={writable?.has(item.id) ?? false}
            onError={setError}
            responsibility={responsibility}
          />
        ))}
      </ul>
    </div>
  )
}
