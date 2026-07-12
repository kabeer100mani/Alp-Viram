import { useItems } from '@/modules/items/hooks/use-items'
import type { ItemType } from '@/modules/items/types'

const typeLabel: Record<ItemType, string> = {
  task: 'Task',
  note: 'Note',
  meeting: 'Meeting',
}

export function ItemList({ organizationId }: { organizationId: string }) {
  const { data: items, isLoading } = useItems(organizationId)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading items…</p>
  }
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No items yet — capture your first above.</p>
    )
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {typeLabel[item.type]}
            </span>
            <span className="text-sm">{item.title}</span>
          </div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.state}
          </span>
        </li>
      ))}
    </ul>
  )
}
