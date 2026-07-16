# Document 5 — Information Architecture (IA)

> Part of the Product Design Package. This document challenges the structural
> model before it is locked, resolves the Item-type question, and defines how
> Items, Projects, Tags, Views, Roles, and the Inbox relate. No SQL — structure
> and reasoning only.

---

## 1. Principles for the IA

1. **Containers create friction.** Every level a user must choose is a click and a
   decision. Minimize levels; make the remaining ones optional.
2. **Separate *where a thing lives* from *how you look at it*.** Structure
   (Org/Project) is one axis; projection (Tags/Views) is another. Don't conflate.
3. **State is not hierarchy.** "In the Inbox" is a *lifecycle state*, not a parent
   container (this is the main correction below).
4. **Few, distinct types.** The AI (and the user) must tell types apart instantly.

---

## 2. Challenging the proposed hierarchy

The proposal on the table was:

```
Organization → Project (optional) → Inbox → Item   (7 item types)
```

I recommend **against** treating **Inbox** as a hierarchy level, and **against**
7 types. Here is why, and the corrected model.

### 2a. "Inbox" is a state, not a container
If Inbox sits *between* Project and Item as a container, it implies an Item is a
child of the Inbox and must be "moved out" into a Project. That's wrong for two
reasons:
- Items **without a project** are the norm (capture-first), and they must remain
  first-class, not trapped inside an "Inbox container."
- An Item's relationship to the Inbox is **temporal** (it's *untriaged*), not
  structural. Once triaged it may still have **no** project and simply become
  "committed."

**Correction:** the Inbox is (a) the **capture surface** and (b) a **view** of
Items in the *Captured/untriaged* state. It is not a tier in the containment tree.

### 2b. The corrected structural model

*Amended 2026-07-16 (PDL-032): Folder → List reinstated as **optional** structure;
`project_id` renamed to `list_id`. The required-containment rule below is unchanged
— an Item still needs nothing but an Organization.*

```
Organization  ("Workspace"; you belong to several — Personal, Profile 1… — and switch)
   │
   ├── Roles            (durable responsibilities; people are assigned over time)
   │
   ├── Folder?          (OPTIONAL grouping of Lists)
   │      └── List?     (OPTIONAL — a List may also sit at the Org root)
   │
   └── Item             (the unit of work — the ONLY required object besides Org)
          ├── type: Task | Note | Meeting
          ├── responsibility: Responsible Roles · Assigned Users · Collaborators
          ├── lifecycle state: Captured(Inbox) → Committed → Done  (+ Snoozed/Backlog)
          ├── list_id?      (OPTIONAL — no list ⇒ it lives in the Inbox)
          ├── checklist[]   (optional sub-steps)  ·  definition_of_done?  (note, not enforced)
          └── tags[]        (flat, many-to-many)

Cross-cutting projections (not containers):
   • Inbox      = view of Captured/untriaged Items
   • Today/Plan = view of Committed Items due/scheduled now
   • Saved Views = user- or system-defined filters over Items
   • Search     = full-text across Items
```

So the **only required containment** is `Organization → Item` — still true after
PDL-032. **List (and its Folder) is an optional attribute** of an Item, never a
mandatory parent: capture stays zero-click and unfiled, and an item with no list
lives in the Inbox. Everything else is a **view**.

> **What PDL-032 changed, and what it didn't.** Structure now *exists* (Folder →
> List, ex-Project). What is still rejected: nesting deeper than Folder → List, and
> **forcing** a list at capture. The friction PDL-006 feared was mandatory filing —
> not the existence of a place to file.

---

## 3. Item Types — full analysis and recommendation

Candidates: **Task, Reminder, Meeting, Follow-up, Note, Knowledge, Question.**

The test for "is this a *type* or *metadata*?": a **type** has a genuinely
different *shape* (fields) and *lifecycle*. If it's the same shape as an existing
type with an extra attribute, it's **metadata**.

| Candidate | Verdict | Reasoning |
| --- | --- | --- |
| **Task** | **TYPE** | Actionable; has a doer and a done-state. The core object. |
| **Note** | **TYPE** | Information; *no* done-state, *no* owner-to-execute. Fundamentally different shape from Task. |
| **Meeting** | **TYPE (light)** | Distinct lifecycle: *before* (time, participants, agenda) → *after* (notes, action items). Genuinely different shape. Kept, but thin in MVP (no calendar sync yet). |
| **Reminder** | **metadata of Task** | A reminder is a Task whose point is a time-based nudge. Same shape + a `remind_at`. Exposed as a capture intent ("remind me…") and a view, not a separate type. |
| **Follow-up** | **metadata of Task** | "Follow up with TCS" is a Task about chasing someone; add a `waiting_on` attribute + a "Follow-ups / Waiting" view. Same shape as Task. |
| **Knowledge** | **metadata of Note** | "Knowledge" is a Note marked as durable/reference (pinned, curated). Same shape as Note + a `is_reference` flag or a `#knowledge` tag. |
| **Question** | **routed, not stored** | A "question" is one of: (a) *ask my workspace* → a live AI answer (not stored); (b) *I need to find out X* → a **Task/Follow-up**; (c) *open discussion point* → a **Note**. Storing "Question" as its own type creates ambiguity with Note/Follow-up and a dead-end object. |

**Recommendation (final):** **3 stored types — Task, Note, Meeting** — plus
Reminder/Follow-up as Task metadata, Knowledge as Note metadata, and Question
handled by routing. This cuts the AI's classification decision from 7 fuzzy
options to 3 clear ones (huge reliability gain), while preserving every user
behavior through natural-language intents and dedicated views.

> Alternative considered: keep Meeting as metadata too (2 types). Rejected for
> MVP because Meeting's before/after lifecycle is different enough that forcing it
> into Task would leak complexity into the Task shape. Revisit if Meetings stay
> thin.

### 3a. The Item shape (conceptual)
- **Common:** id, org, type, title, body/details, state (Captured/Committed/Done/
  Snoozed/Backlog), created_by, created_at, updated_at, project_id?, tags[],
  Responsible Role, Current Owner?, Collaborators[], due_at?, remind_at?.
- **Task extras:** waiting_on? (follow-up), recurrence? (Good-to-Have).
- **Note extras:** is_reference (knowledge).
- **Meeting extras:** starts_at, participants[], agenda?, outcome_notes?,
  generated_action_items[] (links to Tasks).

---

## 4. Organizing layer — Tags, Views, Projects

- **Projects (optional):** a single flat grouping. No sub-projects, no folders, no
  lists. An Item has at most one Project. Projects are created lazily.
- **Tags (flat, many-to-many):** the primary organizing tool. An Item can carry
  many tags (`#finance`, `#infosys`, `#high`). Tags cross project boundaries.
- **Saved Views (the "reports" of MVP):** named filters over Items. System views:
  **Inbox, Today, Upcoming, Aging, Waiting, Done, By Role.** Users can save custom
  views (any filter combo). Views are how users "navigate" — by intent, not by tree.

**Why tags+views beat folders/lists:** an Item lives in one place (or none) but
can be *seen* from many angles. This avoids the duplicate-board / naming-drift
failure of hierarchical tools while giving richer slicing.

---

## 5. Navigation & top-level surfaces (desktop-first)

A minimal left rail — each entry is a *view* or a *surface*, not a deep tree:

```
┌──────────────┐
│ ▸ Inbox      │  capture + untriaged items (badge = count to triage)
│ ▸ Today      │  committed work due/scheduled now  (the execution surface)
│ ▸ Upcoming   │  scheduled ahead
│ ─────────────│
│ ▸ Projects   │  optional groupings (flat list)
│ ▸ Views      │  saved filters (Waiting, Aging, per-client, by Role…)
│ ▸ Search     │  full-text
│ ─────────────│
│ ▸ People &   │  roles, members, assignments (admin)
│   Roles      │
└──────────────┘
Top bar: [Org switcher ▾]   [Quick capture]   [Daily Review]   [theme]
```

- **Quick capture** is always one keystroke away from anywhere (global shortcut).
- **Daily Review** is launched from the top bar (and via the daily nudge).
- **Org switcher** handles simplified multi-org.
- Mobile is Future; the same views collapse into a bottom nav later.

---

## 6. Multi-org placement

Each Organization is an isolated tenant (RLS). A user's memberships list drives the
switcher. MVP shows **one active org at a time**; there is no merged cross-org
view (that's Future). Roles, Projects, Items, Tags, and Views all live *within* an
org.

---

## 7. Scalability of a flat model (addressing the known risk)

Research warns that flat models strain at scale and can become an "overdue
graveyard." The IA mitigations:
- **Views + strong search are the navigation** — users never scroll a giant flat
  list; they filter.
- **The Daily Review caps the untriaged set** (age limits, Inbox → 0).
- **Tags provide multi-dimensional slicing** so large sets stay findable.
- **Performance:** indexing and pagination designed in the ERD/DB docs (later),
  with `organization_id` + common filter columns indexed.
- **Escape hatch:** if a specific large customer truly needs a second grouping
  level, add one *optional* "Space" above Project later — but only on evidence,
  never by default.

---

## 8. IA decisions summary (feeds the PDL)
- Inbox is a **state/view**, not a hierarchy level. *(Correction to the proposal.)*
- Required containment is only **Organization → Item**; **Project is optional**.
- **3 stored Item types** (Task, Note, Meeting); Reminder/Follow-up/Knowledge are
  metadata; Question is routed.
- Organize via **Tags + Saved Views**; no folders/lists/sub-projects.
- Navigation is **by view/intent**, not by tree.
