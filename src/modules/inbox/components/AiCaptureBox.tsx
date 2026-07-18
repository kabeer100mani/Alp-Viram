import { useState, type FormEvent } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { classifyCapture } from '@/lib/ai/classify'
import type { Classification } from '@/lib/ai/classification'
import { useCreateItem } from '@/modules/items/hooks/use-items'
import { useCreateListInGeneral, useListsForRanking } from '@/modules/lists/hooks/use-lists'
import { useMembers } from '@/modules/people/hooks/use-people'
import { rankLists } from '@/modules/inbox/rank-lists'
import { createAiCapture } from '@/modules/inbox/data/ai-captures-repository'
import { PriorityFlag } from '@/components/app/PriorityFlag'
import { DateCell } from '@/modules/items/components/DateCell'
import type { ItemType } from '@/modules/items/types'

type Stage = 'idle' | 'classifying' | 'proposal'

/** Today at local midnight (= "no specific time", PDL-043) as a UTC instant. */
function todayMidnightIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

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
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Assignee is mandatory and never blank (PDL-046): it defaults to the creator and
  // can be reassigned from the confirmation card. The picker only appears in a team
  // org (someone else to assign to); a solo user silently gets themselves (PDL-022).
  const [assigneeId, setAssigneeId] = useState(userId)
  // Due date on the card (PDL-047): defaults to today ("assumed") when the AI extracts
  // none, so it is never blank; editing it clears the assumed flag.
  const [chosenDueAt, setChosenDueAt] = useState<string | null>(null)
  const [dueAssumed, setDueAssumed] = useState(false)
  const create = useCreateItem(organizationId)
  const createList = useCreateListInGeneral(organizationId, userId)
  const { data: lists } = useListsForRanking(organizationId)
  const { data: members } = useMembers(organizationId)
  const activeMembers = members ?? []
  const assigneeName = activeMembers.find((m) => m.userId === assigneeId)?.displayName ?? 'You'

  // The tap-to-answer List follow-up (PDL-042): shown when the AI flags it's unsure
  // which list. The AI never guesses a list (PDL-032) — it flags the dimension; the
  // buttons are the org's REAL lists, keyword-RANKED against the capture (PDL-044).
  // Shown even with zero lists, so "+ Create new list" is reachable in exactly the
  // case it exists for (the previous `lists.length > 0` gate hid it there).
  const askList = proposal?.clarify === 'list'
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
      setAssigneeId(userId) // default assignee = creator (PDL-046)
      // Default the due date to today when the AI extracted none (PDL-047), flagged
      // "assumed"; a real extracted date is kept as-is (not assumed). Notes carry none.
      if (classification.type !== 'note' && !classification.due_at) {
        setChosenDueAt(todayMidnightIso())
        setDueAssumed(true)
      } else {
        setChosenDueAt(classification.due_at)
        setDueAssumed(false)
      }
      setCreatingList(false)
      setNewListName('')
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

  async function onCreateList() {
    const trimmed = newListName.trim()
    if (!trimmed) return
    try {
      const list = await createList.mutateAsync({ name: trimmed })
      // Select the new list so Confirm files the item into it. It lands under a
      // shared "General" project (PDL-042 / ruled 2026-07-18).
      setChosenListId(list.id)
      setCreatingList(false)
      setNewListName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That list could not be created.')
    }
  }

  async function onConfirm() {
    if (!proposal) return
    try {
      const item = await create.mutateAsync({
        title: proposal.title,
        type: proposal.type,
        body: proposal.body,
        createdBy: userId,
        // A note carries no due date; a task uses the chosen/assumed date (PDL-047).
        dueAt: proposal.type === 'note' ? null : chosenDueAt,
        dueAssumed: proposal.type === 'note' ? false : dueAssumed,
        remindAt: proposal.remind_at,
        isReminder: proposal.is_reminder,
        priority: proposal.priority,
        listId: chosenListId, // null = Inbox (the default; skipping the follow-up)
        assigneeUserId: assigneeId, // mandatory assignee, defaults to creator (PDL-046)
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
                {/* Make a list on the spot (ruled 2026-07-18): one field (the list
                    name); it lands under a shared "General" project, then Confirm
                    files the item there. */}
                {!creatingList && (
                  <button
                    type="button"
                    onClick={() => setCreatingList(true)}
                    className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    + Create new list
                  </button>
                )}
              </div>
              {creatingList && (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void onCreateList() }
                      if (e.key === 'Escape') { setCreatingList(false); setNewListName('') }
                    }}
                    placeholder="New list name…"
                    aria-label="New list name"
                    className="h-7 max-w-[14rem] text-xs"
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={() => void onCreateList()} disabled={!newListName.trim() || createList.isPending}>
                    Create &amp; use
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              AI proposal · confirm or edit
            </p>
            <div className="flex items-center gap-2">
              <Select value={proposal.type} onValueChange={(v) => setProposal({ ...proposal, type: v as ItemType })}>
                <SelectTrigger aria-label="Item type" className="h-8 w-auto gap-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label="Proposed title"
                value={proposal.title}
                onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
                className="flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Assignee (PDL-046): always shown, already filled to the creator — a
                  mandatory per-item field like Priority (PDL-022 does not apply). Always
                  clickable; the picker lists the org's members (solo → just you, so
                  reassignment only offers others once they exist). */}
              {proposal.type !== 'note' && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Assignee"
                    className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-0.5 pr-2 text-secondary-foreground outline-none hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar userId={assigneeId} name={assigneeName} size="xs" />
                    <span>{assigneeName}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {activeMembers.map((m) => (
                      <DropdownMenuItem key={m.userId} onSelect={() => setAssigneeId(m.userId)} className="gap-2">
                        <Avatar userId={m.userId} name={m.displayName} size="xs" />
                        {(m.displayName ?? 'Member') + (m.userId === userId ? ' (you)' : '')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Priority — editable flag, same control as the table (point 3). */}
              <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5">
                <PriorityFlag
                  value={proposal.priority}
                  canWrite
                  ariaLabel="Priority"
                  onChange={(p) => setProposal({ ...proposal, priority: p })}
                />
              </span>

              {/* Due date (PDL-047): always shown for a task; defaults to today
                  ("· assumed") when the AI extracted none, and is clickable to change.
                  Editing clears the assumed flag. */}
              {proposal.type !== 'note' && (
                <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5">
                  <DateCell
                    value={chosenDueAt}
                    label="Due date"
                    canWrite
                    assumed={dueAssumed}
                    placeholder="Set date"
                    onChange={(iso) => {
                      setChosenDueAt(iso)
                      setDueAssumed(false)
                    }}
                  />
                </span>
              )}

              {proposal.is_reminder && (
                <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">Reminder</span>
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
