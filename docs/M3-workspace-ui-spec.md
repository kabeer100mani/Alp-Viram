# M3 — Workspace UI · Milestone Spec

> 🟢 **Scope ruled by Palash 2026-07-16** (PDL-029, PDL-030) — awaiting final
> sign-off to begin implementation. No code written yet.
> Date: 2026-07-16 · Grounded in the **frozen** Product Design Package (2026-07-11).
>
> Where the frozen package specifies something, this spec follows it.
> Where it was silent or self-contradictory, it **asked** rather than decided
> — see §6 *Rulings* and §7 *Conflicts*.
>
> **Rulings applied:**
> - **No board view.** The frozen IA wins; `PROJECT_PLAN.md:183` is corrected (**PDL-029**).
> - **Daily Review is in M3** — without it the Inbox is a one-way door (**PDL-030**).
> - **Search is in M3** — Must-Have, in the frozen rail (**PDL-030**).

---

## 1. Objective

Make the workspace usable: see your items through **intent-based views**, and act
on them in **one action from the card**. This is the first milestone where the
product becomes operable — today nothing in the UI can edit or complete an item.

## 2. Why this milestone exists now

The plan's M3 was skipped when the AI layer (M4) was built out of order. M4 gave
us capture and classification; **items can go in, but nothing can come out**. The
Inbox has no exit: PDL-016 makes Daily Review the *only* way items leave it, and
Daily Review does not exist.

---

## 3. What the frozen package already decides (not open for redesign)

**Navigation** — `05-information-architecture.md:129-147`, near-verbatim:
```
Left rail:  Inbox (badge = count to triage) · Today · Upcoming
            ─ · Projects · Views · Search
            ─ · People & Roles
Top bar:    [Org switcher ▾] [Quick capture] [Daily Review] [theme]
```
Quick capture is **one keystroke from anywhere** (`05:145`).

**Views are the navigation** — `05:120-122`: *"Views are how users navigate — by
intent, not by tree."* System views: **Inbox, Today, Upcoming, Aging, Waiting,
Done, By Role**. Users may save custom filter combos. Saved views are "the
reports of MVP" (`03:173-186`).

**Structure** — `05:46-69`: the only required containment is `Organization → Item`.
**Project is an optional attribute, not a parent** (PDL-008). Inbox is a
**state/view, not a container** (`05:33-44`).

**Item actions** — `03-user-journey.md:150-153`: *"Status changes and completion
are one action from the item card."* No drill-through to act.

**Types** — `05:84,91-95`: Task / Note / Meeting. **A Note has no done-state and
no owner-to-execute.** Reminders must present *as Reminders* and never leak that
they are really Tasks (PDL-027).

**Aging, not overdue** — FR-12b (`01:220-222`): *"There is no raw 'overdue'
state."* Doc 4 explicitly **rejects** "a raw 'overdue' shaming state". Rollover
offers *Today / a day / Backlog*, **never labelled overdue** (`03:120-123`).

**Progressive disclosure** — PDL-022: hide Organization/Roles/team concepts for
solo users. Same data model underneath, two UX modes.

**Unfilled roles** — `03:145-149`: render **"UNFILLED — needs owner"**, never a
stale name.

**Done** — `03:161-166`: archives out of active views (recoverable, not deleted),
writes an immutable audit event, and **freezes** responsibility.

**Requirements in scope:** FR-13…FR-20 (`01:224-236`) — views, status change +
completion (FR-17), activity log (FR-18), light/dark with persistence (FR-19),
responsive desktop-first (FR-20).

---

## 4. Proposed scope

### 4.1 App shell & navigation
- Left rail + top bar exactly as `05:129-147`.
- Solo mode (PDL-022): hide Org switcher and **People & Roles**; reveal when a
  second member joins.
- Global quick-capture shortcut.

### 4.2 Views (the core of the milestone)
- Seed the **7 system saved views** via migration (see §7.7 — they are specified
  but were never seeded, and `0003` blocks clients from creating `is_system` rows).
- Render any view from its `filter jsonb`, **Zod-validated** before use (TDL-010) —
  a saved filter is untrusted input, exactly like AI output.
- Custom saved views: create/rename/delete (owner-scoped; `0003` already enforces
  members cannot create `is_system`).

### 4.3 The item card & one-action affordances
One action from the card, per `03:150-153`:
- **Task:** Done · Snooze · Start (see §6-E) · reschedule via rollover language.
- **Meeting:** Done · Snooze · reschedule.
- **Note:** **no Done** (`05:84`) — Notes surface in views but are not completable.
- State is rendered as **human language, never the raw enum** (PDL-027; today
  `ItemList.tsx:32` prints `captured`/`in_progress` verbatim).
- Affordances respect the permission model shipped in `0005`: only **admin /
  creator / assignee / current role-holder** may write. Others see a read-only
  card — the UI must not offer an action the database will refuse.

### 4.4 Write path (new — none exists today)
`items-repository.ts` currently has only `listItems` + `createItem`. Add
`updateItem`, `setState`, `complete`, `snooze` — each going through the same
typed, validated boundary, with optimistic updates via TanStack Query.

### 4.5 Daily Review — triage (PDL-016, PDL-030)
The **only** way items leave the Inbox. Target: **5–10 minutes** (`03:130`) — the
one frozen number in this milestone.
- Triage card per `03:124-129`: item + AI chips `Type ▸ Project ▸ Role ▸ Due`.
- **Confirm** accepts all chips at once; tapping a single chip changes one field.
- Secondary actions: **Snooze · Done · Backlog**. Whole groups confirm at once.
- Rollover language offers *Today / a day / Backlog* — **never "overdue"** (`03:120-123`).
- Confirm, never autopilot (PDL-012 / PDL-028): triage proposes, the user accepts.
- *(Duplicate-merge and auto-grouping are Good-to-Have — only if cheap.)*

### 4.6 Search (PDL-030)
Full-text over items, backed by the `items.search` tsvector already shipped in
`0002`. Rail entry per `05:143`. Scoped to the active organization by RLS.

### 4.7 Polish
- Dark/light with persistence (FR-19); responsive desktop-first (FR-20).
- Empty states per view; loading/error states.

---

## 5. Explicitly out of scope

**Rejected — must not build** (`04:67-79`): deep hierarchy; mandatory Project at
capture; auto-executing AI; **a raw "overdue" state**; template onboarding;
cross-org views.

**Future** (`04:50-63`): reports/analytics dashboards (MVP "reports" = live saved
views); mobile/PWA; realtime/presence; notifications; calendar sync.

**Good-to-Have, only if cheap** (`04:35-47`): duplicate detection/merge, triage
auto-grouping, drag-to-calendar timeboxing, comments, attachments, templates.

---

## 6. Rulings

### Ruled by Palash, 2026-07-16
| # | Question | Ruling |
| --- | --- | --- |
| **A** | Board view — build or drop? (§7.1) | **Dropped.** Frozen IA wins; `PROJECT_PLAN.md:183` corrected. → **PDL-029** |
| **B** | Is Daily Review in M3? | **Yes — in M3.** Without it the Inbox is a one-way door. → **PDL-030** |
| **C** | Search — M3 or later? | **In M3.** Must-Have, in the frozen rail. → **PDL-030** |

### Proceeding on these defaults unless you say otherwise
These are lower-stakes; each follows the frozen package where it speaks, and is
recorded here so a silent choice never masquerades as a specification.

| # | Question | Default taken | Basis |
| --- | --- | --- | --- |
| **D** | Item detail screen — does one exist? | **No** — inline on the card only | Never described anywhere in the package; Doc 3 acts entirely on the card (`03:150-153`) |
| **E** | `in_progress` — who sets it, where? | A **"Start"** action on Task cards | The state ships in the DB (TDL-021) but is in **no** product doc. If you'd rather, we leave it unused — say so |
| **F** | Aging threshold | **3 days** | `03:133` says "e.g. 3 days" — illustrative, not fixed. Configurable later |
| **G** | "Overdue" vs "Aging" (§7.2) | **Aging** | FR-12b: *"There is no raw 'overdue' state"*; Doc 4 rejects it. PRD/PDL-010 wording is stale |
| **H** | "My Day" vs "Today"; 6 vs 7 system views (§7.3) | **"Today"; 7 views incl. Done** | Doc 5 is the IA authority |

---

## 7. Conflicts in the source material (flagged, not decided)

### 7.1 ✅ RESOLVED — "Board views" contradicted the frozen IA → board dropped (PDL-029)
- `PROJECT_PLAN.md:183` (**predates the 2026-07-11 freeze**): *"List + **board** views…"*
- `05:124` (frozen): tags+views *"avoids the **duplicate-board** / naming-drift
  failure of hierarchical tools"*
- `05:129-147` (frozen): the specified navigation has **no board surface**
- `research/competitive-analysis.md:30-33`: Monday criticised as *"Board-centric;
  no lightweight global inbox"*

The word "board" appears nowhere in Docs 1–6 as a workspace surface. A board
*could* be read as a projection of `item_state` (the enum would supply columns),
but the package never says so.

**Ruled 2026-07-16: no board.** `PROJECT_PLAN.md:183` corrected to match Doc 5.
Recorded as **PDL-029**.

### 7.2 "Overdue" view vs the rejection of overdue
`01:126` and PDL-010 (`02:77`) both list an **Overdue** view — but Doc 4 rejects a
raw overdue state, FR-12b says there is none, and Doc 5's system views use
**Aging**. → Recommend **Aging**; PRD/PDL-010 wording looks stale.

### 7.3 View naming/count drift
"My Day" (`01:126`, `02:77`) vs **"Today"** (`05:121`, Doc 3). Doc 5 lists **7**
system views including **Done**; Doc 4 lists **6**, omitting Done.
→ Recommend Doc 5 as the authority (it is the IA).

### 7.4 `item_state` has 6 values; the IA lifecycle describes 5
`05:56`: *Captured → Committed → Done (+Snoozed/Backlog)*. The DB also has
**`in_progress`** (TDL-021), never back-propagated into the product docs. → §6-E.

### 7.5 "minimal-click **task** actions" vs the unit being **Item**
The plan says *task*; the package's unit is Item (Task/Note/Meeting), and Notes
have no done-state. → Spec written for Items; Notes get no Done.

### 7.6 Shipped code already contradicts the frozen package
| Where | Conflict |
| --- | --- |
| `HomeScreen.tsx:45-57` | Shows a solo user "Workspace", "Mode: Personal (solo)", "Your role: owner" — org/role concepts **PDL-022 says to hide**. |
| `ItemList.tsx:32` | Renders the raw enum (`captured`, `in_progress`) — leaks storage internals (PDL-027). |
| `HomeScreen.tsx:29,68` | Still says *"Milestone 1 · Identity & Tenancy"* and *"Next milestone: the AI Inbox"* — both stale. |
| `AppShell.tsx:8-25` | No left rail at all. |
→ Proposed: M3 fixes all four.

### 7.7 System saved views are specified but never seeded
The 7 system views exist in Doc 5 but in no migration, and `0003:87-91` blocks
members from creating `is_system` rows. They must ship via migration/service role.
Unspecified anywhere — flagged.

### 7.8 No frozen click-count targets
`06:120-122`'s "≤3 interactions / ≤10s capture / ≥85% classification" are the
**architect's open question**, explicitly deferred by **PDL-026** until after the
prototype. They are **not** a spec. The only frozen number is **Daily Review
5–10 minutes** (`03:130`).

---

## 8. Definition of done (`PROJECT_PLAN.md:256-264`)
1. Features work as described. 2. `lint`, `test`, `build` pass. 3. Testing
procedure run and observed. 4. Committed to `Development`. 5. New decisions
recorded (PDL/TDL entries for anything ruled in §6–§7).

Plus, for this milestone specifically: the UI must never offer an action the
permission model will refuse — verified against a non-privileged member.
