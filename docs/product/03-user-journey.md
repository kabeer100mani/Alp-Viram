# Document 3 — Complete User Journey

> Part of the Product Design Package. For each stage: the **typical
> (high-friction) way**, our **reduced-effort way**, and the **clicks we
> challenged**. The measure is always: *does this reduce user effort?*

The end-to-end spine:

```
Registration → Organization → Project → Inbox → Capture → Planning(Triage)
             → Execution → Completion → Reports
```

A key reframing up front: in most tools this is a **linear setup gauntlet** —
you must build Organization → Project → structure *before* you can do anything.
In Alp-Viram, **capture comes first**; Organization is a light one-time step and
Project is optional and deferred. The user reaches value (their first captured
item) in seconds, not after setup.

---

## Stage 1 — Registration

**Typical:** email + password + verify + name + company + team size + invite
teammates + pick a template… (5–8 steps before anything.)

**Alp-Viram:**
1. Sign in with email (magic link or password) — one screen.
2. First name only (optional; can be skipped).
That's it — the user lands in their Inbox.

**Clicks challenged:**
- ❌ "Company size / role / use-case" survey → removed (or asked *later*, in
  context, by the AI if ever needed).
- ❌ Template picker → removed. Templates are a *future* convenience, never a gate.
- ✅ Everything non-essential is deferred until it's actually needed.

---

## Stage 2 — Organization

**Typical:** create workspace → name it → configure → set up spaces → permissions.

**Alp-Viram:**
- On first run, an Organization is created automatically (named "My Workspace" or
  from the email domain) so the user is never blocked. They can rename it later.
- Inviting people is a single action available from anywhere, not a setup wizard.
- **Multi-org (simplified):** if the user belongs to several orgs, a switcher in
  the top bar changes the active org. No simultaneous cross-org view in MVP.

**Clicks challenged:**
- ❌ Mandatory org configuration before use → removed; sensible defaults, edit later.
- ❓ **Challenge:** do solo users need the word "Organization" at all? For a solo
  professional it's overhead. *Recommendation:* hide org concepts until a second
  person is invited (progressive disclosure). Flagged in Architect's Recommendations.

---

## Stage 3 — Project (optional)

**Typical:** you must pick/create a Project (and often a Folder and List) before
adding a task.

**Alp-Viram:**
- **Projects are optional and created lazily.** A user can work for days entirely
  from the Inbox with tags, never making a Project.
- A Project is created in one step when the user actually wants to group work
  (or when the AI suggests one during triage and the user confirms).

**Clicks challenged:**
- ❌ "Choose a project before capturing" → removed entirely (the core differentiator).
- ✅ Project becomes an *organizing* tool used later, not a *gate* used first.

---

## Stage 4 — Inbox (the home base)

The Inbox is where the user lives. It has two jobs: **Capture** (Stage 5) and
**Daily Triage** (Stage 6). It is a *staging ground*, never a permanent home —
the Daily Review is the only exit, so it can't rot.

**Clicks challenged:**
- ❌ Navigating a tree to find "where things are" → replaced by one Inbox + saved
  views + search.

---

## Stage 5 — Capture (frictionless, zero decisions)

**Typical:** New Task → title → pick project → pick list → assignee → priority →
due date → labels → Save. (7+ decisions for one thought.)

**Alp-Viram:**
1. User types naturally in one box: *"Prepare July MIS before 8th."*
2. AI classifies it (Task), extracts the due date (Jul 8), and proposes metadata
   (project, responsible role, tags) — each with a confidence score.
3. If something essential is missing, AI asks **one** minimal question; otherwise
   it stays silent.
4. User **confirms** (one tap) — or edits a chip — and the item is captured.

If the user is busy, they can hit enter and move on: the item lands raw in the
Inbox and gets sorted at the Daily Review. **Capture never blocks.**

**Clicks challenged:**
- ❌ 7 fields per task → 1 sentence + at most 1 confirm.
- ❌ Choosing a type from a menu → AI infers it (Task/Note/Meeting).
- ✅ The user's natural language *is* the interface.

**Edge cases:** AI unsure of type → defaults to Task and flags for review; AI
can't parse a date → leaves it undated in Inbox (never guesses silently, per
"confirm not autopilot").

---

## Stage 6 — Planning (the Daily Triage ritual)

This stage is what stops capture-first from becoming a dumping ground. Once a
day, a guided **Daily Review** runs (research-backed: GTD clarify, Sunsama ritual,
Linear one-tap triage, Superhuman inbox-zero):

1. **Rollover.** "Yesterday: 3 unfinished." Each offered *Today / a day / Backlog*
   as neutral moves — **never labeled "overdue."**
2. **Triage the Inbox, grouped.** AI presents items in clusters (by project/type/
   duplicate). Each card shows the item + AI chips: `Type ▸ Project ▸ Role ▸ Due`.
3. **One-tap confirm.** **Confirm** accepts all chips; tap a chip to change one
   field; secondary actions: **Snooze**, **Done** (2-minute rule), **Duplicate**
   (merge), **Backlog**. Whole groups confirm at once.
4. **Timebox (optional).** "Today" items can be dragged onto the calendar, or AI
   auto-slots them.
5. **Finish.** Inbox reaches 0; "Inbox clear." Target: 5–10 minutes.

**Anti-dumping-ground rules:** items un-triaged past an age limit (e.g. 3 days)
auto-escalate with an "aging" badge; the nudge counts "N to triage," not "N
overdue"; "later" only means Someday, which is itself reviewed on a cadence.

**Clicks challenged:**
- ❌ Manually hunting overdue tasks and rescheduling one by one → batch rollover.
- ❌ Filing each captured item individually, cold → AI pre-sorts; user confirms.

---

## Stage 7 — Execution

**Typical:** open project → open list → find your task → open it → change status.

**Alp-Viram:**
- The **Plan** surface (Today + a quiet "This Evening"-style section) shows only
  committed, dated work — no navigation to find "what's mine today."
- Responsibility is clear at a glance: **Responsible Role(s)** (durable) and the
  **Assigned User(s)** executing now. If a role is unfilled, the item shows
  "UNFILLED — needs owner," never a stale name.
  <!-- Wording updated 2026-07-16 (PDL-031). "Current Owner" was pre-PDL-020
       vocabulary; PDL-020 split responsibility into Responsible Roles (the role)
       and Assigned Users (the people executing). The derived "who is responsible
       now" still comes through the role, not a stored person (Doc 9 / TDL-012). -->
- The current responsible person is **derived** through the role's time-bounded
  assignment, never stored on the item (Doc 9).
- Status changes and completion are one action from the item card.

**Clicks challenged:**
- ❌ Drilling through project → list → task to act → one-tap from Today.
- ✅ "What should I do now?" is answered by a view, not by the user's memory.

---

## Stage 8 — Completion

**Alp-Viram:**
- Marking done archives the item out of active views (not deleted; recoverable).
- Completion writes an **immutable audit event** (who/what/when). Completed items
  freeze their Current Owner — history never rewrites even if roles later change.
- Recurring items (e.g. "July MIS" → monthly) regenerate the next occurrence.

**Clicks challenged:**
- ❌ Manually re-creating recurring work → recurrence handled on completion.

---

## Stage 9 — Reports (mostly Future; MVP = live views)

Full analytics/dashboards are **Future scope.** For MVP, "reports" are **live
saved views**, which cover the everyday questions with zero report-building:
- *What's due today / this week?* → Today / Upcoming views.
- *What's overdue or aging?* → an aging view (guilt-free framing).
- *What is the "Finance Manager" role responsible for?* → filter by role.
- *What's waiting on a client?* → the "Waiting" view.

**Clicks challenged:**
- ❌ Building a custom report to answer a simple question → a saved view answers it.
- ❓ **Challenge:** true cross-project/role analytics (throughput, workload
  balance, trend over time) is genuinely valuable but is **Future** — building it
  in MVP would divert us from the capture/triage/responsibility core. Flagged.

---

## Journey-level observations (challenges carried to Architect's Recommendations)

1. **Solo vs team:** the Org/Role machinery is overhead for a solo user.
   Recommend progressive disclosure — hide Org/Role concepts until a second
   person joins.
2. **Role setup vs capture-first tension:** requiring a Responsible Role on every
   item could reintroduce a decision at capture. *Recommendation:* AI infers/omits
   the role at capture (defaulting to the user or "unassigned role"), and role is
   confirmed during triage — so capture stays frictionless.
3. **The Daily Review must feel rewarding, not like a chore** — Inbox-to-zero
   streaks, fast batch confirm, guilt-free rollover. If it feels like work, users
   skip it and the graveyard forms.
