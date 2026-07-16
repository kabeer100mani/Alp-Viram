import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/modules/auth/auth-context'
import { useActiveOrg } from '@/modules/organizations/use-active-org'
import { AiCaptureBox } from '@/modules/inbox/components/AiCaptureBox'
import { ItemList } from '@/modules/items/components/ItemList'
import { ViewRail } from '@/modules/views/components/ViewRail'
import { useByRoleGroups, useViewItems, useViews } from '@/modules/views/hooks/use-views'
import { DailyReview } from '@/modules/review/components/DailyReview'
import { useSearch } from '@/modules/search/use-search'
import { PeopleScreen } from '@/modules/people/components/PeopleScreen'
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
  // The main pane shows exactly one of: a view, search, or People & Roles.
  const [pane, setPane] = useState<'view' | 'search' | 'people'>('view')
  const [query, setQuery] = useState('')

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

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'there'
  const isSolo = Boolean(org?.isPersonal && !org?.teamEnabled)
  const isAdmin = org?.role === 'owner' || org?.role === 'admin'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {displayName}</h1>
          {/* A solo user has no "workspace" to speak of — saying so would leak
              the tenancy model they are deliberately not shown (PDL-022). */}
          {!isSolo && org && <p className="text-sm text-muted-foreground">{org.name}</p>}
        </div>
        <div className="flex items-center gap-2">
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
            <DailyReview organizationId={org.id} isSolo={isSolo} onClose={() => setReviewOpen(false)} />
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
                />
                <section className="min-w-0 flex-1 space-y-3">
                  {pane === 'people' ? (
                    <PeopleScreen organizationId={org.id} isAdmin={isAdmin} currentUserId={user.id} />
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
                        <ItemList
                          items={results}
                          isLoading={searchLoading}
                          emptyMessage={`Nothing matches “${query.trim()}”.`}
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
                      {groupedByRole ? (
                        groupsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : roleGroups && roleGroups.length > 0 ? (
                          <div className="space-y-4">
                            {roleGroups.map((g) => (
                              <div key={g.key} className="space-y-2">
                                <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                  {g.label} · {g.items.length}
                                </h3>
                                <ItemList items={g.items} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nothing to show.</p>
                        )
                      ) : (
                        <ItemList
                          items={items}
                          isLoading={itemsLoading}
                          emptyMessage={
                            active?.name === 'Inbox'
                              ? 'Inbox zero — capture something above.'
                              : 'Nothing in this view.'
                          }
                        />
                      )}
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
