# Impact report — reversing PDL-006 (Folder → List → Task) + Checklists + Definition of Done

> **Assessment only. No code written, nothing changed.** Requested by Palash 2026-07-16.
> Resolved input: **"Workspace" = the existing Organization** (Personal / Profile 1 /
> Profile 2 are separate Orgs). No new top-level concept — that part costs nothing.

---

## 0. The headline

**Checklists and Definition of Done are cheap and uncontroversial** — no locked
decision opposes them; they were simply never captured. **Folder → List is
neither.** It reverses the product's stated core thesis, and the cost is mostly in
the *frozen design package*, not the database.

The three asks are not equal and should not be decided as one bundle.

---

## 1. What reversing PDL-006 actually collides with

This is not one decision. The flat model is asserted in **six** locked places:

| Where | What it says |
| --- | --- |
| **PDL-006** | *"Drop Folder and List. `Organization → (optional) Project → Item`."* Names **ClickUp's Workspace→Space→Folder→List→Task** as the rejected alternative. |
| **PDL-010** | *"Organize via Tags and Saved Views, **not hierarchy**."* |
| **PDL-005** | *"No Project/Folder/List/Priority/Label decisions forced **at capture**."* |
| **PRD `01:82`** | Guiding principle: *"**Flat over deep.** Organize with tags and saved views, not nested folders."* |
| **PRD `01:44-47`** | The **problem statement**: *"Deep nesting (workspace → space → folder → list → task)"* is named as the friction the product exists to remove. |
| **Doc 4 — Rejected** | *"**Deep hierarchy** (Space/Folder/List/nested projects)"* — rejected by name. |
| **Doc 5 §2b** | The structural model: *"the **only required containment** is `Organization → Item`."* |

**The honest framing:** the PRD's *problem statement* cites the exact structure now
being asked for as the thing Alp-Viram exists to fix. Reversing it isn't a schema
tweak — it's a **strategic pivot on the product's premise**. That is legitimately
Palash's call (lived use beats a document), but it should be a **recorded,
deliberate reversal**, not a quiet migration.

### The middle path worth knowing about
The locked docs reject **mandatory, deep** filing. They do **not** reject optional
grouping — `Project` is already exactly that. If **List stays optional** (an item
can still be captured with no list, landing in the Inbox), then:
- **PDL-005 survives untouched** (nothing forced at capture)
- **PDL-016 / the AI Inbox premise survives** (capture-first still works)
- The conflict narrows to **PDL-006 + PDL-010 wording** and the "Flat over deep" principle

If List is **mandatory**, capture-first breaks and the AI Inbox loses its point.
**This single choice — optional vs mandatory — drives most of the cost below.**

---

## 2. A structural question that must be answered first

`Project` already exists as a flat, optional grouping (shipped, with `items.project_id`).
Adding Folder → List gives **three** grouping concepts unless something folds in:

| Option | Shape | Cost | Note |
| --- | --- | --- | --- |
| **A. Rename** | `Folder → List` where **List = today's Project renamed**, Folder added above | **Lowest.** Reuses the shipped table + FK + triage chip | Data survives; one rename migration + one new parent table |
| **B. Add alongside** | Org → Folder → List → Item, **and** Project stays | Highest, and confusing | Three overlapping groupings; not recommended |
| **C. Replace** | Drop Project entirely, new Folder + List | Medium; discards a shipped, RLS'd table | Needs data migration if any projects exist |

**Option A is by far the cheapest** and matches the ClickUp mental model
(Folder → List → Task). This needs Palash's ruling before any sizing is real.

---

## 3. What would change

### 3a. Frozen documents (the largest hidden cost)
Locked 2026-07-11; each change needs an explicit change request + new PDL:
- **Supersede PDL-006** (new PDL recording the reversal + why)
- **Amend PDL-010** (tags/views *and* hierarchy, not *instead of*)
- **Amend PRD `01:82`** principle, and reconcile the **problem statement `01:44-47`**
- **Remove/qualify** the Doc 4 "Deep hierarchy" Rejected row
- **Rewrite Doc 5 §2b** (structural model) **and §5** (the rail)
- **Update ERD + DB design** (new entities, new columns)
- Docs 8/9 (permissions, responsibility) are **unaffected** — they key off
  `organization_id` and `can_write_item`, both orthogonal to grouping ✅

### 3b. Database (migration `0010+`)
- `folders` (org_id, name, position, is_archived, …) + RLS + `(id, organization_id)` unique
- `lists` (org_id, **folder_id**, name, position, is_archived, …) + RLS + composite FK to folder
- `items.list_id` (nullable if optional) + composite FK
- **Composite FKs are mandatory** per the `0003` red-team pattern — see §5
- Retire-not-delete semantics (TDL-009) for folders/lists, as with roles
- `checklist_items` (org_id, item_id, text, is_done, position) + RLS + composite FK
- **Definition of Done**: either `items.definition_of_done text` (cheap) or a
  structured/enforced variant (see §4)

### 3c. Code
- Regenerate `database.types.ts`
- `items-repository`: carry `list_id`
- **View engine**: new filter dimensions (`listId`, `folderId`) → extend the Zod
  contract (`view-filter.ts`) + `runView`. System views unaffected
- **Rail**: today's `Projects` entry is a **disabled placeholder** — it becomes a
  real Folder → List **tree**. This is the single biggest UI piece, and it is the
  one thing Doc 5's rail was explicitly designed *not* to have
- **Triage chip**: `Project` chip → `List` chip (small — the mechanism exists)
- **AI**: the classification contract has **no project/list field today** — the AI
  never infers grouping. Two choices:
  - *Leave AI out of it* (list set at triage/manually) → **near-zero AI cost**
  - *Have AI infer the list* → new contract field + prompt + Zod + **all three
    provider schemas** + batch-test expectations + a re-run against real Gemini
- **Checklist UI** on the card; **DoD** field UI
- Tests: unit + a **red-team for the new cross-tenant FKs** + browser walkthrough

---

## 4. Definition of Done — what it means changes the cost
| Interpretation | Cost |
| --- | --- |
| **A free-text field** on an item | **Small.** One column + one textarea |
| **A checklist marked as the DoD** (reuse `checklist_items` with a flag) | **Small-medium.** No new table |
| **Enforced** (cannot mark Done until DoD is satisfied) | **Medium.** Touches the completion path, the card, triage's 2-minute Done, and needs a DB CHECK/trigger to be real rather than cosmetic |

Palash's intent here is unstated. **Enforced** is a materially different product
decision from a note field.

---

## 5. A real defect this surfaced (independent of the decision)

`items.project_id` has a **plain FK to `projects(id)` with no `(id, organization_id)`
composite** — the exact cross-tenant smuggling pattern migration `0003` fixed for
`item_tags`, `item_responsible_roles`, `item_assigned_users`, `item_collaborators`
and `meeting_details`. **Projects were missed.** A member could point their item's
`project_id` at another org's project id. Impact is limited (RLS still blocks
*reading* that project), but it is an integrity hole of the same class the red-team
already closed elsewhere.

**Relevance:** Folder/List multiply this pattern. If we build the hierarchy, the
new FKs must use the composite form — and this existing gap should be fixed in the
same migration. **Recommend logging it as TD-008 regardless of what is decided here.**

---

## 6. Effort

Sized in **gates**, comparable to M5's (each = build + red-team + browser + review).

| Work | Size | Notes |
| --- | --- | --- |
| **Checklists** | **~½ gate** | One table, card UI, tests. No locked decision opposes it |
| **Definition of Done** (field or DoD-checklist) | **~¼ gate** | Small — unless **enforced**, then ~½–1 gate |
| **Folder → List, Option A (rename Project→List + add Folder), optional** | **~2 gates** | Migration + RLS/composite FKs + rail tree + triage chip + view filters + tests |
| **Folder → List, Option B/C (alongside / replace)** | **~3 gates** | Plus data migration and de-confusing three groupings |
| **Mandatory List** (instead of optional) | **+~½ gate** | Plus it breaks capture-first — see §1 |
| **AI infers the list** | **+~½ gate** | New contract field across 3 providers + real-model re-test |
| **Frozen-doc rework** (PDLs, PRD, Docs 4/5, ERD, DB design) | **~1 gate** | Not code. Needs Palash's sign-off, and is the real gate on this |

**Rough total for the full ask, cheapest viable path (Option A, optional list, no AI
inference, DoD as a field):** **≈ 4 gates** — comparable to M5 end-to-end.
**Most expensive path:** ≈ 6+ gates.

**Cheapest high-value slice:** Checklists + DoD ≈ **¾ of a gate**, zero doc conflict,
and independently useful whatever is decided about hierarchy.

---

## 7. What I need from Palash

1. **Is this a deliberate pivot?** The PRD names this exact structure as the problem
   the product exists to solve. Reversing it is his call — but it should be recorded
   as a strategic reversal, with the reasoning, not slipped in.
2. **Optional or mandatory List?** (Drives whether capture-first/AI Inbox survives.)
3. **Option A / B / C** for reconciling the existing `Project`?
4. **Definition of Done: a note field, or enforced?**
5. **Should the AI infer the list**, or is grouping a human/triage step?
6. **Split the bundle?** Checklists + DoD are cheap and conflict-free; the hierarchy
   is the expensive, thesis-level one. They need not ship together.
