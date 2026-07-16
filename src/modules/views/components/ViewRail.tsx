import { FolderKanban, Inbox, ListFilter, Search, Sun, Users } from 'lucide-react'
import type { ResolvedView } from '@/modules/views/data/views-repository'

/**
 * The left rail, per IA §5. Each entry is a *view* or a surface — never a deep
 * tree. Views are how users navigate: by intent, not by hierarchy.
 *
 * Progressive disclosure (PDL-022): a solo user sees no Organization or
 * People & Roles. The data model underneath is identical — only the UX differs —
 * so these reappear the moment a second member joins.
 *
 * Search and Projects are Gate B / later; shown disabled so the rail matches the
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
}: {
  views: ResolvedView[]
  activeViewId: string | undefined
  onSelect: (view: ResolvedView) => void
  inboxCount?: number
  isSolo: boolean
  onSearch: () => void
  searchActive: boolean
}) {
  const primary = PRIMARY.map((n) => views.find((v) => v.name === n)).filter(
    (v): v is ResolvedView => Boolean(v),
  )
  const rest = views.filter((v) => !PRIMARY.includes(v.name as (typeof PRIMARY)[number]))

  const entry = (view: ResolvedView) => {
    const Icon = iconFor(view.name)
    const active = view.id === activeViewId
    return (
      <li key={view.id}>
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
      </li>
    )
  }

  return (
    <nav aria-label="Views" className="w-52 shrink-0 space-y-4 border-r border-border pr-3">
      <ul className="space-y-0.5">{primary.map(entry)}</ul>

      <div className="space-y-0.5 border-t border-border pt-3">
        <p className="px-2 pb-1 text-xs uppercase tracking-widest text-muted-foreground">Views</p>
        <ul className="space-y-0.5">{rest.map(entry)}</ul>
      </div>

      <ul className="space-y-0.5 border-t border-border pt-3 text-muted-foreground">
        <li>
          <span className="flex cursor-not-allowed items-center gap-2 px-2 py-1.5 text-sm opacity-50">
            <FolderKanban className="h-4 w-4" /> Projects
          </span>
        </li>
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

      {/* PDL-022: hidden entirely for a solo user. */}
      {!isSolo && (
        <ul className="space-y-0.5 border-t border-border pt-3 text-muted-foreground">
          <li>
            <span className="flex cursor-not-allowed items-center gap-2 px-2 py-1.5 text-sm opacity-50">
              <Users className="h-4 w-4" /> People &amp; Roles
            </span>
          </li>
        </ul>
      )}
    </nav>
  )
}
