import { useState } from 'react'
import { ChevronDown, ChevronRight, Circle } from 'lucide-react'
import { ItemRow } from '@/modules/items/components/ItemRow'
import { TaskPanel } from '@/modules/items/components/TaskPanel'
import { formatEstimate } from '@/modules/items/presentation'
import { useWritableItemIds } from '@/modules/views/hooks/use-views'
import { useAssigneeSummary } from '@/modules/items/hooks/use-assignee-summary'
import { useItemTags, useTags } from '@/modules/tags/hooks/use-tags'
import type { Tag } from '@/modules/tags/data/tags-repository'
import type { ResponsibilityContext } from '@/modules/items/components/ResponsibilityBar'
import type { Item } from '@/modules/items/types'
import type { List } from '@/modules/lists/data/lists-repository'

export interface ItemTableGroup {
  key: string
  label: string
  items: Item[]
}

/**
 * The dense, table-style item layout (PDL-034) — one presentation for every view.
 * Rows carry inline Priority/Due/Status; everything heavier lives in the task
 * detail panel (PDL-036), which the row opens on click. Items render in
 * collapsible sections with counts.
 *
 * The Assignee column exists only in team mode (PDL-022) and its data is fetched
 * for the whole page in one batched call, not per row.
 */
export function ItemTable({
  groups,
  isLoading,
  emptyMessage = 'Nothing here.',
  responsibility,
  organizationId,
  currentUserId,
  lists,
  onTagClick,
}: {
  groups: ItemTableGroup[]
  isLoading?: boolean
  emptyMessage?: string
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
  organizationId: string
  currentUserId: string
  lists?: List[]
  /** Clicking a tag chip filters by it. Omitted where filtering makes no sense. */
  onTagClick?: (tag: Tag) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)

  const allItems = groups.flatMap((g) => g.items)
  const ids = allItems.map((i) => i.id)
  const { data: writable } = useWritableItemIds(ids)
  const showAssignee = Boolean(responsibility)
  const { data: assignees } = useAssigneeSummary(ids, showAssignee)
  // Tags for the whole page in one call, then resolved id → Tag locally.
  const { data: itemTagMap } = useItemTags(ids)
  const { data: allTags } = useTags(organizationId)

  const tagsFor = (itemId: string): Tag[] => {
    const tagIds = itemTagMap?.get(itemId)
    if (!tagIds?.length || !allTags) return []
    return allTags.filter((t) => tagIds.includes(t.id))
  }

  const assigneeFor = (itemId: string): { userId: string; name: string | null } | null => {
    const s = assignees?.get(itemId)
    const userId = s?.assignedUser ?? s?.responsibleUser
    if (!userId) return null
    return { userId, name: responsibility?.members.find((m) => m.userId === userId)?.displayName ?? null }
  }

  // Re-derived from the live list rather than held in state, so an edit made in the
  // panel (or by anyone else) reflects immediately instead of showing a stale copy.
  const openItem = openId ? (allItems.find((i) => i.id === openId) ?? null) : null

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (allItems.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>

  // Column tracks: Name | Assignee? | Priority | Due date | Status.
  // Assignee is avatar-only, so it needs far less width than a name did.
  const gridTemplateColumns = showAssignee
    ? 'minmax(0,1fr) 4.5rem 7rem 6.5rem 8rem'
    : 'minmax(0,1fr) 7rem 6.5rem 8rem'

  const HeaderCell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`px-2 py-1.5 text-[10px] font-medium text-muted-foreground ${className}`}>
      {children}
    </div>
  )

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <div role="table" className="grid min-w-[42rem]" style={{ gridTemplateColumns }}>
          {/* Column header */}
          <div role="row" className="col-span-full grid grid-cols-subgrid border-b border-border bg-secondary/40">
            <HeaderCell>Name</HeaderCell>
            {showAssignee && <HeaderCell>Assignee</HeaderCell>}
            <HeaderCell>Priority</HeaderCell>
            <HeaderCell>Due date</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            // Totals: only the estimate is meaningfully summable, and only when
            // someone actually estimated something — otherwise the line is noise.
            const totalEstimate = group.items.reduce((sum, i) => sum + (i.time_estimate_minutes ?? 0), 0)
            return (
              <div key={group.key} role="rowgroup" className="col-span-full grid grid-cols-subgrid">
                {/* Collapsible group header: icon + name + count, e.g. "Common 7" */}
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      if (next.has(group.key)) next.delete(group.key)
                      else next.add(group.key)
                      return next
                    })
                  }
                  aria-expanded={!isCollapsed}
                  className="col-span-full flex items-center gap-1.5 border-b border-border bg-background px-2 py-1.5 text-left text-xs font-medium hover:bg-secondary/30"
                >
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                  <Circle className="h-2.5 w-2.5 shrink-0 fill-primary text-primary" />
                  {group.label}
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                    {group.items.length}
                  </span>
                </button>

                {!isCollapsed &&
                  group.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      canWrite={writable?.has(item.id) ?? false}
                      columns={{ showAssignee }}
                      assignee={assigneeFor(item.id)}
                      tags={tagsFor(item.id)}
                      onOpen={() => setOpenId(item.id)}
                      onTagClick={onTagClick}
                      onError={setError}
                    />
                  ))}

                {!isCollapsed && totalEstimate > 0 && (
                  <div className="col-span-full border-b border-border px-2 py-1 pl-8 text-[10px] text-muted-foreground">
                    Estimated · {formatEstimate(totalEstimate)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {openItem && (
        <TaskPanel
          item={openItem}
          canWrite={writable?.has(openItem.id) ?? false}
          responsibility={responsibility}
          organizationId={organizationId}
          currentUserId={currentUserId}
          lists={lists}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
