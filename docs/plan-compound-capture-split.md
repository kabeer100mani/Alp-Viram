# Plan — Splitting a compound capture into multiple items

**Status:** Scoping for Palash. **Report first — no build.** Date: 2026-07-18.

**The idea:** when one capture describes several distinct pieces of work
("Prepare MIS **and** Zoho reconciliation by tomorrow"), the AI should offer to split
it into either **multiple tasks** or **one task + checklist items**, instead of
making one muddled task.

---

## 1. How would the AI reliably detect "this is actually two things"?

**Honest answer: it can't do so with high reliability from surface cues alone — which is why the design must lean on user confirmation, not autonomous splitting.**

- **Weak signals (cheap, but noisy):** conjunctions (`and`, `&`, `plus`, `then`), commas/list structure, multiple verb-phrases with distinct objects. These are easy to detect but **fire constantly on non-compound sentences** (see §3).
- **What actually distinguishes two work items:** whether the parts are **independently actionable, schedulable, assignable, and completable.** "Prepare MIS" and "Zoho reconciliation" are two deliverables (two owners possible, two done-states). "Call the client and confirm the meeting" is *one* action described in two clauses. Surface grammar doesn't reliably separate these — it takes judgment about the *work*, which is exactly where an LLM is better than keyword rules but still **not reliable enough to act silently.**
- **Therefore:** detection should produce a **proposal**, never an automatic split. The AI flags "this looks like N items" with the proposed breakdown; the **user confirms/adjusts** in the capture card (PDL-012 "AI proposes, user confirms"). And it should be **biased against splitting** (PDL-028 restraint) — only propose a split when the parts are clearly independent deliverables.

## 2. Which representation is better — separate tasks vs. one task + checklist?

**Neither is universally right; they mean different things, and the choice is itself part of what the user confirms.**

- **Separate tasks** — correct when the parts are **independent work**: each can have its own owner, due date, status, and can be completed separately. "Prepare MIS" and "Zoho reconciliation" are two deliverables → **two tasks** (they might share tomorrow's due date, but they finish independently). This is the higher-value split — it's what lets responsibility and completion track each piece.
- **One task + checklist items** — correct when the parts are **steps of one deliverable**: "Prepare the MIS: pull numbers, format, email it." One owner, one done-state, sub-steps. Checklists already exist for exactly this (PDL-033).
- **Recommendation:** when the AI is confident the parts are **independent**, propose **separate tasks** (the default for a true compound), and offer **"make it one task + checklist"** as a one-tap alternative. When unsure, **default to a single task** (conservative) and let the user split it. So the representation is a **confirm-time choice**, seeded by the AI's read of independence.

## 3. Risk of over-splitting normal sentences — this is the biggest risk

**Real and significant.** "and" is the most common word that *isn't* a task boundary:
- "Call the client **and** confirm Tuesday" — one action.
- "Meet Bob **and** Alice" — one meeting.
- "Prepare the deck **and** send it to Palash" — arguably one task with a step, not two deliverables.
- "Buy milk, eggs **and** bread" — one errand (or a checklist), not three tasks.

An eager splitter turns clean single captures into clutter — **the exact "graveyard of clutter" the product exists to avoid** — and it adds interaction (the user now has to merge). Mitigations:
- **Bias hard toward NOT splitting** (PDL-028); only propose when parts are clearly independent deliverables, not merely conjoined clauses.
- **Always confirmable, never silent** (PDL-012): show "I found 2 tasks — [Keep as 2] [Merge to 1] [1 task + checklist]"; one tap. Capture is never blocked — hitting confirm without touching it accepts the safe default.
- **Make the safe default the conservative one:** when confidence is low, propose **one** task, not many.

## 4. Conflicts with the frozen package

No hard model conflict, but two governing rules and one scope flag:
- **PDL-012 (confirm, don't autopilot)** and **PDL-028 (AI restraint / minimize interaction)** govern: splitting must be a user-confirmed proposal, biased against firing. A silent auto-split would violate PDL-012.
- **Checklists (PDL-033)** already provide the "one task + sub-steps" representation — so half of this is *presentation over an existing feature*, not new structure.
- **Scope-timing:** like project-context, "AI proposes to restructure your capture" leans toward the deferred **"Advanced AI / smart suggestions"** bucket (PRD §7 / Doc 4 Future; PDL-031). A flag, not a block — it's your call whether it's early.
- **Not a conflict:** splitting *helps* capture-first (one sentence → structured items) as long as it's confirmed and non-blocking.

## 5. Size estimate

**≈ 1.5–2 gates.**
- AI contract change: the classifier returns an **optional array of proposed items** (or a single item as today) — a Zod contract extension + Edge Function prompt work + redeploy. The prompt must be tuned *conservatively* (bias against splitting) and tested against a battery of true-compound vs. false-compound sentences — the **testing is the real cost**, because over-splitting is the failure mode.
- Capture-card UI: show the proposed split with the one-tap [Keep as N] / [Merge] / [1 task + checklist] control.
- Create-path: create N items (or 1 + checklist) on confirm.
- **Detection quality is the risk, not the plumbing.** I'd want a labelled test set of compound vs. non-compound captures and an accepted false-split rate before shipping — and this benefits from the **Anthropic accuracy work (D3)**, since split-detection is more demanding than type classification.

**Recommendation:** worth doing, but **after** the List follow-up + Project-context layer, and **gated on** a conservative, well-tested detector (measured false-split rate) — not shipped on a hunch, given the over-splitting downside. Report only; no build until you approve.
