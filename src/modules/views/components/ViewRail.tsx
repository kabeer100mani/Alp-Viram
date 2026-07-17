import type { ReactNode } from 'react'
import { Inbox, ListFilter, Pencil, Plus, Search, Sun, Users } from 'lucide-react'
import type { ResolvedView } from '@/modules/views/data/views-repository'

/**
 * The left rail, per IA §5 — amended by PDL-032 to carry the optional Folder →
 * List tree (the `listTree` slot). Entries are intent views plus, now, optional
 * structure. Views remain the primary way to navigate.
 *
 * Progressive disclosure (PDL-022): a solo user sees no Organization or
 * People & Roles. The data model underneath is identical — only the UX differs —
 * so these reappear the moment a second member joins.
 *
 * Search is live; the list tree fills in via the `listTree` slot. Kept a comment
 * marker here for the
 * specified shape without pretending to work.
 */

/** The rail promotes these three; the rest live under "Views". */
const PRIMARY = ['Inbox', 'Today', 'Upcoming'] as const

const iconFor = (name: string) => {
  if (name === 'Inbox') return Inbox
  if (name === 'Today') return Sun
  return ListFilter
}

export function ViewRail({
  views,
  activeViewId,
  onSelect,
  inboxCount,
  isSolo,
  onSearch,
  searchActive,
  onPeople,
  peopleActive,
  listTree,
  onNewView,
  onEditView,
}: {
  views: ResolvedView[]
  activeViewId: string | undefined
  onSelect: (view: ResolvedView) => void
  inboxCount?: number
  isSolo: boolean
  onSearch: () => void
  searchActive: boolean
  onPeople: () => void
  peopleActive: boolean
  /** The optional Folder → List tree (PDL-032), rendered between views and People. */
  listTree?: ReactNode
  /** Open the editor to create a custom view. */
  onNewView?: () => void
  /** Open the editor for an existing custom view (never a system view). */
  onEditView?: (view: ResolvedView) => void
}) {
  const primary = PRIMARY.map((n) => views.find((v) => v.name === n)).filter(
    (v): v is ResolvedView => Boolean(v),
  )
  const rest = views.filter((v) => !PRIMARY.includes(v.name as (typeof PRIMARY)[number]))

  const entry = (view: ResolvedView) => {
    const Icon = iconFor(view.name)
    const active = view.id === activeViewId
    // A custom view (not system) can be edited by its owner — the pencil only
    // appears for those, matching what RLS will actually allow (D4).
    const editable = !view.isSystem && onEditView
    return (
      <li key={view.id} className="group relative">
        <button
          type="button"
          onClick={() => onSelect(view)}
          aria-current={active ? 'page' : undefined}
          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
            active ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {view.name}
          </span>
          {view.name === 'Inbox' && inboxCount ? (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {inboxCount}
            </span>
          ) : null}
        </button>
        {editable && (
          <button
            type="button"
            aria-label={`Edit view ${view.name}`}
            onClick={() => onEditView(view)}
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground group-hover:block"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </li>
    )
  }

  return (
    <nav aria-label="Views" className="w-52 shrink-0 space-y-4 border-r border-border pr-3">
      <ul className="space-y-0.5">{primary.map(entry)}</ul>

      <div className="space-y-0.5 border-t border-border pt-3">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-xs text-muted-foreground">Views</p>
          {onNewView && (
            <button
              type="button"
              aria-label="New view"
              onClick={onNewView}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ul className="space-y-0.5">{rest.map(entry)}</ul>
      </div>

      <ul className="space-y-0.5 border-t border-border pt-3 text-muted-foreground">
        <li>
          <button
            type="button"
            onClick={onSearch}
            aria-current={searchActive ? 'page' : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              searchActive
                ? 'bg-secondary font-medium text-secondary-foreground'
                : 'text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </li>
      </ul>

      {/* Optional Folder → List tree (PDL-032). */}
      {listTree}

      {/* PDL-022: hidden entirely for a solo user. Appears once the org has a
          second member (the team-flip trigger sets team_enabled). */}
      {!isSolo && (
        <ul className="space-y-0.5 border-t border-border pt-3">
          <li>
            <button
              type="button"
              onClick={onPeople}
              aria-current={peopleActive ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                peopleActive
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Users className="h-4 w-4" /> People &amp; Roles
            </button>
          </li>
        </ul>
      )}
    </nav>
  )
}
