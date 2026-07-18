import { useState, type FormEvent } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { classifyCapture } from '@/lib/ai/classify'
import type { Classification } from '@/lib/ai/classification'
import { useCreateItem } from '@/modules/items/hooks/use-items'
import { useListsForRanking } from '@/modules/lists/hooks/use-lists'
import { rankLists } from '@/modules/inbox/rank-lists'
import { createAiCapture } from '@/modules/inbox/data/ai-captures-repository'
import { formatDateTime, priorityLabel } from '@/modules/items/presentation'
import type { ItemType } from '@/modules/items/types'

type Stage = 'idle' | 'classifying' | 'proposal'

/**
 * The AI Inbox: capture in plain words → AI classifies → user confirms/edits
 * before anything is saved (AI proposes, never auto-executes — PDL-012). Asks a
 * clarifying question only when the AI flags one as genuinely needed (PDL-028).
 */
export function AiCaptureBox({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [proposal, setProposal] = useState<Classification | null>(null)
  const [chosenListId, setChosenListId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateItem(organizationId)
  const { data: lists } = useListsForRanking(organizationId)

  // The tap-to-answer List follow-up (PDL-042): shown only when the AI flags it's
  // unsure which list AND the org actually has lists. The AI never guesses a list
  // (PDL-032) — it flags the dimension; these buttons are the org's REAL lists,
  // keyword-RANKED against the capture using project names + context (PDL-044).
  const askList = Boolean(proposal?.clarify === 'list' && (lists?.length ?? 0) > 0)
  const ranked = askList ? rankLists(input, lists ?? []) : []
  // Pre-highlight the single best keyword match — a *suggestion* the user confirms.
  const topId = ranked[0]?.score > 0 ? ranked[0].id : null

  async function runClassify(text: string) {
    setStage('classifying')
    setError(null)
    try {
      const classification = await classifyCapture(text)
      setProposal(classification)
      setChosenListId(null)
      setStage('proposal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed')
      setStage('idle')
    }
  }

  function onCapture(event: FormEvent) {
    event.preventDefault()
    const trimmed = input.trim()
    if (trimmed) void runClassify(trimmed)
  }

  async function onConfirm() {
    if (!proposal) return
    try {
      const item = await create.mutateAsync({
        title: proposal.title,
        type: proposal.type,
        body: proposal.body,
        createdBy: userId,
        dueAt: proposal.due_at,
        remindAt: proposal.remind_at,
        isReminder: proposal.is_reminder,
        priority: proposal.priority,
        listId: chosenListId, // null = Inbox (the default; skipping the follow-up)
        source: 'inbox',
      })
      await createAiCapture({
        organizationId,
        userId,
        rawInput: input.trim(),
        parsed: proposal,
        provider: 'anthropic',
        confidence: proposal.confidence,
        requiredClarification: proposal.needs_clarification,
        resultingItemId: item.id,
      })
      setInput('')
      setProposal(null)
      setStage('idle')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the item')
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onCapture} className="flex gap-2">
        <Input
          placeholder="Capture in plain words…  (e.g. Remind me to review GST tomorrow)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={stage === 'classifying'}
        />
        <Button type="submit" disabled={stage === 'classifying' || !input.trim()}>
          <Sparkles className="h-4 w-4" /> {stage === 'classifying' ? 'Thinking…' : 'Capture'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {stage === 'proposal' && proposal && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
          {/* Tap-to-answer List follow-up (PDL-042): one tap files it, or skip to
              the Inbox. Never blocks — you can Confirm without answering. */}
          {askList && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Which list?</p>
              <div className="flex flex-wrap gap-1.5">
                {ranked.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setChosenListId((cur) => (cur === l.id ? null : l.id))}
                    aria-pressed={chosenListId === l.id}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      chosenListId === l.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : l.id === topId
                          ? 'border-primary/60 text-foreground' // keyword-suggested (PDL-044)
                          : 'border-input text-muted-foreground hover:border-input'
                    }`}
                  >
                    {l.name}
                    {l.id === topId && chosenListId !== l.id && (
                      <span className="ml-1 text-[10px] text-primary">· suggested</span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setChosenListId(null)}
                  aria-pressed={chosenListId === null}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    chosenListId === null
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input text-muted-foreground hover:border-input'
                  }`}
                >
                  Inbox for now
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              AI proposal · confirm or edit
            </p>
            <div className="flex items-center gap-2">
              <select
                value={proposal.type}
                onChange={(e) => setProposal({ ...proposal, type: e.target.value as ItemType })}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Item type"
              >
                <option value="task">Task</option>
                <option value="note">Note</option>
              </select>
              <Input
                value={proposal.title}
                onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {proposal.is_reminder && (
                <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">Reminder</span>
              )}
              {proposal.due_at && (
                <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                  Due {formatDateTime(proposal.due_at)}
                </span>
              )}
              {proposal.priority !== 'none' && (
                <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                  {priorityLabel(proposal.priority)}
                </span>
              )}
              {/* No confidence chip (TD-006). The value was 1.0 on 28/30 real
                  captures — INCLUDING the misclassification — so "confidence 100%"
                  told the user something untrue about a wrong answer. It is still
                  stored on `ai_captures` for future calibration; it is just no
                  longer presented as if it meant something. */}
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => void onConfirm()} disabled={create.isPending}>
                <Check className="h-4 w-4" /> Confirm
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setProposal(null)
                  setStage('idle')
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
