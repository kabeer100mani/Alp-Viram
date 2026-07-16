# Alp-Viram

> Persistent project context for Claude Code. Keep this file up to date as milestones complete or decisions are made (standing instruction from Palash — no need to be asked each time). Last updated: 2026-07-15.

## Project Overview
- Alp-Viram is an **AI-first work management platform** built around **minimizing user effort above all else**.
- The **AI Inbox** is the primary differentiating feature.
- The **design package is locked and frozen as of 2026-07-11**. No changes to it without explicit sign-off.

## Tech Stack
- **Vite** (frontend build)
- **Supabase** (backend / DB / auth / Edge Functions)
- **shadcn/ui** (component library)
- **TanStack Query** (server state)
- **Zustand** (client state)
- **Zod** (schema validation)

## Data Model
- Three stored item types: **Task, Note, Meeting**.
- **Hybrid responsibility model** for permissions/ownership.
- **Provider-agnostic AI contract**, validated via **Zod before any AI output is trusted** — no AI response bypasses validation.

## Architectural Decisions
_(Already made — do not revisit without discussion.)_
- **Hosted Supabase** chosen over local Docker.
- **Edge Functions** are the primary path for privileged actions; **RLS is defense-in-depth**, not the sole control.
- The **`activity_events` table is append-only** (intent: PDL-018 / TDL-004). ⚠️ *Accuracy note:* this was **not** enforced from the first migration — `0002` allowed client INSERTs and `0003` removed that policy. It is enforced **against clients** today, but **not against the service role** (see TD-002), so "append-only" is not yet fully true.
- **AI provider — currently ACTIVE: Gemini** (`AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-flash-lite-latest`), chosen **on cost grounds** (free tier) while Anthropic is unfunded. **Anthropic/Claude remains the intended long-term provider**; its code path is implemented but unvalidated pending credits. Swapping is an `AI_PROVIDER` secret change + redeploy — no app changes (proven across three providers in M3).

## Milestone Status
> **Numbering corrected 2026-07-16 (Palash).** The AI Inbox was previously labelled "M3"; it is the plan's **M4 (AI layer)** — `docs/PROJECT_PLAN.md` §7 and its Revised milestone note both say M4, as do `src/lib/ai/types.ts` and `provider.ts`. The plan's real **M3 (Workspace UI) was skipped** and is next. The Permission Model is **not** in the plan's roadmap (permissions were folded into M1); it is recorded as an unnumbered milestone.

- **M0** — foundation (tooling, config, structure, themed app shell): **COMPLETE**
- **M1** — identity, multi-tenant foundation, RLS + isolation tests: **COMPLETE**
- **M2** — core domain schema (items, roles, assignments, activity_events, meeting_details): **COMPLETE**
- **M3 — Workspace UI**: **Gate A APPROVED (2026-07-16); Gate B built & verified, awaiting sign-off.** See [M3 spec](docs/M3-workspace-ui-spec.md).
  - **Gate A** (`3358b02`): view engine (Zod-validated saved-view filters, TDL-010) · write path (none existed before) · intent-based rail · 7 system views seeded (`0007`) · one-action item cards · `writable_item_ids` RPC (`0008`).
  - **Gate B** (`fd45618`): **Daily Review** (rollover → grouped triage → "Inbox clear", 5–10 min target) · **Search** (full-text over the `items.search` tsvector) · theme persistence verified.
  - **No board view** (**PDL-029**) — `PROJECT_PLAN.md`'s "board views" line predated the 2026-07-11 freeze and contradicted Doc 5, which rejects boards by name; the roadmap line is corrected. **Daily Review + Search in M3** (**PDL-030**).
  - Fixed three shipped violations of the frozen package: `HomeScreen` showed org/role to solo users (PDL-022), `ItemList` printed the raw `item_state` enum (PDL-027), `AppShell` had no rail.
  - Verified: **browser walkthrough 32/32** (`node scripts/m3-walkthrough.mjs`, needs `npm run dev`) · live check that the UI never offers an action RLS refuses. ⚠️ This walkthrough had been **stale since PDL-034** — it drove the deleted `ItemCard`'s Done button and failed on step 5; it was not re-run when the card became a table. Now updated to the row's Status control. **Re-run the browser walkthroughs whenever a surface is replaced** — unit tests mock the DB and caught none of this.
  - ⚠️ The "≤3 interactions / ≤10s capture" figures in Doc 6 are **not a spec** — PDL-026 defers targets until after the prototype. The only frozen number is **Daily Review 5–10 min**.
  - Not built (Good-to-Have, "only if cheap"): duplicate detection/merge in triage, AI auto-grouping beyond type, drag-to-calendar timeboxing. **Projects** and **People & Roles** rail surfaces remain unbuilt (Projects sits disabled).
- **M4 — AI Inbox / AI layer**: **COMPLETE — validated on Gemini `flash-lite`** (accepted at gate by Palash 2026-07-15). *(Previously mislabelled M3.)*
- **M5 — People & Roles + Responsibility**: **BUILT & VERIFIED across three gates, awaiting final sign-off.** Spec [docs/M5-people-roles-spec.md](docs/M5-people-roles-spec.md); report [docs/M5-milestone-report.md](docs/M5-milestone-report.md). Chosen over the roadmap's "assistant depth" (Future scope) — PDL-031. This makes the responsibility differentiator (enforced since the Permission Model milestone) finally **reachable** in the UI.
  - **Gate A** (`dd07de1`): link/token invites (migration `0009` + `invitations` Edge Function; email deferred, PDL-011), Members list, `/invite` accept, persisted **active-org** primitive ([active-org-store.ts](src/modules/organizations/active-org-store.ts); seed of the PDL-009 switcher).
  - **Gate B** (`2f4fa40`): roles (create/rename/retire) + time-bounded assignments + By Role grouping.
  - **Gate C** (`0410aa0`): responsibility on the item card (Responsible Roles / Assigned Users / Collaborators; "UNFILLED — needs owner"; derived holder), live triage Role chip, solo-invite escape hatch (closes the Gate A deadlock), role rename.
  - Verified live: `m5-invite-test` 12/12, `m5-roles-test` 12/12 (incl. **handover moves responsibility with zero item-row changes**), `m5-responsibility-test` 7/7 (responsibility follows `can_write_item`), `m5-invite-walkthrough` 20/20 (two-user browser), 57 unit tests.
  - **Edge Functions now**: `classify-capture`, `invitations` (both `verify_jwt=true`; `npm run deploy:function` deploys both + JWT guard).
  - **Known gaps**: org rename unbuilt (team sees admin's personal-org name); no member-removal/role-change UI; point-in-time responsibility read model deferred; delegations (TD-004) not built.
- **Permission Model** (unnumbered — not in the plan's roadmap): **COMPLETE**, accepted at gate 2026-07-15. Migration `0005_permission_hardening.sql` (applied): access control keyed to the hybrid responsibility model. Closes **TD-001**, **TD-002**, and implements **TDL-012** (the derivation — previously the log's only *Proposed* decision).
  - Write = org admin **or** creator (PDL-021) **or** assigned user **or** current holder of a responsible role (derived, time-bounded). Collaborators get no write. **Read deliberately unchanged** (org-wide; fine-grained visibility stays deferred).
  - Verified: `node scripts/m5-permission-test.mjs` — **22 passing + 3 known failures (TD-007)**; incl. time-bounded revocation, self-assignment escalation, and the service role being unable to rewrite the audit log. `m1-isolation-test.mjs` still 14/14. Migration `0006` additionally fixed a pre-existing bug (org delete blocked by its own owner-protection trigger).
  - **DB access note:** `db.<ref>.supabase.co` is **IPv6-only** and unreachable from this environment (TD-003). Use the IPv4 session pooler — `PGHOST`/`PGPORT`/`PGUSER` in `.env` are set to it; apply migrations with `node scripts/db-apply.mjs <file>`.
  - Documented **after** implementation: [Doc 8 — Permission Model](docs/technical/08-permission-model.md), [Doc 9 — Responsibility Model](docs/technical/09-responsibility-model.md).
### M4 — AI Inbox (detail)
Pipeline and provider-agnosticism proven; **explicitly NOT Anthropic-verified**. See [M4 milestone report](docs/M4-milestone-report.md).
  - Accepted run, `gemini-flash-lite-latest`: 30/30 classified, **30/30 Zod-valid**, 30/30 stored + read back, **29/30 correct type (97%)**. Zero task-vs-meeting disagreements. The one miss — "Idea: add dark mode to the app" → task (expected note) — is **adjudicated as a genuine miss**, not a defensible call.
  - Partial run, `gemini-flash-latest` (fuller Flash): 16/30 — 16/16 correct, 16/16 Zod-valid — truncated by the free-tier **daily** request quota.
  - **Anthropic re-test still PENDING FUNDING.** The Anthropic code path has never had a successful real run (account has no credits). Re-test when funded — M4 is not evidence about Claude's accuracy.
  - Providers supported in the Edge Function: `anthropic` | `gemini` | `mock`, via the `AI_PROVIDER` secret. `verify_jwt = true` is pinned in `supabase/config.toml`.

## Structure reversal (PDL-032/033, 2026-07-16)
- **PDL-006 was reversed** at Palash's direction (recorded, not silent): `Organization → Folder → List → Item` is back, **optional** — "Workspace" = the existing Organization (Personal / Profile 1…). Cheapest path: `projects` renamed to `lists`, `folders` added above. `list_id`/`folder_id` are nullable — **capture stays zero-click**; the AI does **not** infer the list. Amended docs: PDL-006 (superseded), PDL-010, PRD §problem-statement + "Flat over deep", Doc 4 Rejected row, Doc 5 model.
- **Checklists + Definition of Done** added (PDL-033). DoD is a **note field, not enforced**. Neither applies to Notes.
- **TD-008 fixed** (was a real cross-tenant FK gap on `items.project_id`; migration `0011` composite FK). **Audit-trigger regression** from the rename fixed in `0013` (`log_item_change` still named `project_id`, breaking every item write — caught by the live red-team, invisible to unit tests).
- Migrations `0010`–`0013`. Tests: `scripts/m6-structure-test.mjs` (15/15 live tenant-safety), `scripts/m6-structure-walkthrough.mjs` (12/12 browser). See [impact report](docs/impact-hierarchy-reversal.md).

## Container hierarchy — Project → Folder → List (PDL-035, 2026-07-16)
- **Full ClickUp-style nesting:** `Organization (= Workspace) → Project → Folder → List → Item`. **Corrects PDL-032**, which had collapsed Project into List on my (wrong) recommendation. Migration `0015` adds `projects` (org-level), re-parents Folder (`folders.project_id`) and List (`lists.project_id`); a List may be folderless (directly under a Project). Subtasks skipped.
- **Everything optional** — capture stays **zero-click** (a task needs no List → Inbox; a List needs no Folder). Filing happens in Daily Review or manually, never forced.
- **List ≠ Checklist:** a List holds Tasks; a Checklist is sub-steps inside one Task. The row-expand keeps them in separate labelled sections, and the DoD is shown directly (no longer buried).
- Rail is a 3-level tree (`ListTreeNav`): Projects/Folders expand; only **Lists** are selectable (tasks live in Lists). Verified: `scripts/m8-hierarchy-test.mjs` (10/10 live: tenant + cross-project integrity, folderless, optional), `scripts/m8-hierarchy-walkthrough.mjs` (6/6 browser).

## Dense table layout (PDL-034, 2026-07-16)
- **The item card is replaced by a dense, table-style layout** (`ItemTable` + `ItemRow`), used by **every** view. ⚠️ **Amended by PDL-036 below:** columns are now Name · Assignee (avatar-only, team-only, PDL-022) · Priority · Due date · Status — **Start moved off the row into the panel**, and the **row-expand no longer exists**. **Priority/Due/Status still edit inline in the row.** Items render in **collapsible groups with counts** (By Role → by role; every other view → by List). Old `ItemCard`/`ItemList` **deleted**.
- `start_at` promoted from *Future* to a real nullable column (migration `0014`); it was the one requested column with no existing field. Batched **`item_assignee_summary`** RPC feeds the Assignee column in one call (not per-row). Plan: [docs/plan-dense-table-view.md](docs/plan-dense-table-view.md).
- Verified: `scripts/m7-table-walkthrough.mjs` (13/13 browser: grouping, inline edits persist, row-expand, solo hides Assignee), 56 unit tests.

## Task detail side-panel (PDL-036, 2026-07-16)
- **The row-expand is replaced by a slide-in task detail panel** (`TaskPanel`), opened by clicking a task's **name**. It does **not** navigate away — the list stays mounted; Escape, the close button and the scrim all dismiss it. Contents: inline-editable title · quick fields (Status + complete checkmark, Dates start→due, Priority, **Time estimate**, List) · description (mapped to the existing `items.body`) · a **Fields** section (Checklist + Definition of Done, both shown directly) · a read-only **Activity** feed.
- **UI only** — every write goes through the same hooks the row used, so `writable_item_ids`/RLS and Zod validation are unchanged, and no editor is offered that the DB would refuse.
- `time_estimate_minutes` promoted from *Future* to a real nullable column (migration `0016`, `>0` + not-on-a-Note checks). It is an **estimate** (planned duration, entered "2h 30m") — **time tracking is still rejected**.
- **Activity is read-only; comment-writing deferred.** It renders `activity_events` through `activityLabel()` (never the raw enum, PDL-027). ⚠️ **Field edits are not logged at all** (no such event type exists) → **TD-009**; the feed shows creation/state/completion/list-moves/responsibility/tags only.
- Free-text fields (title, description, estimate) save on **blur** and are deliberately **not** disabled while other saves are in flight — disabling mid-typing silently dropped keystrokes (caught by the walkthrough).
- Verified: `scripts/m9-panel-walkthrough.mjs` (**27/27** browser, incl. every quick field persisting to the DB and a **geometry check** that no field is clipped — the first cut rendered Due half outside the panel while every value assertion still passed), 61 unit tests.

## Dates and enums must never reach the user raw (2026-07-16)
Three bugs Palash caught by *looking* at the screen, all invisible to green tests:
- **A bare `<input type="date">` prints the browser's own "dd-mm-yyyy" placeholder** as literal text when empty (clipped to "dd-mm-yy" in a narrow cell), and a raw "2026-08-20" when set. Use **[DateCell](src/modules/items/components/DateCell.tsx)** — it shows `formatDate()` (or a quiet hint) and swaps in the input only while editing. Native date inputs are kept **only** in the TaskPanel form. The same bug was live on the **Daily Review triage chip**, where empty is the *common* case.
- **Raw ISO / raw enums must go through [presentation.ts](src/modules/items/presentation.ts)** (`formatDate`, `priorityLabel`, `itemStateLabel`, `itemTypeLabel`, `activityLabel`) — PDL-027. The AI proposal card printed `Due 2026-07-16` on the primary capture path, and a **unit test asserted that ISO string**, pinning the bug.
- **`priority: none` labelled `—`** rendered as a stray dash between the flag and the dropdown arrow; display labels are not prescribed by the frozen docs (only the enum values are), so it now reads "None". The select's native arrow is gone; the cell shows one clean flag + label.
- **Still open (found by audit, awaiting Palash's styling direction):** bare `—` for empty assignee ([ItemRow.tsx](src/modules/items/components/ItemRow.tsx)) and for read-only dates/estimate ([TaskPanel.tsx](src/modules/items/components/TaskPanel.tsx)); `{m.role}` rendered raw in [PeopleScreen.tsx](src/modules/people/components/PeopleScreen.tsx) — masked by `capitalize` today, but there is **no `roleLabel()` helper**, so it has no label path.

## UI Style Rules
- **No ALL-CAPS text anywhere.** Everything is **Proper Case**; the only exception is the app name ("Alp-Viram"). Never use the Tailwind `uppercase` class. DB-lowercase values (e.g. member `role`) render with `capitalize`. *(Palash, 2026-07-16.)*

## Deploy Safety Notes
- **Never deploy Edge Functions with `--no-verify-jwt`** without an explicit, logged exception. On 2026-07-15 that flag was used by mistake and briefly left `classify-capture` open to unauthenticated requests; fixed by pinning `verify_jwt = true` in `supabase/config.toml`.
- **Deploy via `npm run deploy:function`** — the JWT guard runs automatically, chained to the deploy (`deploy && npm run check:jwt-guard`). The guard ([scripts/check-jwt-guard.mjs](scripts/check-jwt-guard.mjs)) probes `classify-capture` unauthenticated; if it doesn't get a **401** the chained command fails loudly with a non-zero exit (failure is not swallowed).

## Technical Debt Register
**Canonical register: [docs/technical/TECHNICAL_DEBT.md](docs/technical/TECHNICAL_DEBT.md)** — always add new debt there (never invent IDs here; they collided once already). Summary only:
- **TD-001** — ✅ **RESOLVED 2026-07-15** (migration `0005`): hard-delete revoked on `items`/`roles`/`role_assignments`; retire via `deleted_at`/`is_active`/`valid_to`.
- **TD-002** — ✅ **RESOLVED 2026-07-15** (migration `0005`): `activity_events` guarded by a `BEFORE UPDATE/DELETE` trigger. **Verified against the real service role** (`sb_secret_` key, with a positive control proving it bypasses RLS): it cannot UPDATE or DELETE audit rows.
- **TD-007** (open, 2026-07-15): **organization deletion is incomplete.** `0006` fixed the last-owner block; the `0002` audit triggers (FK violation) and the `item_id SET NULL` cascade still block teardown. No security impact; blocks offboarding/GDPR erasure. Fix drafted in the register. `m5-permission-test.mjs` marks 3 checks as **known failures**.
- **TD-003** (open): Supabase client is untyped (`getSupabaseClient()` not parameterised with `<Database>`).
- **TD-004** (open): deferred tables (`recurrence_rules`, `attachments`, `delegations`) need RLS + composite FKs when they ship.
- **TD-005** — ✅ **RESOLVED 2026-07-15**: AI naive/timezone-less datetimes caused a real time-shift risk (a 4pm IST reminder would have fired at 21:30 IST). Fixed: client sends IANA timezone, Edge Function resolves in the user's zone + normalises, Zod now requires `z.iso.datetime({ offset: true })`. Verified 4/4 in IST; 6 unit tests pin it.
- **TD-006** (open): `confidence` is degenerate on Gemini `flash-lite` (1.0 on 28/30 *including the miss*) — unusable for triage though the UI shows it.
- **TD-009** (open, 2026-07-16): **field edits are not audited** — no `activity_event_type` covers a title/priority/date/description change, so the PDL-036 Activity feed cannot show them. No security impact; fix when the audit schema is next opened.

## Tools & Resources
- **Supabase project ref**: `jdngjwspqxhpkmqhcekc`
- **Supabase URL**: https://jdngjwspqxhpkmqhcekc.supabase.co
- **IDE**: VS Code with the Claude Code extension.

## Working Relationship Notes
- **Palash** is a **non-technical founder acting as Product Architect**.
- Reviews output at **milestone gates** before approving progression.
- **Always explain terminal/dashboard actions in plain language** with exact step-by-step commands.
- **Provide ready-to-use prompts** — don't assume Palash will write his own.

## Next Steps On The Horizon
1. **CURRENT: the Permission Model milestone** — ⚠️ **it has no written spec yet.** `docs/PROJECT_PLAN.md` has no such milestone (permissions were folded into M1), and **Doc 8 (Permission Model) / Doc 9 (Responsibility Model) do not exist on disk** despite ~10 references treating them as the design of record. Scope must be agreed with Palash before implementation. Known in-scope debt: **TD-001** (hard-delete) and **TD-002** (audit immutability vs service role). The big unbuilt piece is **TDL-012** — the derived "who is responsible now" function/view, still the only *Proposed* decision in the technical log.
2. **When Anthropic is funded**: set `AI_PROVIDER=anthropic`, `npm run deploy:function`, re-run `node scripts/m3-classify-test.mjs` for a Claude accuracy read (M3 says nothing about Claude's accuracy today).
