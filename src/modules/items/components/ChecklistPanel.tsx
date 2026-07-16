import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useAddChecklistItem,
  useChecklist,
  useRemoveChecklistItem,
  useSetChecklistDone,
  useSetDefinitionOfDone,
} from '@/modules/items/hooks/use-checklist'
import type { Item } from '@/modules/items/types'

/**
 * Checklist + Definition of Done for an item (PDL-033).
 *
 * The DoD is a **note, not a gate**: it does not block completion. That was the
 * explicit decision — tightening it later is additive, so nothing here pretends
 * to enforce it.
 *
 * Collapsed by default: most items have neither, and an always-open panel would
 * cost a query per card for nothing.
 */
export function ChecklistPanel({
  item,
  organizationId,
  currentUserId,
  canWrite,
  onError,
  embedded = false,
}: {
  item: Item
  organizationId: string
  currentUserId: string
  canWrite: boolean
  onError: (m: string) => void
  /** When the parent is already an expanded surface (a table row), show the
   *  Checklist AND Definition of Done directly — no second collapse burying the DoD. */
  embedded?: boolean
}) {
  const [open, setOpen] = useState(false)
  const shown = embedded || open
  const { data: checklist } = useChecklist(item.id, shown)
  const add = useAddChecklistItem(organizationId, item.id, currentUserId)
  const setDone = useSetChecklistDone(item.id)
  const remove = useRemoveChecklistItem(item.id)
  const saveDod = useSetDefinitionOfDone(item.id)

  const [text, setText] = useState('')
  const [dod, setDod] = useState(item.definition_of_done ?? '')
  useEffect(() => setDod(item.definition_of_done ?? ''), [item.definition_of_done])

  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const done = (checklist ?? []).filter((c) => c.is_done).length
  const total = checklist?.length ?? 0

  // Summary works before the panel is opened (and before its query runs).
  const hasDod = Boolean(item.definition_of_done)
  const summary = total > 0 ? `Checklist ${done}/${total}` : hasDod ? 'Definition of Done' : 'Checklist'

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    add.mutate({ text: t, position: total }, { onSuccess: () => setText(''), onError: fail })
  }

  return (
    <div className="text-xs">
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Checklist and definition of done for ${item.title}`}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span>{summary}</span>
          {hasDod && total > 0 && <span className="text-muted-foreground">· DoD set</span>}
        </button>
      )}

      {shown && (
        <div className={embedded ? 'space-y-3' : 'mt-2 space-y-3 rounded-md border border-border bg-background p-3'}>
          {/* Checklist */}
          <div className="space-y-1">
            <p className="font-medium">Checklist</p>
            {total === 0 && <p className="text-muted-foreground">No steps yet.</p>}
            <ul className="space-y-1">
              {(checklist ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.is_done}
                    disabled={!canWrite}
                    aria-label={c.text}
                    onChange={(e) => setDone.mutate({ id: c.id, isDone: e.target.checked }, { onError: fail })}
                  />
                  <span className={c.is_done ? 'text-muted-foreground line-through' : ''}>{c.text}</span>
                  {canWrite && (
                    <button
                      type="button"
                      aria-label={`Remove step ${c.text}`}
                      onClick={() => remove.mutate({ id: c.id }, { onError: fail })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canWrite && (
              <form onSubmit={onAdd} className="flex items-center gap-2 pt-1">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add a step…"
                  aria-label={`Add a checklist step to ${item.title}`}
                  className="h-7 max-w-xs text-xs"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={!text.trim() || add.isPending}>
                  Add
                </Button>
              </form>
            )}
          </div>

          {/* Definition of Done — a note, not a gate. */}
          <div className="space-y-1 border-t border-border pt-2">
            <p className="font-medium">Definition of Done</p>
            {canWrite ? (
              <div className="space-y-1">
                <textarea
                  value={dod}
                  onChange={(e) => setDod(e.target.value)}
                  onBlur={() => {
                    if ((item.definition_of_done ?? '') !== dod) {
                      saveDod.mutate({ text: dod }, { onError: fail })
                    }
                  }}
                  placeholder="What does done look like?"
                  aria-label={`Definition of done for ${item.title}`}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                />
                <p className="text-muted-foreground">
                  A note for whoever picks this up — it doesn’t block completing the item.
                </p>
              </div>
            ) : (
              <p className={item.definition_of_done ? '' : 'text-muted-foreground'}>
                {item.definition_of_done ?? 'Not set.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
