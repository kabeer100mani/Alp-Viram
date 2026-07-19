import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSection } from '@/app/section-context'
import { useOrgFieldPrefs, useUpdateFieldPrefs } from '@/modules/fields/use-field-prefs'
import {
  PRIORITY_DEFAULTS,
  PRIORITY_KEYS,
  STATUS_DEFAULTS,
  STATUS_KEYS,
  resolvePriority,
  resolveStatus,
  type FieldPrefs,
} from '@/modules/fields/field-prefs'
import type { ItemState } from '@/modules/items/types'
import type { Priority } from '@/modules/items/presentation'

/**
 * Statuses section (PDL-049 / M8 Gate C): customize the LABEL and COLOR of each status
 * and priority, per org. Admin-only (RLS `orgs_update` gates the write; the UI mirrors
 * it). The enum values are frozen — relabel/recolour only; new/removed statuses are out.
 */
export function StatusesSection() {
  const { org, isAdmin } = useSection()
  const { data: saved } = useOrgFieldPrefs(org.id)
  const update = useUpdateFieldPrefs(org.id)
  const [draft, setDraft] = useState<FieldPrefs>({})
  const [error, setError] = useState<string | null>(null)

  // Seed the editable draft from the server, and re-seed if it changes underneath us.
  useEffect(() => setDraft(saved ?? {}), [saved])

  const save = (next: FieldPrefs) => {
    setDraft(next)
    update.mutate(next, { onError: (e) => setError(e instanceof Error ? e.message : 'Could not save.') })
  }

  const setStatus = (s: ItemState, patch: { label?: string; color?: string }) =>
    ({ ...draft, status: { ...draft.status, [s]: { ...draft.status?.[s], ...patch } } })
  const setPriority = (p: Priority, patch: { label?: string; color?: string }) =>
    ({ ...draft, priority: { ...draft.priority, [p]: { ...draft.priority?.[p], ...patch } } })

  const resetStatus = (s: ItemState) => {
    const status = { ...draft.status }
    delete status[s]
    save({ ...draft, status })
  }
  const resetPriority = (p: Priority) => {
    const priority = { ...draft.priority }
    delete priority[p]
    save({ ...draft, priority })
  }

  const disabled = !isAdmin

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Statuses</h1>
        <p className="text-sm text-muted-foreground">
          Give your statuses and priorities your own names and colors. Everyone in the workspace sees
          them. {disabled && 'Only an admin can change these.'}
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Statuses</h2>
        {STATUS_KEYS.map((s) => {
          const { label, color, solid } = resolveStatus(s, draft)
          const overridden = Boolean(draft.status?.[s]?.label || draft.status?.[s]?.color)
          return (
            <div key={s} className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex h-[22px] w-32 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold"
                style={solid ? { backgroundColor: color, color: '#fff' } : { backgroundColor: 'var(--bg-surface)', color }}
              >
                {label}
              </span>
              <Input
                aria-label={`Label for ${STATUS_DEFAULTS[s].label}`}
                className="h-8 w-40 text-sm"
                placeholder={STATUS_DEFAULTS[s].label}
                value={draft.status?.[s]?.label ?? ''}
                disabled={disabled}
                onChange={(e) => setDraft(setStatus(s, { label: e.target.value }))}
                onBlur={() => save(draft)}
              />
              <input
                type="color"
                aria-label={`Color for ${STATUS_DEFAULTS[s].label}`}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent disabled:cursor-not-allowed"
                value={color}
                disabled={disabled}
                onChange={(e) => save(setStatus(s, { color: e.target.value }))}
              />
              {overridden && !disabled && (
                <Button variant="ghost" size="sm" onClick={() => resetStatus(s)}>
                  Reset
                </Button>
              )}
            </div>
          )
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Priorities</h2>
        {PRIORITY_KEYS.map((p) => {
          const { label, color } = resolvePriority(p, draft)
          const overridden = Boolean(draft.priority?.[p]?.label || draft.priority?.[p]?.color)
          return (
            <div key={p} className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-32 shrink-0 items-center gap-1 text-[13px]" style={{ color }}>
                <Flag className="h-3.5 w-3.5 shrink-0" fill={p === 'none' ? 'none' : 'currentColor'} />
                {label}
              </span>
              <Input
                aria-label={`Label for ${PRIORITY_DEFAULTS[p].label} priority`}
                className="h-8 w-40 text-sm"
                placeholder={PRIORITY_DEFAULTS[p].label}
                value={draft.priority?.[p]?.label ?? ''}
                disabled={disabled}
                onChange={(e) => setDraft(setPriority(p, { label: e.target.value }))}
                onBlur={() => save(draft)}
              />
              <input
                type="color"
                aria-label={`Color for ${PRIORITY_DEFAULTS[p].label} priority`}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent disabled:cursor-not-allowed"
                value={color}
                disabled={disabled}
                onChange={(e) => save(setPriority(p, { color: e.target.value }))}
              />
              {overridden && !disabled && (
                <Button variant="ghost" size="sm" onClick={() => resetPriority(p)}>
                  Reset
                </Button>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
