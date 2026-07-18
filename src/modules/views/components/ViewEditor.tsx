import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateView, useDeleteView, useRenameView, useUpdateViewFilter } from '@/modules/views/hooks/use-views'
import { useTags } from '@/modules/tags/hooks/use-tags'
import { itemStateLabel } from '@/modules/items/presentation'
import { itemStates, itemTypes, dueWindows, type ViewFilter } from '@/modules/views/view-filter'
import type { ResolvedView } from '@/modules/views/data/views-repository'

// Radix Select forbids an empty-string item value; "Any"/"Newest" defaults use this.
const NONE = '__none__'

/**
 * Create or edit a custom saved view (Doc 4 Must Have). A small form over the
 * existing `viewFilterSchema` — it adds **no** new filter dimension; the schema is
 * the single source of truth (TDL-010), and the repository re-validates before
 * storing, so this form cannot save a filter the reader would later reject.
 *
 * Custom views are owner-private (M6 D4) and system views are never editable here —
 * the caller only opens this for a new view or a non-system one.
 */
export function ViewEditor({
  organizationId,
  ownerId,
  view,
  onClose,
}: {
  organizationId: string
  ownerId: string
  /** Editing an existing custom view, or undefined to create one. */
  view?: ResolvedView
  onClose: () => void
}) {
  const isEdit = Boolean(view)
  const [name, setName] = useState(view?.name ?? '')
  const [filter, setFilter] = useState<ViewFilter>(view?.filter ?? {})
  const [error, setError] = useState<string | null>(null)

  const { data: tags } = useTags(organizationId)
  const create = useCreateView(organizationId, ownerId)
  const rename = useRenameView(organizationId)
  const updateFilter = useUpdateViewFilter(organizationId)
  const del = useDeleteView(organizationId)
  const busy = create.isPending || rename.isPending || updateFilter.isPending || del.isPending

  const patch = (p: Partial<ViewFilter>) => setFilter((f) => ({ ...f, ...p }))
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'That could not be saved.')

  // Toggle a value inside one of the array filters, dropping the key when empty
  // (the schema forbids empty arrays — nonempty — so absent means "all").
  function toggleIn<T extends string>(key: 'states' | 'types' | 'tags', value: T, current: T[] | undefined) {
    const set = new Set(current ?? [])
    if (set.has(value)) set.delete(value)
    else set.add(value)
    const next = [...set]
    patch({ [key]: next.length ? next : undefined } as Partial<ViewFilter>)
  }

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the view a name.')
      return
    }
    if (isEdit && view) {
      // Name and filter are two writes; do the filter first, then the name.
      updateFilter.mutate(
        { id: view.id, filter },
        {
          onError: fail,
          onSuccess: () =>
            rename.mutate({ id: view.id, name: trimmed }, { onError: fail, onSuccess: onClose }),
        },
      )
    } else {
      create.mutate({ name: trimmed, filter }, { onError: fail, onSuccess: onClose })
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2 py-0.5 text-xs ${
      active ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:border-input'
    }`

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-foreground/10" />
      <div
        role="dialog"
        aria-label={isEdit ? `Edit view ${view?.name}` : 'New view'}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-border bg-background p-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{isEdit ? 'Edit view' : 'New view'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="View name" placeholder="e.g. Waiting on Client" className="h-8" />
        </div>

        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">Status</legend>
          <div className="flex flex-wrap gap-1">
            {itemStates.map((s) => (
              <button key={s} type="button" onClick={() => toggleIn('states', s, filter.states)} className={chip(filter.states?.includes(s) ?? false)}>
                {itemStateLabel(s)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">Type</legend>
          <div className="flex flex-wrap gap-1">
            {itemTypes.map((t) => (
              <button key={t} type="button" onClick={() => toggleIn('types', t, filter.types)} className={chip(filter.types?.includes(t) ?? false)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>

        {(tags?.length ?? 0) > 0 && (
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Tags</legend>
            <div className="flex flex-wrap gap-1">
              {tags?.map((tag) => (
                <button key={tag.id} type="button" onClick={() => toggleIn('tags', tag.id, filter.tags)} className={chip(filter.tags?.includes(tag.id) ?? false)}>
                  {tag.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Due</label>
            <Select
              value={filter.due ?? NONE}
              onValueChange={(v) => patch({ due: (v === NONE ? undefined : v) as ViewFilter['due'] })}
            >
              <SelectTrigger aria-label="Due window" className="h-8 w-full gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any</SelectItem>
                {dueWindows.filter((d) => d !== 'any').map((d) => (
                  <SelectItem key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sort</label>
            <Select
              value={filter.sort ?? NONE}
              onValueChange={(v) => patch({ sort: (v === NONE ? undefined : v) as ViewFilter['sort'] })}
            >
              <SelectTrigger aria-label="Sort" className="h-8 w-full gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Newest</SelectItem>
                <SelectItem value="due_asc">By date</SelectItem>
                <SelectItem value="updated_desc">Recently updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={filter.waiting ?? false}
            onCheckedChange={(c) => patch({ waiting: c === true || undefined })}
            aria-label="Only items waiting on someone else"
          />
          Only items waiting on someone else
        </label>

        <div className="flex items-center justify-between pt-1">
          {isEdit && view ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => del.mutate({ id: view.id }, { onError: fail, onSuccess: onClose })}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="button" size="sm" onClick={save} disabled={busy || !name.trim()}>Save</Button>
          </div>
        </div>
      </div>
    </>
  )
}
