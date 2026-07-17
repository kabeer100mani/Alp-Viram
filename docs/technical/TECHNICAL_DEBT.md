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

## TD-006 — `confidence` is degenerate (no signal) — ✅ RESOLVED 2026-07-16
- **What:** on Gemini `flash-lite`, `confidence` was `1.0` on 28/30 captures —
  **including the one misclassification**. The Inbox UI surfaced it as
  "confidence 100%", telling the user something untrue about a wrong answer.
- **Resolution (M6 Gate A, D1-adjacent, ruled by Palash):** took the register's
  second option — **stop displaying it**. The chip is removed from `AiCaptureBox`;
  `confidence` is **still written** to `ai_captures` (unchanged) so a future
  server-side calibration can use the history. Pinned by an `AiCaptureBox` test
  asserting no "confidence" text renders while the persist path still stores it.
- **If confidence is ever needed for behaviour** (auto-accept thresholds, triage
  routing): calibrate/derive it server-side first — the raw model value is not
  signal and must not gate anything.
- **Source:** M4 real-provider batch run (Gemini flash-lite); resolved in M6.

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

## TD-010 — tags hard-delete (soft-delete deferred)
- **What:** `tags` has no `deleted_at` / `is_active`; deleting a tag is a **hard
  delete** that cascades `item_tags` and strips the tag from every item in the org,
  with no undo. This is the same class TD-001 closed for `items` / `roles` /
  `role_assignments`, which retire via `deleted_at` / `is_active` / `valid_to`
  instead of being destroyed.
- **Mitigation shipped in M6 Gate A (D1, ruled by Palash 2026-07-16):** delete is
  **restricted to org admins** in the UI. This narrows *who* can do it; it does not
  make it recoverable, and the RLS policy `p_tags` (`ALL` for `is_org_member`) still
  permits any member to delete via the API — **the UI restriction is not a security
  boundary**, and must not be described as one.
- **Why deferred:** proper soft-delete is a column + a policy change + a filter on
  every read path; Palash chose to ship tags now and log this rather than widen Gate
  A. Deliberate, not overlooked.
- **Impact:** an accidental (or malicious member's) tag delete is unrecoverable and
  silently re-shapes every view filtering on that tag. No data leak — an org member
  could already read every tag in their org.
- **Fix when:** tags are used in anger, or before an external customer. Fix = add
  `deleted_at` to `tags`, retire instead of delete, filter it from reads, and tighten
  `p_tags` so DELETE requires `is_org_admin` (closing the API gap the UI only hides).
- **Source:** raised while speccing M6 (D1, 2026-07-16); ruled by Palash.

## TD-011 — a snoozed item never wakes (snoozed_until is written but never read)
- **What:** `snoozeItem(id, until)` sets `state='snoozed'` + `snoozed_until`
  ([items-repository.ts](../../src/modules/items/data/items-repository.ts) `:130`),
  driven from Daily Review. But **nothing reads `snoozed_until` back** — no view, no
  trigger, no cron — and **no system view includes the `snoozed` state** (`0007`).
  So a snoozed item disappears from every active view and **never returns**, even
  after its wake time passes. Same shape as the reminder bug (`remind_at` written,
  never read) that migration `0017` fixed.
- **Impact:** the "snooze/defer" Execution Must-Have (Doc 4) is **half-built**: defer
  works, un-defer does not. A user who snoozes something to "tomorrow" will never see
  it resurface — it's findable only by Search. Silent; looks like lost work.
- **Fix when:** part of finishing the defer loop. Options: a "Snoozed" system view, or
  (better, mirroring `0017`) fold `snoozed_until` into the surfacing logic so a due
  snooze re-enters Today — e.g. a view predicate `state<>'snoozed' OR snoozed_until <= now`,
  or a wake step that flips due snoozes back to `committed`. Timezone rules apply (TD-005).
- **Source:** found in the MVP gap audit (2026-07-17), verified by grep — `snoozed_until`
  has exactly one writer and zero readers.

## TD-012 — `ai_captures.provider` is hardcoded to 'anthropic' (wrong provenance)
- **What:** [AiCaptureBox.tsx](../../src/modules/inbox/components/AiCaptureBox.tsx) `:73`
  writes `provider: 'anthropic'` on every `ai_captures` row, regardless of the
  `AI_PROVIDER` that actually classified it (currently **Gemini**). The stored
  provenance is simply wrong.
- **Impact:** low today, but it **undermines the TD-006 rationale** — `confidence` is
  still stored "for future server-side calibration", and calibration keyed on a
  mislabelled provider is unsound. Also corrupts any later "which provider did what"
  analysis.
- **Fix when:** cheap — thread the real provider back from the classify response (the
  Edge Function knows it) into the `ai_captures` write, or read it from config. Do it
  before any calibration work leans on the column.
- **Source:** found in the MVP gap audit (2026-07-17).

## TD-009 — field edits are not audited (Activity feed is sparse)
- **What:** the `activity_event_type` enum covers `created`, `state_changed`,
  `completed`, `moved_list`, the responsibility events and tags — but has **no event
  for a field edit**. Changing an item's title, description, priority, dates or
  estimate writes nothing to `activity_events`, so the PDL-036 Activity feed cannot
  show them. The feed is *honest* (it shows everything that is logged) but thin.
- **Impact:** no security or integrity impact — the audit trail is not *wrong*, just
  incomplete. It does weaken "who changed this due date?", which is the question the
  responsibility model makes people ask.
- **Why not fixed now:** PDL-036 is UI-only by decision. Adding an event type +
  trigger arm is a schema change to an append-only, permission-sensitive table and
  deserves its own gate — not a silent widening inside a panel build.
- **Fix when:** next time the audit schema is opened. Add e.g. a `field_changed`
  event with `{field, from, to}` in `payload`, armed in `log_item_change`; the
  renderer (`activityLabel`) already falls back to "updated this item" for unknown
  types, so old rows stay readable.
- **Source:** found building the PDL-036 Activity feed (2026-07-16) — the feed showed
  only "created this item" after a dozen real edits.
