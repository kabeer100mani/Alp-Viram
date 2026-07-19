import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSection } from '@/app/section-context'
import { SECTIONS } from '@/components/layout/sections'
import { useViewItems, useViews } from '@/modules/views/hooks/use-views'
import { useWakeDueSnoozes } from '@/modules/items/hooks/use-items'
import { DailyReview } from '@/modules/review/components/DailyReview'

/**
 * The Overview / Home landing (PDL-050) — the neutral default route ("/"), NOT one
 * of the five section tabs. A greeting, at-a-glance counts, a Daily Review entry,
 * and jump-to links into the sections. Reached again by tapping the logo.
 */
export function HomeSection() {
  const { userId, org, isSolo, displayName } = useSection()
  const [reviewOpen, setReviewOpen] = useState(false)
  useWakeDueSnoozes(org.id, reviewOpen)

  const { data: views } = useViews(org.id)
  const filterFor = (name: string) => views?.find((v) => v.name === name)?.filter
  const { data: inbox } = useViewItems(org.id, filterFor('Inbox'))
  const { data: today } = useViewItems(org.id, filterFor('Today'))
  const { data: waiting } = useViewItems(org.id, filterFor('Waiting'))

  const stats: { label: string; count: number | undefined; to: string }[] = [
    { label: 'To triage', count: inbox?.length, to: '/capture' },
    { label: 'Due today', count: today?.length, to: '/capture' },
    { label: 'Waiting', count: waiting?.length, to: '/capture' },
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {displayName}</h1>
        <p className="text-sm text-muted-foreground">Your workspace at a glance.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-[--bg-hover]"
          >
            <div className="text-2xl font-semibold tabular-nums">{s.count ?? '—'}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <Button variant={reviewOpen ? 'secondary' : 'outline'} onClick={() => setReviewOpen((o) => !o)}>
          <ListChecks className="h-4 w-4" /> Daily Review
          {inbox?.length ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{inbox.length}</span>
          ) : null}
        </Button>
        {reviewOpen && (
          <DailyReview organizationId={org.id} currentUserId={userId} isSolo={isSolo} onClose={() => setReviewOpen(false)} />
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Jump to</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECTIONS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-[--bg-hover]"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
