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
- **Verified (2026-07-15):** `scripts/m5-permission-test.mjs` now exercises the real
  service-role path with an `sb_secret_` key. With a positive control proving the key
  genuinely bypasses RLS, the service role **cannot** UPDATE or DELETE `activity_events`
  and the audit row survives both attempts. The earlier residual gap is closed.
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
- **Source:** M4 real-provider batch run (Gemini flash-lite).

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
- **Source:** M4 real-provider batch run (Gemini flash-lite).

## TD-007 — organization deletion is incomplete (layers 2 & 3)
- **What:** deleting an organization still fails. `0006` fixed **layer 1** (the
  owner-protection trigger blocking its own `organization_members` cascade — "cannot
  remove the last owner"). Two pre-existing layers remain:
  - **Layer 2:** the AFTER DELETE audit triggers on `item_responsible_roles` /
    `item_assigned_users` (`trg_log_irr`, `trg_log_iau`, from `0002`) insert
    `..._removed` events referencing the organization that has **already** been
    deleted → violates `activity_events_organization_id_fkey`. *(Current blocker.)*
  - **Layer 3:** behind it, `activity_events.item_id ON DELETE SET NULL` is an
    **UPDATE**, which the `0005` append-only guard refuses.
- **Why deferred:** there is **no user-facing organization delete**, so this is
  latent. Deliberate decision (Palash, 2026-07-15): stop at `0006` rather than keep
  rewriting production triggers in one sitting.
- **Impact:** organizations cannot be deleted at all. Blocks tenant offboarding and
  GDPR-style erasure when those are needed. **No security impact** — nothing is
  exposed; a destructive operation is refused.
- **Fix when:** before tenant offboarding / data-erasure is required.
- **Proposed fix (drafted and reviewed, not applied):** apply the same cascade test
  already proven in `0005`/`0006` — inside the transaction the parent row is already
  gone, which distinguishes teardown from normal operation:
  - in `log_responsible_role_change()` / `log_assigned_user_change()`: on `DELETE`,
    if the organization no longer exists, skip logging (the audit rows are cascading
    away in the same statement, so the event has no reader);
  - in `forbid_activity_event_mutation()`: allow the mutation when the organization
    no longer exists, permitting the teardown `SET NULL`. Live-org behaviour must stay
    unchanged — `activity_events` remains append-only, and the service role must still
    be unable to hard-delete an item.
- **Verified state:** `scripts/m5-permission-test.mjs` marks the 3 org-teardown checks
  as **known failures** (reported loudly; not counted as regressions). The `0005`
  guard's own cascade allowance is **not** in doubt — verified directly against an
  organization with no members.
- **Source:** found by `m5-permission-test.mjs` while verifying the `0005` audit guard.

## TD-004 — deferred tables need RLS + composite FKs when they ship
- **What:** `recurrence_rules`, `attachments`, `delegations` are designed but not yet
  created; each needs RLS and composite `(child_id, organization_id)` FKs when added.
  (`ai_captures` ships in M4 **with** RLS from the start.)
- **Fix when:** as each table ships.

## TD-008 — `items.project_id` had a plain FK (cross-tenant smuggling) — ✅ RESOLVED 2026-07-16
- **What:** `items.project_id` referenced `projects(id)` with a plain FK — nothing
  forced the project/list to belong to the item's own org, so a member could point
  their item at another tenant's list id. Same class as the 0003 red-team fix, which
  covered `item_tags` / `item_responsible_roles` / `item_assigned_users` /
  `item_collaborators` / `meeting_details` but **missed projects**.
- **Impact:** integrity hole; RLS still blocked *reading* the foreign row, so no data
  leak, but the reference itself was cross-tenant.
- **Fix (shipped, `0011`):** `projects` renamed to `lists`; the FK is now composite
  `(list_id, organization_id) → lists(id, organization_id)`, with any pre-existing
  cross-tenant references nulled explicitly. Fixed as part of the PDL-032 work since
  it rewrote that FK anyway.
- **Verified:** `scripts/m6-structure-test.mjs` — an item cannot reference another
  org's list; a list cannot move into another org's folder.
- **Source:** found while sizing the PDL-006 reversal (impact report, 2026-07-16).
