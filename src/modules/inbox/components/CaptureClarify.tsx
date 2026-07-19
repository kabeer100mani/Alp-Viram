import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowRight, Check, Loader2, Pencil, Send, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/modules/items/presentation'
import { rankLists } from '@/modules/inbox/rank-lists'
import type { Classification } from '@/lib/ai/classification'
import type { ListForRanking } from '@/modules/lists/data/lists-repository'
import type { ItemType } from '@/modules/items/types'

/** The answers the pop-up collects; the page turns these into an item. */
export interface ClarifyAnswers {
  type: ItemType
  listId: string | null // null = Inbox (no list)
  dueAt: string | null
  dueAssumed: boolean
}

type StepKey = 'type' | 'list' | 'due'
interface Option {
  id: string
  label: string
  hint?: string
}

/** Local-midnight of a day offset from today, as a UTC instant (PDL-043 convention). */
function dayIso(offsetDays: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}
function pickedIso(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

/**
 * The clarifying pop-up (M9 Gate B, PDL-051) — the Claude-Code-style paged question
 * card. ALWAYS asks a short set (Task walks Type → List → Due; a Note is just Type),
 * each pre-filled with the AI's pick tagged "Recommended" so Enter/tap accepts it.
 * Every question is skippable; "Skip for now" commits with the recommended defaults
 * and drops the item in the Inbox to finish later. "Or reply directly" re-runs the AI.
 *
 * Remounted (via `key`) on each new classification, so it always starts from the
 * latest AI recommendation.
 */
export function CaptureClarify({
  proposal,
  rawInput,
  lists,
  busy,
  elaborating,
  onElaborate,
  onCreateList,
  onCommit,
  onCancel,
}: {
  proposal: Classification
  rawInput: string
  lists: ListForRanking[]
  busy: boolean
  elaborating: boolean
  onElaborate: (extra: string) => void
  onCreateList: (name: string) => Promise<string>
  onCommit: (answers: ClarifyAnswers) => void
  onCancel: () => void
}) {
  const recType: ItemType = proposal.type === 'note' ? 'note' : 'task'
  const ranked = useMemo(() => rankLists(rawInput, lists), [rawInput, lists])
  const topListId = ranked[0]?.score > 0 ? ranked[0].id : null
  const aiDue = recType === 'note' ? null : proposal.due_at

  // Working answers, initialised to the AI's recommendation for every dimension.
  const [type, setType] = useState<ItemType>(recType)
  const [listId, setListId] = useState<string | null>(topListId)
  const [due, setDue] = useState<{ at: string | null; assumed: boolean }>(
    recType === 'note'
      ? { at: null, assumed: false }
      : aiDue
        ? { at: aiDue, assumed: false }
        : { at: dayIso(0), assumed: true },
  )

  const [step, setStep] = useState(0)
  const [highlight, setHighlight] = useState(0)
  const [creatingList, setCreatingList] = useState(false)
  const [listDraft, setListDraft] = useState('')
  const [pickingDate, setPickingDate] = useState(false)
  const [reply, setReply] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  // A Task asks 3 questions, a Note just 1 (list/due don't apply to notes).
  const steps: StepKey[] = type === 'task' ? ['type', 'list', 'due'] : ['type']
  const clampedStep = Math.min(step, steps.length - 1)
  const key = steps[clampedStep]

  // Build the option list + which one is Recommended + what's currently chosen.
  const { options, recommendedId, chosenId } = ((): {
    options: Option[]
    recommendedId: string
    chosenId: string
  } => {
    if (key === 'type') {
      return {
        options: [
          { id: 'task', label: 'Task' },
          { id: 'note', label: 'Note' },
        ],
        recommendedId: recType,
        chosenId: type,
      }
    }
    if (key === 'list') {
      const opts: Option[] = ranked.map((l) => ({ id: l.id, label: l.name }))
      opts.push({ id: '__inbox', label: 'Inbox for now', hint: 'No list' })
      opts.push({ id: '__create', label: 'Create a new list…' })
      return { options: opts, recommendedId: topListId ?? '__inbox', chosenId: listId ?? '__inbox' }
    }
    // due
    const opts: Option[] = []
    if (aiDue) opts.push({ id: '__ai', label: formatDate(aiDue), hint: 'From your message' })
    opts.push({ id: 'today', label: 'Today' })
    opts.push({ id: 'tomorrow', label: 'Tomorrow' })
    opts.push({ id: 'nextweek', label: 'Next week' })
    opts.push({ id: 'none', label: 'No due date' })
    opts.push({ id: '__pick', label: 'Pick a date…' })
    const recommendedId = aiDue ? '__ai' : 'today'
    let chosenId = 'today'
    if (!due.at) chosenId = 'none'
    else if (aiDue && due.at === aiDue) chosenId = '__ai'
    else if (due.at === dayIso(0)) chosenId = 'today'
    else if (due.at === dayIso(1)) chosenId = 'tomorrow'
    else if (due.at === dayIso(7)) chosenId = 'nextweek'
    else chosenId = '__pick'
    return { options: opts, recommendedId, chosenId }
  })()

  // On entering a step, highlight the Recommended option (Enter accepts it), and
  // focus the card so keyboard nav works immediately.
  useEffect(() => {
    const idx = options.findIndex((o) => o.id === recommendedId)
    setHighlight(idx < 0 ? 0 : idx)
    setCreatingList(false)
    setPickingDate(false)
    cardRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedStep])

  function commit(answers?: Partial<ClarifyAnswers>) {
    onCommit({
      type,
      listId: type === 'task' ? listId : null,
      dueAt: type === 'task' ? due.at : null,
      dueAssumed: type === 'task' ? due.assumed : false,
      ...answers,
    })
  }

  function advance() {
    if (clampedStep >= steps.length - 1) commit()
    else setStep(clampedStep + 1)
  }

  function choose(id: string) {
    if (key === 'type') {
      const t = id as ItemType
      setType(t)
      // A Note has no list/due — it's the whole set, so committing is the next step.
      if (t === 'note') commit({ type: 'note', listId: null, dueAt: null, dueAssumed: false })
      else setStep(1)
      return
    }
    if (key === 'list') {
      if (id === '__create') {
        setCreatingList(true)
        return
      }
      setListId(id === '__inbox' ? null : id)
      advance()
      return
    }
    // due
    if (id === '__pick') {
      setPickingDate(true)
      return
    }
    if (id === '__ai') setDue({ at: aiDue, assumed: false })
    else if (id === 'today') setDue({ at: dayIso(0), assumed: false })
    else if (id === 'tomorrow') setDue({ at: dayIso(1), assumed: false })
    else if (id === 'nextweek') setDue({ at: dayIso(7), assumed: false })
    else if (id === 'none') setDue({ at: null, assumed: false })
    advance()
  }

  async function createListThenAdvance() {
    const name = listDraft.trim()
    if (!name) return
    const id = await onCreateList(name)
    setListId(id)
    setCreatingList(false)
    setListDraft('')
    advance()
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (creatingList || pickingDate) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[highlight].id)
    } else if (/^[1-9]$/.test(e.key)) {
      const i = Number(e.key) - 1
      if (i < options.length) {
        e.preventDefault()
        choose(options[i].id)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  const prompt = key === 'type' ? 'Is this a task or a note?' : key === 'list' ? 'Which list should it go in?' : 'When is it due?'

  return (
    <div className="space-y-2">
      <div
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="overflow-hidden rounded-xl border border-border bg-card outline-none"
      >
        {/* Header: prompt + pager + close */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-medium">{prompt}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              aria-label="Previous question"
              disabled={clampedStep === 0}
              onClick={() => setStep(Math.max(0, clampedStep - 1))}
              className="disabled:opacity-30"
            >
              ‹
            </button>
            <span className="tabular-nums">
              {clampedStep + 1} of {steps.length}
            </span>
            <button
              type="button"
              aria-label="Next question"
              onClick={advance}
              className="disabled:opacity-30"
            >
              ›
            </button>
            <button type="button" aria-label="Cancel" onClick={onCancel} className="ml-1 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Options */}
        <div>
          {options.map((o, i) => {
            const isRec = o.id === recommendedId
            const isChosen = o.id === chosenId
            const isHigh = i === highlight
            return (
              <button
                key={o.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(o.id)}
                className={`flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-sm ${
                  isHigh ? 'bg-[--bg-hover]' : ''
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-semibold ${
                    isHigh ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {o.id === '__create' || o.id === '__pick' ? <Pencil className="h-3 w-3" /> : i + 1}
                </span>
                <span className="flex-1 truncate">
                  {o.label}
                  {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {isRec && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Recommended
                  </span>
                )}
                {isChosen && <Check className="h-4 w-4 shrink-0 text-primary" />}
                {isHigh && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            )
          })}

          {/* Inline "create a list" entry */}
          {creatingList && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
              <Input
                autoFocus
                value={listDraft}
                onChange={(e) => setListDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createListThenAdvance()
                  }
                  if (e.key === 'Escape') {
                    setCreatingList(false)
                    setListDraft('')
                  }
                }}
                placeholder="New list name…"
                aria-label="New list name"
                className="h-8 text-sm"
              />
              <button
                type="button"
                onClick={() => void createListThenAdvance()}
                disabled={!listDraft.trim()}
                className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Create &amp; use
              </button>
            </div>
          )}

          {/* Inline date picker (native input kept per project ruling) */}
          {pickingDate && (
            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
              <input
                autoFocus
                type="date"
                aria-label="Pick a due date"
                onChange={(e) => {
                  if (e.target.value) {
                    setDue({ at: pickedIso(e.target.value), assumed: false })
                    setPickingDate(false)
                    advance()
                  }
                }}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setPickingDate(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Footer actions: per-question Skip + Skip-for-now (answer later) */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs">
          <button type="button" onClick={advance} className="text-muted-foreground hover:text-foreground">
            Skip this question
          </button>
          <button
            type="button"
            onClick={() => commit()}
            disabled={busy}
            className="font-medium text-muted-foreground hover:text-foreground"
          >
            {busy ? 'Saving…' : 'Skip for now — answer later'}
          </button>
        </div>
      </div>

      {/* Or reply directly — re-runs the AI with the added context (elaborate). */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && reply.trim()) {
              e.preventDefault()
              onElaborate(reply.trim())
              setReply('')
            }
          }}
          placeholder="Or reply directly to add detail…"
          aria-label="Reply to add detail"
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          disabled={elaborating}
        />
        <button
          type="button"
          aria-label="Send reply"
          onClick={() => {
            if (reply.trim()) {
              onElaborate(reply.trim())
              setReply('')
            }
          }}
          disabled={elaborating || !reply.trim()}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {elaborating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">↑↓ to navigate · Enter to select · or reply below</p>
    </div>
  )
}
