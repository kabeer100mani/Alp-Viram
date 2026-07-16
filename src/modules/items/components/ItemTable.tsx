import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ItemRow } from '@/modules/items/components/ItemRow'
import { useWritableItemIds } from '@/modules/views/hooks/use-views'
import { useAssigneeSummary } from '@/modules/items/hooks/use-assignee-summary'
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
 * Rows carry inline Priority/Start/Due/Status; heavier editors are in the
 * row-expand (see ItemRow). Items render in collapsible sections with counts.
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
}: {
  groups: ItemTableGroup[]
  isLoading?: boolean
  emptyMessage?: string
  responsibility?: Omit<ResponsibilityContext, 'canWrite'>
  organizationId: string
  currentUserId: string
  lists?: List[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const allItems = groups.flatMap((g) => g.items)
  const ids = allItems.map((i) => i.id)
  const { data: writable } = useWritableItemIds(ids)
  const showAssignee = Boolean(responsibility)
  const { data: assignees } = useAssigneeSummary(ids, showAssignee)

  const nameFor = (userId: string | null | undefined) =>
    userId ? responsibility?.members.find((m) => m.userId === userId)?.displayName ?? 'Member' : null

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (allItems.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>

  // Column tracks: Title | Assignee? | Priority | Start | Due | Status.
  const gridTemplateColumns = showAssignee
    ? 'minmax(0,1fr) 8rem 6.5rem 6.5rem 6.5rem 8rem'
    : 'minmax(0,1fr) 6.5rem 6.5rem 6.5rem 8rem'

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
            <HeaderCell>Item</HeaderCell>
            {showAssignee && <HeaderCell>Assignee</HeaderCell>}
            <HeaderCell>Priority</HeaderCell>
            <HeaderCell>Start</HeaderCell>
            <HeaderCell>Due</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            return (
              <div key={group.key} role="rowgroup" className="col-span-full grid grid-cols-subgrid">
                {/* Collapsible group header: "Common · 7" */}
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
                  {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {group.label} <span className="text-muted-foreground">· {group.items.length}</span>
                </button>

                {!isCollapsed &&
                  group.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      canWrite={writable?.has(item.id) ?? false}
                      columns={{ showAssignee }}
                      assigneeName={nameFor(assignees?.get(item.id)?.assignedUser ?? assignees?.get(item.id)?.responsibleUser)}
                      responsibility={responsibility}
                      organizationId={organizationId}
                      currentUserId={currentUserId}
                      lists={lists}
                      onError={setError}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
