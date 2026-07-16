import type { ItemTableGroup } from '@/modules/items/components/ItemTable'
import type { Item } from '@/modules/items/types'
import type { List } from '@/modules/lists/data/lists-repository'

/** One unlabeled group — for a surface that is already scoped (a single list). */
export function singleGroup(label: string, items: Item[] | undefined): ItemTableGroup[] {
  return [{ key: 'all', label, items: items ?? [] }]
}

/**
 * Group items into their List, with an "Inbox / no list" bucket last (PDL-032:
 * a list is optional). This is the ClickUp-style grouped list ("Common · 7").
 */
export function groupByList(items: Item[] | undefined, lists: List[] | undefined): ItemTableGroup[] {
  const nameById = new Map((lists ?? []).map((l) => [l.id, l.name]))
  const buckets = new Map<string, Item[]>()
  for (const item of items ?? []) {
    const key = item.list_id ?? '__none__'
    buckets.set(key, [...(buckets.get(key) ?? []), item])
  }
  const NONE = '__none__'
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === NONE) return 1
      if (b === NONE) return -1
      return (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '')
    })
    .map(([key, groupItems]) => ({
      key,
      label: key === NONE ? 'No list' : (nameById.get(key) ?? 'List'),
      items: groupItems,
    }))
}
