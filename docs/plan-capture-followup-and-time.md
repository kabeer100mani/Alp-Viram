# Plan — Tap-to-answer follow-up + time-of-day capture

**Status:** Scoping for Palash. **No code written.** Grounded in the frozen package (locked 2026-07-11) with exact citations; conflicts are flagged, not built around, per Palash's instruction.
**Date:** 2026-07-18.

Two related asks, scoped together because both are "capture more real info without slowing capture":
1. A **tap-to-answer follow-up** after AI classify (buttons, one tap, skippable, non-blocking).
2. The **time-of-day bug** (task time not captured) + **start/end time fields** with a 06:00–24:00 default.

---

## Part 0 — The one framing that matters

The frozen package has a **consistent, deliberate stance**: capture is fast and empty; enrichment (filing, priority, responsibility) happens **later, at the Daily Review** — the one triage moment the package actually specs a number for (5–10 min). "**Capture First, Organize Later**" (PDL-005). So every "ask at capture" idea leans, to some degree, against that spirit. That doesn't make it wrong — Palash can rule to pull enrichment forward — but it's the lens for every conflict below. The question is never "does this block capture?" (nothing here does); it's "does asking at capture belong at capture, or at Daily Review where the package puts it?"

---

## Part 1 — Tap-to-answer follow-up

### 1a. Good news: the mechanism already exists (small change, not new)
The AI contract already has **`needs_clarification` + a free-text `clarifying_question`** ([classification.ts](src/lib/ai/classification.ts)), rendered as a **text box** in the proposal card ([AiCaptureBox.tsx](src/modules/inbox/components/AiCaptureBox.tsx):105-122). This is **PDL-028** ("ask a question only when it genuinely improves the work; never more than one; reducing interaction > maximizing intelligence"). The Must-Have itself is "classify + **minimal questions** + user confirm" (Doc 4:22). So a **skippable, one-tap question is squarely within the locked design** — *as a mechanism*. The work is to **upgrade the existing free-text question to tap buttons**, and decide **which field it may ask about**. There is **no interaction-count budget to violate** — those "≤3 interactions" figures were deferred (PDL-026; confirmed not-a-spec in M3 §7.8 and CLAUDE.md:42).

### 1b. Which questions are worth asking — and which aren't
You named three candidates (List, who-it's-for, priority). Grounded in the docs, they are **not** equal:

| Candidate | Verdict | Why |
| --- | --- | --- |
| **Which List?** | **✅ Ask (recommended)** | Highest value — an unfiled item is invisible until Daily Review, so a one-tap file at capture saves a real step. The locked objection is only to **forced** or **AI-inferred** filing (see Conflict 1); a **skippable, user-tapped** choice is neither. |
| **Priority?** | **❌ Don't ask** | **Direct conflict** — Doc 4 names *priority* in the Rejected-at-capture row (Conflict 3). Low value too: default is `none`, trivially set in triage. |
| **Who — assigned user?** | **❌ Don't ask** | **Direct conflict** — Doc 4 names *assignee* in the same Rejected row (Conflict 3). |
| **Who — responsible role?** | **❌ Don't ask (keep current behavior)** | PDL-021/FR-5 already specify the unsure case: **low confidence → leave blank, confirm at Daily Review** — *not* ask at capture (Conflict 2). The AI already pre-fills the role on high confidence and leaves it blank on low. Team-mode only anyway (solo has no roles, PDL-022). |

**Recommendation:** the follow-up asks about **List only** — reusing PDL-028's single-question slot, upgraded to tap buttons — and only when the AI is genuinely unsure *and* the org actually has lists. Priority and who-it's-for stay on their existing paths (default / Daily Review / PDL-021 pre-fill). This is the **smallest** version and the **least-conflicting** one, and it directly answers "which are worth asking, which aren't."

### 1c. How the smallest version works (no AI list-inference)
The AI must **not** infer the List (PDL-032). So: the AI only flags the *dimension* it's unsure about; the **app owns the options**.
- **Contract:** add `clarify: 'list' | null` (an enum, extensible if Palash later rules priority/who in). Keep `needs_clarification`.
- **Edge prompt:** set `clarify='list'` only when the capture reads as belonging to a specific project/list but which one is genuinely unclear. Never invent a list name.
- **Card UI:** when `clarify==='list'` and the org has lists, render the org's real lists as **tap buttons** + **"Inbox for now"** (= skip). One tap sets `list_id` on the proposal; then Confirm. If no lists exist, the question never shows.
- Everything else (zero-click capture input, AI-proposes-you-confirm per PDL-012) is unchanged.

### 1d. CONFLICTS to rule on (flagged, not resolved)
- **Conflict 1 — List at capture vs. "organize later."** The letter of the locked docs rejects only *mandatory* filing ("Mandatory Project/List at capture | The exact friction we exist to remove", Doc 4:75) and *AI-inferred* lists ("The AI does not infer the list — grouping stays a human/triage decision", PDL-032). A **skippable user tap is neither.** But the *spirit* is explicit that filing "happens **later**, in Daily Review or manually" (PDL-035) and "Capture First, Organize **Later**" (PDL-005). **A skippable capture-time List prompt honors the letter but bends the spirit.** Your call. → **Needs a PDL** if you approve it.
- **Conflict 2 — responsible role at capture vs. PDL-021.** PDL-021/FR-5 prescribe "low confidence → **leave blank**, confirm at Daily Review." Asking at capture would replace that. Recommendation avoids this by **not** asking about role.
- **Conflict 3 — priority / assigned-user vs. Doc 4 Rejected row.** "Forcing fields (**priority, labels, assignee**) at capture" is a named Rejected item (Doc 4:77). The hinge is "*forcing*" — a skippable tap isn't literally forcing — but these two fields are called out **by name**. Recommendation avoids this by **not** asking about either. If you want them, it's an explicit override of that row + PDL-005/PRD §4, and needs your ruling.

---

## Part 2 — Time-of-day capture + start/end time

This splits cleanly into a **bug fix that's fully in-contract** and a **feature that's new scheduling surface**. They share the same code, so scoping them together is right.

### 2a. The bug: time IS captured, then thrown away on the client (in-contract fix)
Not an AI bug. The classifier **correctly** resolves "call at 4pm" to an absolute, offset-qualified instant in your timezone — this is exactly the shipped TD-005 contract ([TECHNICAL_DEBT.md](docs/technical/TECHNICAL_DEBT.md):45-57). The time is stored on `due_at`. It's lost **on the client**, in two places:
1. **Display:** `formatDate()` shows month/day only — so a captured 4pm is invisible on the card, the table's Due column, and the panel.
2. **Edit:** the due/start editors are `<input type="date">` and write `T12:00:00` — so **editing the date clobbers the captured time to noon** ([DateCell.tsx](src/modules/items/components/DateCell.tsx), [TaskPanel.tsx](src/modules/items/components/TaskPanel.tsx)). *(The reminder field already uses a datetime control — the M6 pattern to copy.)*

**Fix (no conflict — this is honoring TD-005, not new scope):**
- A `formatDateTime()` that shows the time when the item has a specific time (see the has-time question in 2c).
- Make the due/start editors **time-aware** (datetime-local, mirroring the existing reminder field) so editing a date never destroys the time.

**Recommendation: do this regardless** — it's the actual bug you reported and it's inside the locked contract.

### 2b. The feature: start/end time fields + 06:00–24:00 default (new surface — needs a ruling)
This is the part with a real conflict.
- **Conflict 4 — start/end *time-of-day* fields + a 06:00–24:00 window are new scheduling surface.** The item model has `start_at` + `due_at` (a start→due **date** pair, PDL-034/PDL-036) and `remind_at` — **no time-window concept**. The only `starts_at`/`ends_at` in the whole package live in `meeting_details`, which **PDL-039 put dormant** with "*No scheduling logic is built (start/end time, location, agenda, calendar)*". Doc 4 files "**Timeboxing onto a simple internal calendar**" as **Good-to-Have** ("not required to prove the thesis", Doc 4:43). And **the 06:00–24:00 window appears in no frozen doc.** So this is pulling a Good-to-Have forward. Your call → **needs a PDL** if approved.

**Smallest honest shape (if you approve it):** don't add columns or a separate calendar. Reuse the two fields that already exist:
- **start = `start_at`, end = `due_at`**, both made **time-aware** (this is the same work as 2a).
- **Default window:** when an item has a date but no specific time, treat it as **06:00 → 24:00** (an "anytime that day" box); a specific time narrows it.
- Display it as a window ("3 Aug · 2:00–3:00pm", or "3 Aug · all day" for the default).

Semantic note to accept or reject: this **reuses `due_at` (a deadline) as the window "end."** For a task that's usually fine ("due by end of day" ≈ "window ends at 24:00"). If you want a true separate end-of-event distinct from a deadline, that's a **new `end_at` column** — heavier, and closer to the calendar feature the package defers. **Recommendation: reuse `due_at`; don't add `end_at` for MVP.**

### 2c. Decision inside 2a/2b — how to tell "has a specific time" from "date only"
Both the display fix and the window default need to know whether an instant carries a *meaningful* time.
- **Option A (recommended, no migration):** convention — an instant at **local midnight** means "no specific time" (show as a date / full-day box); any other local time means "has a time" (show it). Cheap, good enough for MVP; the only edge case is someone genuinely meaning 00:00, which is rare and harmless.
- **Option B (cleaner, +migration):** a `due_has_time` / `start_has_time` boolean per field. Honest, but two columns and more plumbing.
- **Recommendation: Option A** unless you want the extra rigor.

---

## Consolidated decisions I need from you

| # | Decision | My recommendation |
| --- | --- | --- |
| **D1** | **Follow-up scope.** Ask **List only** (skippable tap), or also who/priority (which requires overriding Doc 4's Rejected row + PDL-021)? | **List only.** Highest value, least conflict; keeps priority/who on their existing default/triage paths. |
| **D2** | **Approve the capture-time List prompt at all?** It honors the letter but bends the "organize later" spirit (Conflict 1). | **Yes, narrowly** — skippable, list-only, only when lists exist and the AI is unsure. Record as a PDL. |
| **D3** | **Time-of-day bug fix (2a).** | **Do it** — it's the reported bug and fully in-contract (TD-005). No ruling really needed; flagging for completeness. |
| **D4** | **Start/end time window (2b)** — pull this Good-to-Have forward now, or defer? | Fine to do the **minimal reuse** version (start_at→due_at, time-aware, 06:00–24:00 default, **no new column**). Record as a PDL. If you'd rather keep it lean, we can ship 2a only and defer 2b. |
| **D5** | **"has a time" representation (2c).** | **Option A** (midnight convention, no migration). |

---

## Effort estimate

- **Part 1 (List-only tap-to-answer):** ~0.5–1 gate. Contract enum + one edge-prompt line + fetch the org's lists in the capture card + tap UI + set `list_id` on confirm. No migration.
- **Part 2a (time bug fix):** ~0.5 gate. `formatDateTime` + time-aware due/start editors. No migration (Option A).
- **Part 2b (start/end window):** ~0.5 gate on top of 2a (the default-window rule + window display). No migration if we reuse `due_at` + Option A.

**Total ≈ 1.5–2 gates**, no migrations under the recommended options. Suggested gate split if approved: **Gate A** = time-of-day (2a + 2b, one coherent piece); **Gate B** = the List tap-to-answer.

---

## What I will NOT do without your ruling
- Ask about **priority** or **assigned user** at capture (Doc 4 Rejected row) — needs an explicit override.
- Ask about **responsible role** at capture (PDL-021 says leave-blank-and-confirm-at-triage) — needs a PDL amending PDL-021.
- Add an **`end_at`** column or any calendar surface (that's the deferred Good-to-Have).
- Record **any PDL** — the ones named above (capture-time List prompt; timeboxing-lite) are drafted here and get written **only on your approval**, same as M6/M7.
