import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSection } from '@/app/section-context'
import { ItemTable } from '@/modules/items/components/ItemTable'
import { TagChip } from '@/modules/tags/components/TagChip'
import type { Tag } from '@/modules/tags/data/tags-repository'
import { groupByList } from '@/modules/items/grouping'
import { ViewRail } from '@/modules/views/components/ViewRail'
import { ViewEditor } from '@/modules/views/components/ViewEditor'
import { useByRoleGroups, useViewItems, useViews } from '@/modules/views/hooks/use-views'
import { useWakeDueSnoozes } from '@/modules/items/hooks/use-items'
import { DailyReview } from '@/modules/review/components/DailyReview'
import { useSearch } from '@/modules/search/use-search'
import { useAllLists } from '@/modules/lists/hooks/use-lists'
import { useMembers } from '@/modules/people/hooks/use-people'
import { useRoles } from '@/modules/people/hooks/use-roles'
import type { ResolvedView } from '@/modules/views/data/views-repository'

/**
 * Capture section (PDL-048) — the work area. Holds the intent-based item views
 * (Inbox/Today/Upcoming/… via ViewRail), Search, a tag-filter pane, and the Daily
 * Review ritual (a prominent action here, per the M8 decision). Capture itself is the
 * global "+" in the shell, so there's no inline capture box.
 */
export function CaptureSection() {
  const { userId, org, isSolo } = useSection()
  const [activeId, setActiveId] = useState<string | undefined>()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pane, setPane] = useState<'view' | 'search' | 'tag'>('view')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<{ id: string; name: string } | undefined>()
  const [viewEditor, setViewEditor] = useState<{ mode: 'new' } | { mode: 'edit'; view: ResolvedView } | null>(null)

  const { data: views, isLoading: viewsLoading } = useViews(org.id)
  const active: ResolvedView | undefined = useMemo(
    () => views?.find((v) => v.id === activeId) ?? views?.find((v) => v.name === 'Inbox') ?? views?.[0],
    [views, activeId],
  )
  const groupedByRole = active?.filter.groupBy === 'role'
  const { data: items, isLoading: itemsLoading } = useViewItems(org.id, groupedByRole ? undefined : active?.filter)
  const { data: roleGroups, isLoading: groupsLoading } = useByRoleGroups(org.id, Boolean(groupedByRole))
  useWakeDueSnoozes(org.id, reviewOpen)
  const { data: tagItems, isLoading: tagLoading } = useViewItems(
    org.id,
    pane === 'tag' && activeTag ? { tags: [activeTag.id] } : undefined,
  )
  const openTag = (tag: Tag) => {
    setActiveTag({ id: tag.id, name: tag.name })
    setPane('tag')
  }

  const inboxView = views?.find((v) => v.name === 'Inbox')
  const { data: inboxItems } = useViewItems(org.id, inboxView?.filter)
  const { data: results, isLoading: searchLoading } = useSearch(org.id, query)
  const { data: allLists } = useAllLists(org.id)

  const { data: teamRoles } = useRoles(org.id, !isSolo)
  const { data: teamMembers } = useMembers(isSolo ? undefined : org.id)
  const responsibility =
    !isSolo && teamRoles && teamMembers
      ? { organizationId: org.id, currentUserId: userId, roles: teamRoles, members: teamMembers }
      : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Capture</h1>
        {/* Daily Review is the only way items leave the Inbox (PDL-016); kept prominent. */}
        <Button variant={reviewOpen ? 'secondary' : 'outline'} size="sm" onClick={() => setReviewOpen((o) => !o)}>
          <ListChecks className="h-4 w-4" /> Daily Review
          {inboxItems?.length ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {inboxItems.length}
            </span>
          ) : null}
        </Button>
      </div>

      {reviewOpen && (
        <DailyReview organizationId={org.id} currentUserId={userId} isSolo={isSolo} onClose={() => setReviewOpen(false)} />
      )}

      {viewsLoading || !views ? (
        <p className="text-sm text-muted-foreground">Loading views…</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <ViewRail
            views={views}
            activeViewId={pane === 'view' ? active?.id : undefined}
            onSelect={(v) => {
              setPane('view')
              setActiveId(v.id)
            }}
            inboxCount={inboxItems?.length}
            isSolo={isSolo}
            onSearch={() => setPane('search')}
            searchActive={pane === 'search'}
            onNewView={() => setViewEditor({ mode: 'new' })}
            onEditView={(v) => setViewEditor({ mode: 'edit', view: v })}
          />
          <section className="min-w-0 flex-1 space-y-3">
            {pane === 'tag' ? (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Tagged</h2>
                  {activeTag && <TagChip tag={{ id: activeTag.id, name: activeTag.name, color: null } as Tag} />}
                  <button
                    type="button"
                    onClick={() => setPane('view')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <ItemTable
                  groups={groupByList(tagItems, allLists)}
                  isLoading={tagLoading}
                  emptyMessage="No items carry this tag."
                  responsibility={responsibility}
                  organizationId={org.id}
                  currentUserId={userId}
                  lists={allLists}
                  onTagClick={openTag}
                />
              </>
            ) : pane === 'search' ? (
              <>
                <h2 className="text-sm font-semibold">Search</h2>
                <Input
                  autoFocus
                  placeholder="Search your items…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search your items"
                />
                {query.trim().length < 2 ? (
                  <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>
                ) : (
                  <ItemTable
                    groups={groupByList(results, allLists)}
                    isLoading={searchLoading}
                    emptyMessage={`Nothing matches “${query.trim()}”.`}
                    responsibility={responsibility}
                    organizationId={org.id}
                    currentUserId={userId}
                    lists={allLists}
                    onTagClick={openTag}
                  />
                )}
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold">{active?.name}</h2>
                {active?.filterInvalid && (
                  <p className="text-sm text-destructive">
                    This view’s filter could not be read, so it is showing everything active.
                  </p>
                )}
                <ItemTable
                  groups={
                    groupedByRole
                      ? (roleGroups ?? []).map((g) => ({ key: g.key, label: g.label, items: g.items }))
                      : groupByList(items, allLists)
                  }
                  isLoading={groupedByRole ? groupsLoading : itemsLoading}
                  emptyMessage={
                    active?.name === 'Inbox' ? 'Inbox zero — add something with Quick capture.' : 'Nothing in this view.'
                  }
                  responsibility={responsibility}
                  organizationId={org.id}
                  currentUserId={userId}
                  lists={allLists}
                  onTagClick={openTag}
                />
              </>
            )}
          </section>
        </div>
      )}

      {viewEditor && (
        <ViewEditor
          organizationId={org.id}
          ownerId={userId}
          view={viewEditor.mode === 'edit' ? viewEditor.view : undefined}
          onClose={() => setViewEditor(null)}
        />
      )}
    </div>
  )
}
