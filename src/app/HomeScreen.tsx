import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/modules/auth/auth-context'
import { useActiveOrg } from '@/modules/organizations/use-active-org'
import { AiCaptureBox } from '@/modules/inbox/components/AiCaptureBox'
import { ItemTable } from '@/modules/items/components/ItemTable'
import { groupByList, singleGroup } from '@/modules/items/grouping'
import { ViewRail } from '@/modules/views/components/ViewRail'
import { useByRoleGroups, useViewItems, useViews } from '@/modules/views/hooks/use-views'
import { DailyReview } from '@/modules/review/components/DailyReview'
import { useSearch } from '@/modules/search/use-search'
import { PeopleScreen } from '@/modules/people/components/PeopleScreen'
import { InviteTeammate } from '@/modules/people/components/InviteTeammate'
import { ListTreeNav } from '@/modules/lists/components/ListTreeNav'
import { useItemsInList, useAllLists } from '@/modules/lists/hooks/use-lists'
import { useMembers } from '@/modules/people/hooks/use-people'
import { useRoles } from '@/modules/people/hooks/use-roles'
import type { ResolvedView } from '@/modules/views/data/views-repository'

/**
 * The workspace. Navigation is by intent — pick a view, act on the items in it.
 *
 * Progressive disclosure (PDL-022): a solo user is never shown Organization,
 * membership or role concepts. The data model is identical underneath; only the
 * UX differs. (This screen previously announced "Workspace / Mode: Personal
 * (solo) / Your role: owner" to exactly the user who should never see them.)
 */
export function HomeScreen() {
  const { user, signOut } = useAuth()
  const { data: org } = useActiveOrg(user?.id)
  const [activeId, setActiveId] = useState<string | undefined>()
  const [reviewOpen, setReviewOpen] = useState(false)
  // The main pane shows exactly one of: a view, search, People & Roles, or a list.
  const [pane, setPane] = useState<'view' | 'search' | 'people' | 'list'>('view')
  const [query, setQuery] = useState('')
  const [activeList, setActiveList] = useState<{ id: string; name: string } | undefined>()

  const { data: views, isLoading: viewsLoading } = useViews(org?.id)
  const active: ResolvedView | undefined = useMemo(
    () => views?.find((v) => v.id === activeId) ?? views?.find((v) => v.name === 'Inbox') ?? views?.[0],
    [views, activeId],
  )
  const groupedByRole = active?.filter.groupBy === 'role'
  const { data: items, isLoading: itemsLoading } = useViewItems(
    org?.id,
    groupedByRole ? undefined : active?.filter,
  )
  const { data: roleGroups, isLoading: groupsLoading } = useByRoleGroups(org?.id, Boolean(groupedByRole))

  const inboxView = views?.find((v) => v.name === 'Inbox')
  const { data: inboxItems } = useViewItems(org?.id, inboxView?.filter)
  const { data: results, isLoading: searchLoading } = useSearch(org?.id, query)
  const { data: allLists } = useAllLists(org?.id)
  const { data: listItems, isLoading: listLoading } = useItemsInList(
    org?.id,
    pane === 'list' ? activeList?.id : undefined,
  )

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'there'
  const isSolo = Boolean(org?.isPersonal && !org?.teamEnabled)
  const isAdmin = org?.role === 'owner' || org?.role === 'admin'

  // Responsibility only exists in team mode (PDL-022). Fetch the roles + members
  // the editors need once, here, and hand them down.
  const { data: teamRoles } = useRoles(org?.id, !isSolo)
  const { data: teamMembers } = useMembers(isSolo ? undefined : org?.id)
  const responsibility =
    !isSolo && org && user?.id && teamRoles && teamMembers
      ? { organizationId: org.id, currentUserId: user.id, roles: teamRoles, members: teamMembers }
      : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {displayName}</h1>
          {/* A solo user has no "workspace" to speak of — saying so would leak
              the tenancy model they are deliberately not shown (PDL-022). */}
          {!isSolo && org && <p className="text-sm text-muted-foreground">{org.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* A solo user's one team action: invite the first teammate. Without
              it they'd be stuck — People & Roles (with the invite form) is hidden
              while solo (PDL-022). */}
          {isSolo && org && <InviteTeammate organizationId={org.id} />}
          {/* Top bar: [Quick capture] [Daily Review] [theme] (IA §5). The nudge
              counts "N to triage" — never "N overdue" (FR-12b). */}
          <Button
            variant={reviewOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setReviewOpen((o) => !o)}
          >
            <ListChecks className="h-4 w-4" /> Daily Review
            {inboxItems?.length ? (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {inboxItems.length}
              </span>
            ) : null}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      {org && user?.id && (
        <>
          <AiCaptureBox organizationId={org.id} userId={user.id} />

          {reviewOpen && (
            <DailyReview
              organizationId={org.id}
              currentUserId={user.id}
              isSolo={isSolo}
              onClose={() => setReviewOpen(false)}
            />
          )}

          <div className="flex gap-6">
            {viewsLoading || !views ? (
              <p className="text-sm text-muted-foreground">Loading views…</p>
            ) : (
              <>
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
                  onPeople={() => setPane('people')}
                  peopleActive={pane === 'people'}
                  listTree={
                    <ListTreeNav
                      organizationId={org.id}
                      currentUserId={user.id}
                      activeListId={pane === 'list' ? activeList?.id : undefined}
                      onSelectList={(id, name) => {
                        setActiveList({ id, name })
                        setPane('list')
                      }}
                    />
                  }
                />
                <section className="min-w-0 flex-1 space-y-3">
                  {pane === 'people' ? (
                    <PeopleScreen organizationId={org.id} isAdmin={isAdmin} currentUserId={user.id} />
                  ) : pane === 'list' ? (
                    <>
                      <h2 className="text-sm font-semibold">{activeList?.name}</h2>
                      <ItemTable
                        groups={singleGroup(activeList?.name ?? 'List', listItems)}
                        isLoading={listLoading}
                        emptyMessage="This list is empty — set an item’s list in triage or on its card."
                        responsibility={responsibility}
                        organizationId={org.id}
                        currentUserId={user.id}
                        lists={allLists}
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
                          currentUserId={user.id}
                          lists={allLists}
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
                      {/* By Role groups by role; every other view groups by List. */}
                      <ItemTable
                        groups={
                          groupedByRole
                            ? (roleGroups ?? []).map((g) => ({ key: g.key, label: g.label, items: g.items }))
                            : groupByList(items, allLists)
                        }
                        isLoading={groupedByRole ? groupsLoading : itemsLoading}
                        emptyMessage={
                          active?.name === 'Inbox'
                            ? 'Inbox zero — capture something above.'
                            : 'Nothing in this view.'
                        }
                        responsibility={responsibility}
                        organizationId={org.id}
                        currentUserId={user.id}
                        lists={allLists}
                      />
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
