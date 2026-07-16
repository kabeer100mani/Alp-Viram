# M6 — MVP Completion (spec, for review)

**Status:** Draft for Palash's approval. **No code written.**
**Date:** 2026-07-16 · Grounded in the frozen Product Design Package (locked 2026-07-11).
**Scope ruled by Palash 2026-07-16** — see PDL-038 (renumbering) in the decision log.

---

## 1. Why this milestone exists

`PROJECT_PLAN.md` §8 says **M6 = Collaboration (comments, assignments, realtime)**.
That line **predates the 2026-07-11 freeze** and is contradicted by it:

| M6's line | What the frozen package actually says |
| --- | --- |
| Comments | Doc 4 → **Good to Have** ("MVP only if cheap"); PRD §7 → **Future** ("Deeper collaboration — comments, mentions") |
| Realtime | Doc 4 → **Future** ("Real-time collaboration / presence"); PRD `:143` → **explicitly NOT in the MVP** ("deep real-time collaboration") |
| Assignments | **Already shipped in M5** |

This is the third instance of the same trap (PDL-029 board views, PDL-031 assistant
depth). So M6 is **renumbered to "MVP completion"**: finish the **Doc 4 Must Haves
that are still unbuilt**, rather than start a milestone the freeze rejects.

**Every item below is a Doc 4 *Must Have*.** Nothing here is new product surface.

---

## 2. What is actually missing (verified on disk, not inferred)

| # | Must Have (Doc 4) | State today | Gate |
| --- | --- | --- | --- |
| 1 | **Tags (flat)** | `tags` + `item_tags` exist since migration `0002`, **fully hardened** — no module, no UI, zero references in `src/` | A |
| 2 | **Organization … renamable** | `orgs_update` RLS already allows `is_org_admin`; **no UI**. Only *role* rename exists | A |
| 3 | **Multi-org switcher** (PDL-009) | `useActiveOrg` **already fetches every org the user belongs to** and discards all but one; `active-org-store` persists the choice. **No switcher UI** | A |
| 4 | **Custom saved views** | `saved_views` RLS already supports per-user private views; `views/components/` contains **only** `ViewRail.tsx` | B |
| 5 | **Reminders (in-app)** (PDL-011) | `remind_at` is **queried nowhere in the codebase**; no UI writes or reads it | B |

**The good news:** items 1–4 need **no migration**. The schema and RLS were built
correctly and early; what is missing is genuinely the UI. Only item 5 proposes a
schema change, and only to make an existing column reachable.

---

## 3. The reminder bug — the one real functional hole

> **This is the most important finding in this spec.**

PDL-011: *"Reminders work inside the app (**Today/Due views**)."* They do not.

- `items.remind_at` exists, the AI contract populates it (`classification.ts`), and
  `createItem` stores it.
- **Nothing ever reads it.** `views-repository.ts` resolves the `due` window against
  **`due_at` only**.

So: *"Remind me to review GST tomorrow"* → captured, classified, `remind_at` set,
`due_at` null → once triaged out of the Inbox it appears in **no view at all**. The
reminder is stored and silently never surfaces. The centrepiece feature (AI Inbox)
can produce an item the app then loses.

### Proposed fix — decision needed (§7, D3)

**Recommended:** a generated column
`nudge_at = least(due_at, remind_at)` (Postgres `least()` ignores NULLs, so it means
*"the first moment this needs a human"*), indexed, with Today/Upcoming resolving
against `nudge_at` instead of `due_at`.

- **Why not `coalesce(due_at, remind_at)`:** due would win, so a task due Friday with
  a reminder on Tuesday would **not** surface on Tuesday — defeating the reminder.
- **Why not a query-layer `.or(...)`:** two nullable timestamps × two windows,
  composed with the other filters, is hard to read, hard to index, and impossible to
  sort by cleanly.
- **Why not a separate "Reminders" view:** PDL-011 explicitly puts reminders in the
  **Today/Due** views. A separate view would be a new surface the package didn't ask
  for, and would hide reminders from the view users actually live in.

---

## 4. Gate A — Tags · Org rename · Org switcher

**Ships:** an item can be tagged; an org can be renamed; a user can switch org.

### A1 · Tags
- New `src/modules/tags/` (repository + hooks), mirroring `lists/`.
- **Tag chips on the item row** (compact) and **tag editing in the TaskPanel**
  (add/remove/create-inline). Creating a tag while tagging — never a setup gate
  (PDL-005: capture forces nothing).
- Filter by tag from a tag chip. **Adds `tags: string[]` to the view-filter Zod
  contract** — additive, `.strict()` keeps old filters valid.
- **Permissions are already correct and must be preserved:** `p_tags` = any org
  member may create; `p_item_tags_write` requires **`can_write_item`** — so tagging
  an item follows the same responsibility rules as editing it. The UI must not offer
  a tag control where `canWrite` is false (the Doc 8 rule: never offer an action RLS
  will refuse).

### A2 · Organization rename
- Inline rename in the app header, **admin-only** (RLS already enforces
  `is_org_admin`; the UI must match it, not merely rely on it).
- Closes the live wart: a team currently sees **the admin's personal-org name**.
- **`slug` is NOT regenerated** — see D2.

### A3 · Multi-org switcher (PDL-009)
- A header dropdown listing the user's orgs; selecting one writes
  `active-org-store` and invalidates the query cache.
- **Cheap by construction:** `useActiveOrg` already returns every membership; today
  it throws the list away. The switcher surfaces what is already fetched.
- **One active org at a time** — PDL-009 explicitly rejects simultaneous cross-org
  views. Switching must fully re-scope; no cross-org bleed.

### A4 · TD-006 tag-along — stop displaying fake confidence
- The Inbox shows *"confidence 100%"* from a value that was `1.0` on 28/30 captures
  **including the misclassification**. It is not signal; displaying it as a
  percentage tells the user something untrue.
- **Remove the chip from the UI.** Keep **storing** `confidence` on `ai_captures` —
  the data stays for future calibration; only the false claim goes.
- Per the register: *"calibrate/derive it server-side, or stop displaying it."* This
  takes the second option. TD-006 → **RESOLVED**.

---

## 5. Gate B — Custom views · Reminder surfacing

### B1 · Custom saved views
- Create / rename / delete a custom view from the rail; edit its filter through a
  small form over the **existing** `viewFilterSchema` (states, types, due, aging,
  waiting, tags, groupBy, sort). No new filter dimensions beyond A1's `tags`.
- **Custom views are private to their owner** — this is what `saved_views` RLS
  already enforces (`p_views_read`: `is_system OR owner_id = auth.uid()`). Doc 4 asks
  for "system + custom" and says nothing about sharing, so **no sharing** (D4).
- System views stay read-only (`p_views_write` already blocks `is_system = true`).
- Every stored filter is **Zod-parsed before use** (TDL-010) — unchanged.

### B2 · Reminder surfacing (PDL-011)
- Migration: `nudge_at` generated column + index (see §3 / D3).
- Today + Upcoming resolve against `nudge_at`.
- **`remind_at` becomes editable** — a "Remind me" field in the TaskPanel quick
  fields, and a reminder indicator on the row (an item presenting as a *Reminder*
  already reads "Reminder" via `itemTypeLabel`, PDL-027).
- **Timezone discipline is non-negotiable (TD-005):** `remind_at` is an absolute
  instant; the client sends its IANA zone; windows resolve in the user's local day.
  This is the exact bug that once would have fired a 4pm IST reminder at 21:30 IST.
- **Still no delivery channels** — PDL-011 defers push/email/WhatsApp. In-app only.

---

## 6. What this milestone will NOT do

- **No comments, no realtime** (§1) — they need a PDL to enter MVP.
- **No notification delivery** (PDL-011 / Doc 4 Future).
- **No tag colours beyond the existing `tags.color`**, no tag hierarchy (PDL-010:
  tags are flat), no tag merge/rename-across-items beyond plain rename.
- **No cross-org combined view** (PDL-009 / Doc 4 Future).
- **No sharing of custom views** (D4).
- **TD-007, TD-003, TD-009 stay open** — ruled by Palash 2026-07-16.

---

## 7. Decisions I need from you

| # | Decision | My recommendation |
| --- | --- | --- |
| **D1** | **Tag delete.** `p_tags` lets **any org member hard-delete a tag**, cascading `item_tags` and stripping it from every item org-wide, with no undo. TD-001 set the precedent that hard-delete is wrong (items/roles retire instead). | **Restrict delete to admins for now** (UI-only; no migration). Full soft-delete = a new column + policy change; propose deferring that as debt unless you want it now. |
| **D2** | **Org rename and `slug`.** `organizations.slug` is `unique not null`. Rename could regenerate it. | **Leave `slug` stable.** Regenerating invites collisions and breaks any existing reference for a cosmetic gain. Rename changes `name` only. |
| **D3** | **Reminder surfacing mechanism** (§3). | **`nudge_at = least(due_at, remind_at)`** generated column. It is the only option that is indexable, sortable, and correct when an item has *both*. |
| **D4** | **Custom view sharing.** RLS makes them owner-private today. | **Keep private for MVP.** Doc 4 says "system + custom", not "shared"; sharing needs a policy change and a product decision about who may edit a shared view. |
| **D5** | **Gate A size.** A1+A2+A3+A4 is the larger gate; B is smaller. | **Keep as approved** — A's three pieces are independent and each self-contained; B's two both touch the view engine, so they genuinely share work. |

---

## 8. Verification plan

Held to the standard that has actually caught things (live red-team + browser
walkthroughs; unit tests mock the DB and caught none of the last four real bugs):

- `scripts/m10-tags-test.mjs` — **live tenant safety**: a member cannot tag an item
  they may not write (`can_write_item`); a tag cannot cross orgs (the composite FK);
  tag delete honours D1.
- `scripts/m10-mvp-walkthrough.mjs` — **browser**: tag an item → filter by it; rename
  the org → the header updates and the team no longer sees a personal-org name;
  switch org → the view fully re-scopes with **no cross-org bleed**; create a custom
  view → it persists and another user cannot see it.
- `scripts/m10-reminder-test.mjs` — **the regression that matters**: capture "remind
  me tomorrow" → it appears in **Today**. Asserted against the DB and in the browser,
  **in a non-UTC zone (IST)** so a timezone regression fails loudly (TD-005).
- Unit tests for the extended `viewFilterSchema` (tags) and `nudge_at` semantics.
- Full sweep before sign-off: typecheck · lint · unit · `m3` · `m7` · `m9` · the new
  m10 scripts. **Walkthroughs get re-run when a surface changes** — `m3-walkthrough`
  silently rotted for two milestones because that didn't happen.

> ⚠️ Script prefixes are **not** plan milestones (`m6-*` = structure reversal,
> `m9-*` = task panel). New scripts use `m10-*` to avoid deepening that confusion.

---

## 9. Size estimate

**Gate A ≈ 1.5 gates** of the earlier dense-table unit — three independent UI
features, no migrations, on schema that is already correct.
**Gate B ≈ 1 gate** — one small migration, one filter-form, and the reminder path.

Gate A carries the most user-visible payoff (tags are how PDL-010 says people
organise; the org name wart is on screen for every team). **Gate B carries the
actual bug** (§3).
