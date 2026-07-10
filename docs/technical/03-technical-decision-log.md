# Technical Document 3 — Technical Decision Log (TDL)

> The engineering counterpart to the PDL. Records **technical** decisions:
> **Decision · Why · Alternatives · Trade-offs · Status.** Status: Accepted ·
> Proposed · Superseded · Revisit.

---

### TDL-001 — UUID primary keys
- **Decision:** `uuid` PKs via `gen_random_uuid()` on all tables.
- **Why:** Safe to generate client/edge-side, no cross-tenant enumeration, easy merges.
- **Alternatives:** bigint identity.
- **Trade-offs:** 16 bytes vs 8, slightly larger indexes; negligible at our scale.
- **Status:** Accepted

### TDL-002 — Single database, multi-tenant via RLS on `organization_id`
- **Decision:** One Postgres DB; every business row carries `organization_id`; isolation enforced by Row Level Security.
- **Why:** Simplest to operate; the DB is the last line of defense against leaks.
- **Alternatives:** DB-per-tenant or schema-per-tenant.
- **Trade-offs:** RLS policy discipline required; far less operational overhead than N databases.
- **Status:** Accepted

### TDL-003 — Responsibility as join tables + time-bounded role assignment
- **Decision:** `item_responsible_roles` and `item_assigned_users` (both multi, with a partial-unique `is_primary`), and `role_assignments` (user↔role with `valid_from/valid_to`) as the indirection.
- **Why:** Supports hybrid/multi assignment (PDL-020) and role→person indirection (PDL-015); replacement is one row.
- **Alternatives:** single `responsible_role_id`/`owner_id` columns.
- **Trade-offs:** More joins to resolve "who"; correctness and flexibility win.
- **Status:** Accepted

### TDL-004 — Immutable audit via append-only `activity_events`
- **Decision:** All lifecycle/ownership changes are append-only events; UPDATE/DELETE denied by RLS for everyone.
- **Why:** "Historical ownership never changes" must be guaranteed by the DB, not app code.
- **Alternatives:** Mutable rows + a trigger-based history table.
- **Trade-offs:** More rows and a read model to reconstruct state; essential for trust/compliance.
- **Status:** Accepted

### TDL-005 — Meeting fields in a 1:1 `meeting_details` table
- **Decision:** Keep meeting/calendar fields out of `items`.
- **Why:** Calendar integration later needs no Item-model redesign (PDL-023).
- **Alternatives:** Nullable meeting columns on `items`.
- **Trade-offs:** One extra join for meetings; cleaner core table.
- **Status:** Accepted

### TDL-006 — Recurrence via iCal RRULE + generated occurrences
- **Decision:** `recurrence_rules` stores an RRULE; occurrences are `items` linked by `series_id`; generation runs in a scheduled Edge Function.
- **Why:** Standard, calendar-interoperable, avoids a bespoke recurrence language.
- **Alternatives:** Custom recurrence fields; generate-on-read.
- **Trade-offs:** Need a scheduler; schema shipped even if UI is deferred (PDL-024).
- **Status:** Accepted

### TDL-007 — Reminder / Follow-up / Knowledge as columns, not types
- **Decision:** `is_reminder`+`remind_at`, `waiting_on`, `is_reference` are Item attributes; only 3 stored types.
- **Why:** Reliable AI classification (3 vs 7) while UX still feels native (PDL-027).
- **Alternatives:** Separate types/tables per concept.
- **Trade-offs:** CHECK constraints needed to keep type-specific fields valid.
- **Status:** Accepted

### TDL-008 — Postgres enum types for controlled vocabularies
- **Decision:** `item_type`, `item_state`, `priority`, etc. as Postgres enums.
- **Why:** Integrity + readability; values extensible via `ALTER TYPE`.
- **Alternatives:** lookup tables; text + CHECK.
- **Trade-offs:** Enum changes are migrations; acceptable and explicit.
- **Status:** Accepted (revisit if a vocabulary needs per-tenant customization → lookup table)

### TDL-009 — Soft-delete / deactivate to preserve history
- **Decision:** `deleted_at` (items) and `is_active` (roles, memberships, users-links) instead of hard deletes for referenced history.
- **Why:** Audit and completed-item history must keep resolving.
- **Alternatives:** Hard delete + cascade.
- **Trade-offs:** Queries must filter deleted rows (partial indexes help).
- **Status:** Accepted

### TDL-010 — Saved-view filters as JSONB (Zod-validated)
- **Decision:** Store view filters as JSONB; validate shape with a shared Zod schema.
- **Why:** New filter dimensions need no schema change.
- **Alternatives:** Normalized filter tables.
- **Trade-offs:** Less DB-level validation; compensated by Zod at the boundary.
- **Status:** Accepted

### TDL-011 — AI & privileged operations in Edge Functions (service role)
- **Decision:** AI classification, recurrence generation, invites, and any service-role work run in Supabase Edge Functions; provider keys server-side only.
- **Why:** Keys never reach the browser; clean privileged boundary (PDL-004).
- **Alternatives:** Client-side calls; a separate backend service.
- **Trade-offs:** Extra hop/cold-starts; strong security and separation.
- **Status:** Accepted

### TDL-012 — "Current responsible person" is derived, not stored
- **Decision:** Resolve responsible/assigned people via a SQL function/view over `role_assignments` + assignment tables; do not materialize.
- **Why:** Always correct after staffing changes; single source of truth.
- **Alternatives:** Materialized/denormalized owner columns.
- **Trade-offs:** Compute at read time; add a materialized view later only if perf needs it.
- **Status:** Proposed (confirm during implementation)

### TDL-013 — Progressive disclosure signaled at the data layer
- **Decision:** `organizations.is_personal` / `team_enabled` drive solo-vs-team UI.
- **Why:** The UI gets a real signal, not a heuristic (PDL-022).
- **Alternatives:** Infer from member count each render.
- **Trade-offs:** Two flags to maintain; trivial.
- **Status:** Accepted

### TDL-014 — Full-text search via Postgres `tsvector` for MVP
- **Decision:** Search `items.title/body` with a Postgres generated `tsvector` + GIN index.
- **Why:** No extra infra; good enough for MVP; a flat model needs solid search.
- **Alternatives:** External search (Typesense/Meilisearch/Elastic).
- **Trade-offs:** Less advanced ranking than a search engine; revisit at scale.
- **Status:** Accepted (Revisit at scale)

### TDL-015 — `timestamptz` everywhere, UTC; `updated_at` via trigger
- **Decision:** All times `timestamptz` in UTC; convert in the client; `updated_at` maintained by trigger.
- **Why:** Correct across timezones (users span regions); reliable ordering.
- **Alternatives:** `timestamp` without tz.
- **Trade-offs:** Must be disciplined about client conversion.
- **Status:** Accepted

### TDL-016 — Supabase Storage with policies mirroring RLS
- **Decision:** Attachments in a Storage bucket; object policies mirror `organization_id` membership; DB `attachments` row is the source of truth.
- **Why:** Consistent tenant isolation for files.
- **Alternatives:** Public bucket + signed URLs only.
- **Trade-offs:** Policy upkeep in two places (DB + Storage).
- **Status:** Accepted

### TDL-017 — Separate platform permission from business role
- **Decision:** `organization_members.role` (owner/admin/member) governs *app administration*; `roles` govern *work responsibility*. They are independent.
- **Why:** "Can administer" ≠ "is responsible for the work"; conflation causes bad access models.
- **Alternatives:** One role concept for both.
- **Trade-offs:** Two concepts to explain; correct separation of concerns.
- **Status:** Accepted

### TDL-018 — Single-primary enforced by partial unique indexes
- **Decision:** `unique (item_id) where is_primary` on responsible-roles and assigned-users.
- **Why:** Guarantee "at most one Primary" at the DB level.
- **Alternatives:** App-level checks.
- **Trade-offs:** None significant.
- **Status:** Accepted

### TDL-019 — Migrations via Supabase CLI, versioned SQL (when we start)
- **Decision:** Schema changes as versioned SQL migrations in `supabase/migrations`, reviewed like code.
- **Why:** Reproducible, auditable schema evolution.
- **Alternatives:** Manual dashboard edits.
- **Trade-offs:** Slightly more process; essential for a real product.
- **Status:** Accepted (applies once implementation begins — not yet)
