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
  - Verified: 48 unit tests · **browser walkthrough 28/28** (`node scripts/m3-walkthrough.mjs`, needs `npm run dev`) · live check that the UI never offers an action RLS refuses.
  - ⚠️ The "≤3 interactions / ≤10s capture" figures in Doc 6 are **not a spec** — PDL-026 defers targets until after the prototype. The only frozen number is **Daily Review 5–10 min**.
  - Not built (Good-to-Have, "only if cheap"): duplicate detection/merge in triage, AI auto-grouping beyond type, drag-to-calendar timeboxing. **Projects** and **People & Roles** rail surfaces remain unbuilt (Projects sits disabled).
- **M4 — AI Inbox / AI layer**: **COMPLETE — validated on Gemini `flash-lite`** (accepted at gate by Palash 2026-07-15). *(Previously mislabelled M3.)*
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
