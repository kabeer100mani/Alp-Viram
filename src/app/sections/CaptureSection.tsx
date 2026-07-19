import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Mic, Paperclip, Sparkles } from 'lucide-react'
import { useSection } from '@/app/section-context'
import { classifyCapture } from '@/lib/ai/classify'
import type { Classification } from '@/lib/ai/classification'
import { useCreateItem, useItem } from '@/modules/items/hooks/use-items'
import { useAllLists, useCreateListInGeneral, useListsForRanking } from '@/modules/lists/hooks/use-lists'
import { createAiCapture } from '@/modules/inbox/data/ai-captures-repository'
import { useAiCaptures } from '@/modules/inbox/hooks/use-ai-captures'
import { CaptureClarify, type ClarifyAnswers } from '@/modules/inbox/components/CaptureClarify'
import { useWritableItemIds } from '@/modules/views/hooks/use-views'
import { TaskPanel } from '@/modules/items/components/TaskPanel'
import { Input } from '@/components/ui/input'

/**
 * Capture (PDL-051, M9 Gate B) — a dedicated capture surface: a chat box where you
 * drop a message, the AI classifies it, a paged clarifying pop-up confirms the
 * details, and a history thread shows past captures → the tasks they became. Voice
 * lands in Gate C; the "+" attachment is shown but deferred (TD-004).
 */
export function CaptureSection() {
  const { userId, org } = useSection()
  const qc = useQueryClient()
  const { data: history, isLoading } = useAiCaptures(org.id)
  const { data: listsForRank } = useListsForRanking(org.id)
  const create = useCreateItem(org.id)
  const createList = useCreateListInGeneral(org.id, userId)

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [elaborating, setElaborating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The capture currently being clarified. `nonce` bumps on each (re)classification so
  // the pop-up remounts fresh from the newest AI recommendation.
  const [active, setActive] = useState<{ raw: string; proposal: Classification; nonce: number } | null>(null)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const feedEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: 'end' })
  }, [history, active])

  async function runClassify(text: string, mode: 'new' | 'elaborate') {
    mode === 'elaborate' ? setElaborating(true) : setBusy(true)
    setError(null)
    try {
      const proposal = await classifyCapture(text)
      setActive({ raw: text, proposal, nonce: Date.now() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be understood. Try rephrasing.')
    } finally {
      setElaborating(false)
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || busy) return
    setInput('')
    void runClassify(trimmed, 'new')
  }

  // "Or reply directly" — fold the extra detail into the message and re-run the AI.
  function onElaborate(extra: string) {
    if (!active) return
    void runClassify(`${active.raw}\n\n${extra}`, 'elaborate')
  }

  async function onCreateListInline(name: string): Promise<string> {
    const list = await createList.mutateAsync({ name })
    return list.id
  }

  async function onCommit(answers: ClarifyAnswers) {
    if (!active) return
    setBusy(true)
    setError(null)
    const p = active.proposal
    try {
      const item = await create.mutateAsync({
        title: p.title,
        type: answers.type,
        body: p.body,
        createdBy: userId,
        dueAt: answers.type === 'note' ? null : answers.dueAt,
        dueAssumed: answers.type === 'note' ? false : answers.dueAssumed,
        remindAt: p.remind_at,
        isReminder: p.is_reminder,
        priority: p.priority,
        listId: answers.listId,
        assigneeUserId: userId, // mandatory assignee = creator (PDL-046)
        source: 'inbox',
      })
      await createAiCapture({
        organizationId: org.id,
        userId,
        rawInput: active.raw,
        parsed: { ...p, type: answers.type },
        provider: 'anthropic',
        confidence: p.confidence,
        requiredClarification: p.needs_clarification,
        resultingItemId: item.id,
      })
      await qc.invalidateQueries({ queryKey: ['ai-captures', org.id] })
      setActive(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <div className="space-y-1 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
        <p className="text-sm text-muted-foreground">
          Drop a message and SutraDhar turns it into a task. Your past captures live here.
        </p>
      </div>

      {/* History thread — oldest at top, newest above the composer. */}
      <div className="flex-1 space-y-4 py-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your captures…</p>
        ) : (history?.length ?? 0) === 0 ? (
          <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            No captures yet — drop your first message below.
          </div>
        ) : (
          history!.map((h) => (
            <div key={h.id} className="flex flex-col items-end gap-1.5">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-3.5 py-2 text-sm">
                {h.rawInput}
              </div>
              {h.resultingItemId && (
                <button
                  type="button"
                  onClick={() => setOpenItemId(h.resultingItemId)}
                  className="flex max-w-[85%] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary/40"
                >
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {h.itemType === 'note' ? 'Note' : 'Task'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{h.itemTitle ?? 'Open task'}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}
            </div>
          ))
        )}
        <div ref={feedEndRef} />
      </div>

      {error && <p className="pb-2 text-sm text-destructive">{error}</p>}

      {/* Composer OR the clarifying pop-up (its own reply box drives input while active). */}
      <div className="sticky bottom-0 bg-background pb-2 pt-2">
        {active ? (
          <CaptureClarify
            key={active.nonce}
            proposal={active.proposal}
            rawInput={active.raw}
            lists={listsForRank ?? []}
            busy={busy}
            elaborating={elaborating}
            onElaborate={onElaborate}
            onCreateList={onCreateListInline}
            onCommit={onCommit}
            onCancel={() => setActive(null)}
          />
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card px-2 py-1.5"
          >
            {/* Attachments — deferred (TD-004); shown so the composer reads complete. */}
            <button
              type="button"
              aria-label="Attach a file (coming soon)"
              title="Attachments coming soon"
              disabled
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…  (e.g. Remind me to review GST tomorrow)"
              aria-label="Capture a message"
              disabled={busy}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            {/* Voice — Gate C. */}
            <button
              type="button"
              aria-label="Record a voice note (coming soon)"
              title="Voice notes coming soon"
              disabled
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-50"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="submit"
              aria-label="Capture"
              disabled={busy || !input.trim()}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      {openItemId && (
        <CaptureTaskPanel itemId={openItemId} orgId={org.id} userId={userId} onClose={() => setOpenItemId(null)} />
      )}
    </div>
  )
}

/** Fetches one item and shows the standard TaskPanel — the history "open task" option. */
function CaptureTaskPanel({
  itemId,
  orgId,
  userId,
  onClose,
}: {
  itemId: string
  orgId: string
  userId: string
  onClose: () => void
}) {
  const { data: item, isLoading } = useItem(itemId)
  const { data: writable } = useWritableItemIds(item ? [item.id] : [])
  const { data: lists } = useAllLists(orgId)
  if (isLoading || !item) return null
  return (
    <TaskPanel
      item={item}
      canWrite={writable?.has(item.id) ?? false}
      organizationId={orgId}
      currentUserId={userId}
      lists={lists}
      onClose={onClose}
    />
  )
}
