# Plan — dense, table-style list layout

> **Assessment only. No code written.** Requested by Palash 2026-07-16.
> Goal: a ClickUp-style dense table (rows + columns, grouped collapsible sections)
> replacing the spaced card layout, using **existing fields only**.

---

## 0. Headline

- **The frozen docs do NOT prescribe a layout.** No "card vs table", no density rule.
  What is locked is *behaviour* — glanceable responsibility, one-action status/
  complete, the triage chip set. A dense table satisfies all of them. So this is a
  **presentation change, far lighter on the locked package than the Folder/List
  reversal** (which changed the data model and five locked decisions).
- **One column can't be built from existing fields: Start date.** `start_at` does
  not exist (it was marked *Future* in the DB design). Everything else is real.
- **It is NOT "just this view".** Every view — Today, Upcoming, Aging, Waiting,
  Done, By Role, Inbox, a List, and Search — renders through the **one** `ItemList`
  → `ItemCard` pair. Changing the layout changes all of them (which is arguably the
  point: "much less blank space" everywhere).

---

## 1. What the frozen design package says

| Source | Says | Bearing |
| --- | --- | --- |
| Doc 5 / Doc 3 | Uses the word **"card"** ("each card shows…", "one action from the item card") | Descriptive, not prescriptive. A dense **row** is still "one action from the item". Wording should be annotated, not treated as a block. |
| Doc 3 §Execution | "Status changes and completion are **one action** from the item"; responsibility **at a glance**; "UNFILLED — needs owner" | The table must keep these — status/complete inline, assignee visible, no stale names. |
| FR-19/20 | light/dark, **responsive desktop-first** | A wide table is desktop-first by nature; needs horizontal scroll / column hiding on narrow screens. |
| Doc 4 | Rejects a raw **"overdue"** state | A "Due" column must not turn red-shaming; lateness stays neutral (Aging is the surface). |
| PDL-027 | never leak storage internals | Status column shows human labels ("In progress"), never the `state` enum. |
| PDL-022 | hide team concepts from solo users | The **Assignee column only exists in team mode** — a solo user has no assignees. |

**No locked decision conflicts with a table layout.** The only doc work is
annotating Doc 5 / Doc 3 "card" wording and recording the decision (a new PDL),
plus the FR-20 responsive note. Much smaller than PDL-032.

## 2. The columns, against real fields

| Column | Backing field | Editable today? | Notes |
| --- | --- | --- | --- |
| **Assignee** | `item_assigned_users` (join) + derived responsible holder | picker exists (Gate C) | **Team-only** (PDL-022). Needs a **batched** fetch — see §4. |
| **Priority** | `items.priority` enum (exists) | **No editor exists** — AI-set only | New inline `<select>`; small. |
| **Start date** | ❌ **`start_at` does not exist** | — | **Contradicts "existing fields only." Decision needed (§5).** |
| **Due date** | `items.due_at` (exists) | editable in triage only | New inline date input. |
| **Status** | `items.state` enum (exists) | via action buttons | Inline status `<select>`; must show human labels (PDL-027) and keep Notes' no-done rule. |

## 3. Grouped, collapsible sections ("Common · 7")

- Grouping logic already exists — **By Role** groups items under role headers. This
  generalises to "group by List" (and could offer group-by-status later).
- Add: a **collapsible** header with a **count**, and a group-by control per view.
- Proposed default grouping: **by List** on the list/overview surfaces; By Role
  keeps role grouping; date-scoped views (Today/Upcoming) stay flat or group by list.

## 4. The real engineering cost is not the HTML — it's two things

1. **Responsibility is fetched per-row today** (`useItemResponsibility` runs once
   per card). An Assignee column over a 50-row table = 50 queries. Needs a
   **batched fetch** (one query/RPC returning assignee + derived holder for a page
   of item ids — the same shape as `writable_item_ids`). This is the bulk of the work.
2. **Checklist / DoD / full responsibility editing don't fit in a dense row.** They
   move to a **row-expand** (click a row to reveal them). The request explicitly
   wants priority + dates *in the row*; the heavier editors stay one click away.

## 5. Decisions needed from Palash

| # | Question | Recommendation |
| --- | --- | --- |
| **A** | **Start date** — it isn't an existing field. Add a `start_at` column, or drop the column? | **Add `start_at`** (tiny migration; the DB design already earmarked it as Future). Then all 5 columns are real. Alternative: ship 4 columns now, add Start later. |
| **B** | **Scope** — dense table **everywhere** (one presentation, consistent), or **only** the List/overview view (two presentations to maintain)? | **Everywhere.** There is no separate "list view" component; all views share `ItemList`. One dense presentation is less code and consistent. |
| **C** | **Assignee column when solo** — hide it (PDL-022), since a solo user has no assignees? | **Hide when solo**, like the rest of the team UI. |
| **D** | **Keep a card option?** Or replace cards outright? | **Replace.** Simpler; revisit a density toggle only if you miss the cards. |

## 6. Size estimate

**Bigger than polish, well short of the Folder/List reversal. ≈ 1.5–2 gates.**

| Work | Size |
| --- | --- |
| `ItemTable` + `ItemRow` (dense grid, responsive/scroll) | ~½ gate |
| Inline editors: priority (new), due, status | ~¼ gate |
| Grouped collapsible sections + group-by | ~¼ gate |
| **Batched assignee/responsibility fetch** (RPC or query) | ~¼–½ gate — the real cost |
| Move checklist/DoD/responsibility into a row-expand | ~¼ gate |
| `start_at` column + inline editor (if approved) | ~¼ gate |
| Tests (unit) + browser walkthrough + a11y/responsive pass | ~¼ gate |

*Not a data-model change; no red-team migration beyond the optional `start_at`
column. The card components are replaced, not extended, so little is thrown away.*

## 7. What would NOT change
- The data model (except optional `start_at`), RLS, permissions, the view engine's
  filters, Daily Review, capture, search. Purely how a view's items are *drawn*.
