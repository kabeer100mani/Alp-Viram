# Technical Debt Register

Deliberately deferred work, tracked so it is revisited on purpose — not forgotten.
Each entry: **what · why deferred · impact · fix when · source.**

## TD-001 — `items` allow hard-delete (soft-delete intended) — ✅ RESOLVED 2026-07-15
- **What:** RLS on `items` permitted `DELETE` for any org member (`FOR ALL`). The
  design intends soft-delete via `deleted_at`; hard-delete eroded `activity_events`
  linkage (`item_id` → set null) and cascaded child rows.
- **Fix (shipped, `0005_permission_hardening.sql`):** `FOR ALL` split into explicit
  SELECT/INSERT/UPDATE policies with **no DELETE policy** (RLS is deny-by-default) on
  `items`, `roles` and `role_assignments`. Retire via `deleted_at` / `is_active` /
  `valid_to` (TDL-009).
- **Verified:** `scripts/m5-permission-test.mjs` — even the creator/admin cannot
  hard-delete; soft-delete succeeds.
- **Source:** RLS red-team audit, finding #7. See [Doc 8](08-permission-model.md).

## TD-002 — `activity_events` append-only not enforced vs the service role — ✅ RESOLVED 2026-07-15
- **What:** append-only held for clients (RLS select-only; client insert removed in 0003),
  but the service role / table owner could still `UPDATE`/`DELETE`.
- **Fix (shipped, `0005_permission_hardening.sql`):** `BEFORE UPDATE OR DELETE` guard
  trigger — triggers run for every writer, including `BYPASSRLS` roles. Allows the
  organization-delete cascade (parent already gone).
- **Deviation from the original suggestion:** `force row level security` was
  **deliberately not applied** — it does not constrain `BYPASSRLS` roles (so it would
  not close this hole) and, with no INSERT policy, would risk blocking the SECURITY
  DEFINER audit triggers. Rationale in [Doc 8 §5](08-permission-model.md).
- **⚠️ Residual gap:** the service-role path is **not exercised by a test** (no service
  key available locally). The client surface is verified; the trigger itself is not.
- **Source:** RLS red-team audit, finding #3.

## TD-003 — Supabase client is untyped
- **What:** generated DB types are used at the repository boundary, but
  `getSupabaseClient()` is not parameterized with `<Database>` (no query-result
  inference; nested-select relationships untyped).
- **Why deferred:** the Supabase CLI `gen types` won't connect from this environment
  (SSL/IPv6); our `pg`-based generator emits Row/Insert/Update/Enums but no FK-relationship
  metadata.
- **Impact:** less end-to-end type safety on queries; manual casts at boundaries.
- **Fix when:** when the CLI works (CI/local) or the generator is extended with
  relationships; then pass `<Database>` to `createClient`.

## TD-005 — AI returned naive (timezone-less) datetimes — ✅ RESOLVED 2026-07-15
- **What:** providers returned `due_at`/`remind_at` as naive wall times
  (e.g. `2026-07-20T16:00:00`). The Zod contract only checked `string`, so they
  passed validation and were read as **UTC** by `timestamptz` — shifting a user's
  time by their whole offset (a 4pm IST reminder would fire at 21:30 IST).
- **Fix (shipped):** client sends its IANA timezone; the Edge Function resolves
  relative dates in the user's local zone, demands offset-qualified ISO in the
  prompt, and normalises any residual naive value to an absolute instant. The Zod
  contract now requires `z.iso.datetime({ offset: true })`, so a naive value is
  rejected rather than silently corrupted.
- **Verified:** 4/4 previously-naive captures return `+05:30` and render back at
  the intended local wall time; 6 unit tests pin the gate.
- **Source:** M3 real-provider batch run (Gemini flash-lite).

## TD-006 — `confidence` is degenerate (no signal)
- **What:** on Gemini `flash-lite`, `confidence` was `1.0` on 28/30 captures —
  **including the one misclassification**. The Inbox UI surfaces it as
  "confidence 100%".
- **Why deferred:** cosmetic today; the field is displayed but not yet used for
  routing or thresholds.
- **Impact:** the value is misleading to users and **cannot be used for triage**
  or auto-accept thresholds — any future feature keying off it would be unsound.
- **Fix when:** when confidence is needed for behaviour — calibrate/derive it
  server-side, or stop displaying it.
- **Source:** M3 real-provider batch run (Gemini flash-lite).

## TD-004 — deferred tables need RLS + composite FKs when they ship
- **What:** `recurrence_rules`, `attachments`, `delegations` are designed but not yet
  created; each needs RLS and composite `(child_id, organization_id)` FKs when added.
  (`ai_captures` ships in M3 **with** RLS from the start.)
- **Fix when:** as each table ships.
