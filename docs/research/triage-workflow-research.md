# Daily-Triage Workflow — Research & Recommendation

> Research input for the Product Freeze documents (feeds Docs 3, 4, 5 and the AI
> Behaviour spec). "Verified" = source-stated (cited); "Inference" = design
> synthesis. Sourced via web research.

## What the best systems do (verified)

**GTD — reliability comes from a forced decision step.** Capture → Clarify →
Organize → Reflect → Engage. The pivotal move is *Clarify*: every captured item
becomes a concrete decision — actionable? next action? the 2-minute rule (do it
now if <2 min). The weekly *Reflect/Review* is the maintenance ritual that keeps
the system trustworthy. *Lesson:* capture is worthless unless a scheduled ritual
forces clarification; the Inbox is a staging ground, never a home.
[gtd.be](https://www.gtd.be/en/what-is-gtd/the-5-steps-of-gtd) ·
[todoist](https://www.todoist.com/productivity-methods/getting-things-done)

**Things 3 — separate "captured" from "committed."** Inbox = "a temporary staging
ground for unprocessed thoughts"; you review it and turn each into a real to-do
with a list + date. Committed work lives in Today (+ a quiet "This Evening"),
while Anytime/Upcoming/Someday hold the rest; Someday is reviewed every couple of
months. [culturedcode](https://culturedcode.com/things/support/articles/4001304/)

**Todoist — easy capture alone breeds an overdue graveyard.** Trivial capture +
cheap dates = tasks "snowball into an avalanche of overdue tasks." Remedies are
*rebalancing* tools: bulk Reschedule, multi-select, drag-to-tomorrow. *Lesson:*
design the escape valve before the pile forms.
[todoist](https://www.todoist.com/inspiration/how-to-use-todoist-effectively)

**Sunsama & Akiflow — daily ritual + guilt-free rollover.** Sunsama: 10–15 min
guided morning planning (review, pick priorities, estimate, timebox to calendar)
+ ~5 min evening shutdown. Unfinished work is *deferred*, not left as "overdue."
Akiflow optimizes the same loop for speed. *Lesson:* a daily ritual + guilt-free
rollover replaces shameful "overdue" with a neutral "moved."
[sunsama](https://help.sunsama.com/docs/daily-planning)

**Linear Triage — dedicated queue, AI suggestions, snooze.** A special inbox
reviewed before work enters the workflow. Triage Intelligence *suggests* team /
project / assignee / labels from history; can be set to auto-apply high-confidence
fields. Per-item actions are one keystroke: accept / duplicate / decline / snooze.
Closest existing model to our target flow. [linear](https://linear.app/docs/triage)
· [triage-intelligence](https://linear.app/docs/triage-intelligence)

**Superhuman — "today, another day, or done."** Three-way triage: today / snooze /
archive(done). "Done" archives (not deletes) and returns on reply. Split Inboxes
batch similar items. *Lesson:* a small fixed set of exits + clear "done" + batch
processing make an inbox drainable.
[superhuman](https://blog.superhuman.com/inbox-zero-in-7-steps/)

## Transferable AI-triage patterns
Batch classification at capture; suggested type/project/role/labels from history;
proposed due dates; duplicate detection; auto-grouping of similar items;
selective auto-apply (high-confidence applied, low-confidence surfaced for one-tap
confirm). Principle: **AI proposes, human confirms in one keystroke, confidence
gates how much is pre-applied.**

## Recommendation — the Alp-Viram daily-triage workflow

Three surfaces — **Inbox** (capture + triage), **Plan** (Today/Upcoming),
**Someday/Backlog** — with the **Daily Review** as the single ritual moving items
Inbox → Plan.

1. **Capture** (frictionless, zero decisions). One universal quick-add (text →
   later voice, forward-to-inbox). Items land raw. No required fields.
2. **AI Classification** (immediate, silent). Attaches *suggested* metadata: type,
   project, role, priority, proposed due date, duplicate/related flags — each with
   a confidence score. High-confidence pre-filled; low-confidence flagged. Clusters
   similar items.
3. **Daily Review** (the ritual). A once-a-day guided pass — the *only* way items
   leave the Inbox.
4. **User Confirmation** (one tap per item/group). Accept, override a field,
   snooze, or mark done/duplicate.
5. **Organization.** On confirm, the item leaves the Inbox into its project/role
   with its date — now "committed," not "captured."
6. **Execution.** The Plan surface (Today + a This-Evening-style section) shows
   only committed, dated work, timeboxed against the calendar.

### The Daily Review ritual (what the user sees)
A full-screen card-stack launched by a daily nudge:
1. **Rollover.** "Yesterday: 3 unfinished." Each offered *today / a day / backlog*
   as neutral moves, never "overdue."
2. **Triage the Inbox, grouped.** AI presents clusters; each card shows the item +
   AI chips `Type ▸ Project ▸ Role ▸ Due`.
3. **One-tap confirm.** Big **Confirm** accepts all chips; tap a chip to change one
   field; secondary: **Snooze**, **Done** (2-min rule), **Duplicate**, **Backlog**.
   Whole groups confirmable at once.
4. **Timebox.** Confirmed "today" items dragged onto the calendar (or AI auto-slots).
5. **Finish.** Inbox → 0 for the day; "Inbox clear."
Keep it 5–10 minutes. Daily goal: **Inbox → 0**.

### Anti-dumping-ground mechanisms (hard requirement)
- **Inbox age limit** — items un-triaged for N days (e.g. 3) auto-escalate (pinned
  "aging" badge, or auto-moved to Backlog with a note). Nothing silently rots.
- **"Triage N items" nudge**, not "N overdue" — frames it as clearing a queue.
- **No raw "overdue" state** — unfinished committed items roll over into the next
  Daily Review as a re-decision (guilt-free).
- **Snooze/defer as first-class exits** — leave the Inbox without scheduling;
  return at a time or on activity.
- **"Organize later" that resolves** — no permanent "later" except Someday, which
  is itself reviewed on a cadence.
- **Batch confirm + auto-grouping** keep the review fast so it's never skipped.

### Metrics that prove it's working
- **Inbox age** (median/max un-triaged) — the key health metric.
- **% triaged daily** (target ~100%; Inbox-to-zero streaks).
- **Time-to-triage** + Daily Review duration (target 5–10 min).
- **Confirm-without-edit rate** (AI quality + one-tap friction).
- **Rollover rate** (rising = over-commitment signal).
- **Backlog reactivation vs decay** (guards against a hidden graveyard in "later").
