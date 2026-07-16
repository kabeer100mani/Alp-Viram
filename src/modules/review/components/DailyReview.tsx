import { useMemo, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriageCard } from '@/modules/review/components/TriageCard'
import {
  useBacklogItems,
  useConfirmItems,
  useProjects,
  useRescheduleItems,
  useRoles,
  useRollover,
  useTriageQueue,
} from '@/modules/review/hooks/use-review'
import { startOfLocalDay } from '@/modules/review/data/review-repository'
import { useCompleteItem, useSnoozeItem } from '@/modules/items/hooks/use-items'
import { itemTypeLabel } from '@/modules/items/presentation'
import type { Item } from '@/modules/items/types'

/**
 * The Daily Review — the guided ritual that stops capture-first becoming a
 * dumping ground, and the ONLY way items leave the Inbox (PDL-016).
 *
 * Stage 1 Rollover → Stage 2 grouped triage → Stage 3 "Inbox clear".
 * Target: 5–10 minutes — the one frozen number in this milestone.
 *
 * Nothing here says "overdue". Unfinished work is offered neutral moves
 * (Today / Tomorrow / Backlog); the nudge counts "N to triage", never
 * "N overdue" (FR-12b, and Doc 4 rejects a shaming state).
 *
 * Not built (Good-to-Have, "only if cheap"): duplicate detection/merge, AI
 * auto-grouping beyond type, and drag-to-calendar timeboxing.
 */
export function DailyReview({
  organizationId,
  currentUserId,
  isSolo,
  onClose,
}: {
  organizationId: string
  currentUserId: string
  isSolo: boolean
  onClose: () => void
}) {
  const { data: rollover, isLoading: rolloverLoading } = useRollover(organizationId)
  const { data: queue, isLoading: queueLoading } = useTriageQueue(organizationId)
  const { data: projects } = useProjects(organizationId)
  // Roles are not even fetched for a solo user (PDL-022).
  const { data: roles } = useRoles(organizationId, !isSolo)

  const confirm = useConfirmItems()
  const backlog = useBacklogItems()
  const reschedule = useRescheduleItems()
  const complete = useCompleteItem()
  const snooze = useSnoozeItem()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)

  const busy =
    confirm.isPending || backlog.isPending || reschedule.isPending || complete.isPending || snooze.isPending

  // Group by type — the cheap, specified clustering. (Grouping by project or
  // duplicate is Good-to-Have and not built.)
  const groups = useMemo(() => {
    const by = new Map<string, Item[]>()
    for (const item of queue ?? []) {
      const key = itemTypeLabel(item)
      by.set(key, [...(by.get(key) ?? []), item])
    }
    return [...by.entries()]
  }, [queue])

  // RLS refuses silently and read is org-wide, so a user can see a colleague's
  // captured item and be refused when triaging it. Say so rather than let the
  // item quietly stay put.
  const report = (result: { refusedIds: string[] }, verb: string) => {
    setNotice(
      result.refusedIds.length
        ? `${result.refusedIds.length} item(s) could not be ${verb} — you do not have permission to change them.`
        : null,
    )
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const tomorrow9 = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  }

  const inboxCount = queue?.length ?? 0
  const rolloverCount = rollover?.length ?? 0
  const loading = rolloverLoading || queueLoading

  return (
    <section
      aria-label="Daily Review"
      className="space-y-6 rounded-lg border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Daily Review</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${inboxCount} to triage · about 5–10 minutes`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close Daily Review">
          <X className="h-4 w-4" /> Close
        </Button>
      </div>

      {notice && <p className="text-sm text-destructive">{notice}</p>}

      {/* ── Stage 1 — Rollover ─────────────────────────────────────────── */}
      {rolloverCount > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Yesterday: {rolloverCount} unfinished</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {(rollover ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-sm">{item.title}</span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Move ${item.title} to today`}
                    onClick={() =>
                      reschedule.mutate(
                        { ids: [item.id], dueAt: startOfLocalDay() },
                        { onSuccess: (r) => report(r, 'moved') },
                      )
                    }
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Move ${item.title} to tomorrow`}
                    onClick={() =>
                      reschedule.mutate(
                        { ids: [item.id], dueAt: tomorrow9() },
                        { onSuccess: (r) => report(r, 'moved') },
                      )
                    }
                  >
                    Tomorrow
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Move ${item.title} to backlog`}
                    onClick={() =>
                      backlog.mutate({ ids: [item.id] }, { onSuccess: (r) => report(r, 'moved') })
                    }
                  >
                    Backlog
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              reschedule.mutate(
                { ids: (rollover ?? []).map((i) => i.id), dueAt: startOfLocalDay() },
                { onSuccess: (r) => report(r, 'moved') },
              )
            }
          >
            Move all to Today
          </Button>
        </div>
      )}

      {/* ── Stage 2 — Triage the Inbox, grouped ────────────────────────── */}
      {inboxCount > 0 ? (
        <div className="space-y-4">
          {groups.map(([label, items]) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {label} · {items.length}
                </h3>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  aria-label={`Confirm all ${label}`}
                  onClick={() =>
                    confirm.mutate(
                      { ids: items.map((i) => i.id) },
                      { onSuccess: (r) => report(r, 'confirmed') },
                    )
                  }
                >
                  Confirm all
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {items.map((item) => (
                  <TriageCard
                    key={item.id}
                    item={item}
                    projects={projects ?? []}
                    roles={roles ?? []}
                    organizationId={organizationId}
                    currentUserId={currentUserId}
                    selected={selected.has(item.id)}
                    onToggleSelected={() => toggle(item.id)}
                    busy={busy}
                    onConfirm={() =>
                      confirm.mutate({ ids: [item.id] }, { onSuccess: (r) => report(r, 'confirmed') })
                    }
                    onSnooze={() => snooze.mutate({ id: item.id, until: tomorrow9() })}
                    onDone={() => complete.mutate({ id: item.id, type: item.type })}
                    onBacklog={() =>
                      backlog.mutate({ ids: [item.id] }, { onSuccess: (r) => report(r, 'moved') })
                    }
                  />
                ))}
              </ul>
            </div>
          ))}

          {selected.size > 0 && (
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  confirm.mutate({ ids: [...selected] }, { onSuccess: (r) => report(r, 'confirmed') })
                }
              >
                Confirm selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  backlog.mutate({ ids: [...selected] }, { onSuccess: (r) => report(r, 'moved') })
                }
              >
                Backlog selected
              </Button>
            </div>
          )}
        </div>
      ) : (
        // ── Stage 3 — Finish ──────────────────────────────────────────────
        !loading && (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5" /> Inbox clear.
          </p>
        )
      )}
    </section>
  )
}
