# Technical Document 2 — Database Design

> Status: **DRAFT — for review.** Postgres (Supabase). No migrations yet — this is
> the logical schema for approval. Conventions below, then each table with
> **Purpose · Key columns · Relationships · Constraints · Indexes · RLS · Future ·
> Challenge**. Companion: `01-erd.md`, `03-technical-decision-log.md`.

## Conventions
- **PKs:** `uuid` default `gen_random_uuid()`.
- **Tenancy:** every business table has `organization_id` → the RLS anchor.
- **Timestamps:** `created_at timestamptz default now()`, `updated_at` via trigger.
- **Soft delete:** `deleted_at timestamptz` (items) / `is_active bool` (roles,
  memberships) to preserve history; never hard-delete referenced history.
- **RLS:** ON for every table. Baseline: a row is visible/editable only if its
  `organization_id` is one the current user is an active member of. Finer-grained
  visibility is Future (Permission Model, Doc 8).
- **Enums:** Postgres `enum` types (extensible) — see ERD §5.

Helper functions (all `security definer` to avoid RLS recursion on
`organization_members`). `is_org_member` is the baseline; `is_org_admin` and
`shares_org_with` are **additive helpers that implement policies already stated in
this document** (owner/admin-only writes on roles/memberships/org; profile
cross-visibility "read profiles that share an org") — they are not a design change:
```
is_org_member(org)      := membership row for auth.uid() in org, active
is_org_admin(org)       := is_org_member AND role in ('owner','admin')
shares_org_with(target) := auth.uid() and target share at least one active org
```
Usage: `is_org_member` gates read/write on tenant data; `is_org_admin` gates
writes on `roles`, `organization_members`, and org settings; `shares_org_with`
gates the `profiles` SELECT policy (so you can see teammates' names but not
strangers').

---

## 1. `profiles`
- **Purpose:** App-side user, 1:1 with Supabase `auth.users`.
- **Key columns:** `id uuid PK` (= `auth.users.id`), `display_name`, `avatar_url`,
  `created_at`.
- **Relationships:** referenced by memberships, role_assignments, assignments,
  collaborators, delegations, activity actors.
- **Constraints:** `id` FK → `auth.users(id)` on delete cascade.
- **Indexes:** PK only.
- **RLS:** a user can read profiles that share any org with them; can update only
  their own.
- **Future:** timezone, locale, notification prefs (for future delivery channels).
- **Challenge:** we deliberately do **not** store email here (it lives in
  `auth.users`) to avoid duplicating the identity source of truth.

## 2. `organizations`
- **Purpose:** Tenant boundary. Always exists — even for solo users.
- **Key columns:** `id`, `name`, `slug unique`, `is_personal bool default true`,
  `team_enabled bool default false`, `created_by`, `created_at`.
- **Relationships:** parent of nearly everything via `organization_id`.
- **Constraints:** `slug` unique.
- **Indexes:** `slug`.
- **RLS:** visible if `is_org_member(id)`.
- **Future:** billing plan, settings JSONB, branding.
- **Challenge:** `is_personal`/`team_enabled` drive **progressive disclosure**
  (PDL-022) at the *data* level, so the UI has a real signal — not a guess — for
  when to reveal org/role concepts. The flip is enforced by a DB trigger
  (`sync_org_team_state` on `organization_members`): the 2nd active member flips
  `is_personal→false`, `team_enabled→true`. Doing it in a trigger (not app code)
  means the signal can never silently drift. Explicit "enable team collaboration"
  is a separate admin update to `team_enabled`.

## 3. `organization_members`
- **Purpose:** Who belongs to an org and their **platform permission**.
- **Key columns:** `id`, `organization_id`, `user_id`, `role org_member_role`
  (owner/admin/member), `is_active bool`, `invited_by`, `invited_at`, `joined_at`.
- **Relationships:** org ↔ profiles (M:N).
- **Constraints:** unique `(organization_id, user_id)`.
- **Indexes:** `(organization_id)`, `(user_id)`.
- **RLS:** members can read the member list of their org; only owner/admin can
  write.
- **Invite path:** the **primary** way memberships are created is an **Edge
  Function running with the service role** (R4/TDL-011) — it looks up or provisions
  the invited auth user, sends the invite email, and inserts the membership (which
  then fires `sync_org_team_state`). The `is_org_admin` INSERT policy is
  **defense-in-depth**, not the primary path: even a direct client write can only
  add members to an org you already administer.
- **Future:** teams/sub-groups (Doc 8).
- **Challenge:** we separate **platform permission** (`org_member_role`) from
  **business responsibility** (`roles`) — conflating them is a classic mistake
  that couples "can administer the app" with "is responsible for the work."

## 4. `roles`
- **Purpose:** Durable business responsibilities ("Finance Manager") — the SAP
  *position*.
- **Key columns:** `id`, `organization_id`, `name`, `description`, `is_active bool`,
  `created_by`, `created_at`.
- **Relationships:** → role_assignments, item_responsible_roles, delegations.
- **Constraints:** unique `(organization_id, lower(name))`.
- **Indexes:** `(organization_id)`.
- **RLS:** members read; owner/admin write.
- **Future:** role hierarchy/inheritance (Doc 8), default responsibilities.
- **Challenge:** never hard-delete a role that has history — deactivate. A deleted
  role would orphan audit meaning.

## 5. `role_assignments`
- **Purpose:** The **indirection layer** — which user fills a role, over time.
- **Key columns:** `id`, `organization_id`, `role_id`, `user_id`,
  `valid_from timestamptz`, `valid_to timestamptz NULL`, `created_by`, `created_at`.
- **Relationships:** roles ↔ profiles through time.
- **Constraints:** no hard overlap constraint (multiple concurrent holders are
  allowed by design); `valid_to` NULL = current.
- **Indexes:** `(role_id, valid_to)`, `(user_id, valid_to)`,
  `(organization_id)`. Consider a partial index `where valid_to is null` for "who
  is current."
- **RLS:** members read; owner/admin write.
- **Future:** rotation schedules (PagerDuty-style), auto-expiry from HR feeds.
- **Challenge:** this single table is the *only* place the role→person mapping
  lives — that's what makes stale mappings structurally impossible (PDL-015).

## 6. `projects`
- **Purpose:** Optional flat grouping.
- **Key columns:** `id`, `organization_id`, `name`, `description`, `color`,
  `is_archived bool`, `created_by`, `created_at`.
- **Relationships:** → items (0..N).
- **Constraints:** unique `(organization_id, lower(name))`.
- **Indexes:** `(organization_id, is_archived)`.
- **RLS:** members read/write.
- **Future:** project-level roles/visibility, project templates.
- **Challenge:** intentionally **no** `parent_project_id` — no nesting. If a
  customer truly needs it later, add one optional "space" level on evidence only.

## 7. `items`  (the core table)
- **Purpose:** The unit of work — Task, Note, or Meeting.
- **Key columns:**
  - identity/tenancy: `id`, `organization_id`, `created_by`, `created_at`, `updated_at`, `deleted_at`
  - classification: `type item_type`, `state item_state default 'captured'`
  - content: `title`, `body text`
  - scheduling: `due_at timestamptz`, `remind_at timestamptz`, `snoozed_until timestamptz`, `completed_at`
  - metadata flags: `is_reminder bool` (reminder UX, PDL-027), `waiting_on text` (follow-up), `is_reference bool` (knowledge on notes), `priority priority default 'none'`
  - organizing: `project_id NULL`
  - recurrence: `recurrence_rule_id NULL`, `series_id NULL` (links occurrences)
  - capture provenance: `source` (`inbox`/`manual`/`ai`), `ai_confidence numeric NULL`
- **Relationships:** → project (0..1), meeting_details (0..1), tags (M:N),
  responsible_roles/assigned_users/collaborators, attachments, activity, recurrence.
- **Constraints:** `title` not empty; `is_reference` only meaningful for notes;
  `waiting_on`/`is_reminder` only for tasks (enforced by CHECK on `type`).
- **Indexes:** `(organization_id, state)`, `(organization_id, due_at)`,
  `(organization_id, project_id)`, `(organization_id, type)`, `(series_id)`,
  partial `where deleted_at is null`. Full-text index on `title, body` for search.
- **RLS:** members read/write (fine-grained visibility = Future).
- **Future:** estimate/effort, start_at, custom fields (JSONB), external refs.
- **Challenge:** reminder/follow-up/knowledge are **columns, not types** — the AI
  classifies among 3 types then sets flags, keeping classification reliable while
  the UX still "feels like" a reminder (PDL-027). CHECK constraints keep type-
  specific fields honest.

## 8. `meeting_details`
- **Purpose:** Meeting-specific fields, isolated for calendar-readiness.
- **Key columns:** `item_id PK/FK`, `organization_id`, `starts_at`, `ends_at`,
  `location`, `agenda text`, `outcome_notes text`,
  `external_calendar_id NULL`, `external_provider NULL`.
- **Relationships:** 1:1 with an `items` row of type `meeting`. Participants reuse
  `item_collaborators` (+ assigned users) rather than a separate list.
- **Constraints:** `item_id` unique; app/CHECK ensures parent `type='meeting'`.
- **Indexes:** `(organization_id, starts_at)`.
- **RLS:** inherits via org membership.
- **Future:** calendar sync fields (`external_*` already reserved), recurrence of
  meetings, video links.
- **Challenge:** keeping this **out** of `items` is what lets calendar integration
  land later with **no Item-model redesign** (PDL-023).

## 9. `tags`  &  ## 10. `item_tags`
- **Purpose:** Flat labels + their M:N link to items.
- **`tags` columns:** `id`, `organization_id`, `name`, `color`, `created_at`;
  unique `(organization_id, lower(name))`.
- **`item_tags` columns:** `item_id`, `tag_id`, PK `(item_id, tag_id)`.
- **Indexes:** `item_tags(tag_id)`; `tags(organization_id)`.
- **RLS:** via org membership.
- **Future:** tag groups/colors, AI-suggested tags.
- **Challenge:** no hierarchy on tags either — flat keeps multi-dimensional
  slicing simple; "groups" can be a display concern later.

## 11. `item_responsible_roles`  (responsibility, multi)
- **Purpose:** Which roles are responsible for an item; one may be Primary.
- **Key columns:** `id`, `organization_id`, `item_id`, `role_id`,
  `is_primary bool default false`, `created_at`, `created_by`.
- **Constraints:** unique `(item_id, role_id)`; **at most one primary per item** —
  partial unique index `on (item_id) where is_primary`.
- **Indexes:** `(item_id)`, `(role_id)`.
- **RLS:** via org membership.
- **Challenge:** modeling responsibility as a **join table (0..N)**, not a column,
  is what enables multi-role + hybrid (PDL-020) and keeps "0 at capture" valid.

## 12. `item_assigned_users`  (execution, multi)
- **Purpose:** Which users execute an item; one may be Primary.
- **Key columns:** `id`, `organization_id`, `item_id`, `user_id`,
  `is_primary bool default false`, `assigned_via` (`direct`/`role_derived`),
  `created_at`, `created_by`.
- **Constraints:** unique `(item_id, user_id)`; partial unique primary per item.
- **Indexes:** `(item_id)`, `(user_id)`.
- **RLS:** via org membership.
- **Challenge:** `assigned_via` records whether a user was assigned directly or
  derived from a role at a point in time — useful for "why am I seeing this?" and
  for correct behavior on role replacement.

## 13. `item_collaborators`
- **Purpose:** Optional collaborators / meeting participants.
- **Key columns:** `id`, `organization_id`, `item_id`, `user_id`, `created_at`.
- **Constraints:** unique `(item_id, user_id)`.
- **Indexes:** `(item_id)`, `(user_id)`.
- **RLS:** via org membership.

## 14. `recurrence_rules`
- **Purpose:** Define a recurring series (MIS, GST, payroll, weekly reviews).
- **Key columns:** `id`, `organization_id`, `rrule text` (iCal RRULE),
  `timezone text`, `dtstart timestamptz`, `until timestamptz NULL`,
  `count int NULL`, `next_run_at timestamptz`, `is_active bool`,
  `template_item_id` (the series prototype).
- **Relationships:** 1 rule → N `items` (occurrences via `items.series_id`).
- **Indexes:** `(organization_id, is_active, next_run_at)`.
- **RLS:** via org membership.
- **Future:** UI in MVP if simple, else schema-only (PDL-024); occurrence
  generation via a scheduled Edge Function.
- **Challenge:** using standard **RRULE** avoids inventing a recurrence language
  and eases future calendar interop.

## 15. `attachments`
- **Purpose:** Files on items (Supabase Storage).
- **Key columns:** `id`, `organization_id`, `item_id`, `storage_path`,
  `file_name`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`.
- **Indexes:** `(item_id)`.
- **RLS:** via org membership; Storage bucket policies mirror this.
- **Future:** UI just-after MVP (PDL-025); versioning, previews.
- **Challenge:** table exists from day one so enabling uploads later needs **no
  schema change**.

## 16. `activity_events`  (append-only audit)
- **Purpose:** Immutable history of item lifecycle & responsibility changes.
- **Key columns:** `id`, `organization_id`, `item_id NULL`, `actor_id`,
  `event_type activity_event_type`, `payload jsonb` (old→new),
  `effective_at timestamptz`, `recorded_at timestamptz default now()`.
- **Constraints:** **no UPDATE/DELETE** (enforced by RLS: only INSERT + SELECT).
- **Indexes:** `(item_id, recorded_at)`, `(organization_id, recorded_at)`,
  `(event_type)`.
- **RLS:** members read; INSERT allowed; UPDATE/DELETE denied to everyone.
- **Future:** point-in-time "who was responsible on date X" read model; history UI.
- **Challenge:** append-only is enforced at the **database** layer, not trusted to
  app code — the only way to guarantee "historical ownership never changes"
  (PDL-018).

## 17. `delegations`
- **Purpose:** Temporary, non-owning authority to act for a role/item.
- **Key columns:** `id`, `organization_id`, `from_user_id`, `to_user_id`,
  `role_id NULL`, `item_id NULL`, `valid_from`, `valid_to`, `reason`, `created_at`.
- **Constraints:** exactly one of `role_id`/`item_id` set (CHECK); `to_user ≠
  from_user`.
- **Indexes:** `(organization_id, valid_to)`, `(to_user_id, valid_to)`.
- **RLS:** members read; the delegator or admins write.
- **Future:** UI later; auto-notify delegate.
- **Challenge:** delegation grants *action rights*, never ownership, and does not
  cascade — enforced in the derivation logic, not by mutating assignments (PDL-017).

## 18. `saved_views`
- **Purpose:** System + custom saved filters (the "reports" of MVP).
- **Key columns:** `id`, `organization_id`, `owner_id NULL` (NULL = system/shared),
  `name`, `filter jsonb`, `is_system bool`, `sort_order int`, `created_at`.
- **Indexes:** `(organization_id, owner_id)`.
- **RLS:** members read system + own; write own.
- **Future:** shared team views, AI-generated views.
- **Challenge:** filters as **JSONB** keep views flexible without a schema change
  per new filter dimension; validated by a Zod schema in the app.

## 19. `ai_captures`
- **Purpose:** Store each raw capture + AI classification for metrics & learning.
- **Key columns:** `id`, `organization_id`, `user_id`, `raw_input text`,
  `parsed jsonb` (proposed type/fields/confidence), `provider text`,
  `model text`, `confidence numeric`, `required_clarification bool`,
  `resulting_item_id NULL`, `created_at`.
- **Indexes:** `(organization_id, created_at)`.
- **RLS:** members read own-org; INSERT by the Edge Function context.
- **Future:** feedback loop to improve suggestions; per-user learning.
- **Challenge:** `required_clarification` directly powers the "% of captures
  requiring AI clarification" experience metric (PDL-026) and the "know when NOT
  to use AI" principle (PDL-028).

---

## RLS strategy summary
- Every table: `enable row level security`.
- SELECT/INSERT/UPDATE/DELETE policies gated by `is_org_member(organization_id)`.
- `activity_events`: SELECT + INSERT only (no UPDATE/DELETE for anyone) → immutability.
- Write-restricted tables (roles, memberships, org settings): additionally require
  `org_member_role in ('owner','admin')`.
- Privileged/service operations (AI capture, recurrence generation, invites) run in
  **Edge Functions** with the service role, still writing tenant-scoped rows.

## Open design questions (carried to the TDL / your review)
1. **Derived-owner read model:** compute "who is responsible now" on the fly (view/
   function) vs. materialize it. Leaning: a SQL function/view for correctness first,
   optimize later.
2. **`item_state` vs a separate task `status`:** MVP folds progress into `item_state`
   (`in_progress`). If teams want richer workflows, add a per-project status later.
3. **Participants for meetings:** reuse `item_collaborators` (recommended) vs a
   dedicated `meeting_participants` table. Leaning: reuse for MVP.
4. **Event granularity:** one event per field change vs one composite event per
   user action. Leaning: per logical action, with `payload` capturing the diffs.
