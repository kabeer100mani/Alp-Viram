# Technical Debt Register

Deliberately deferred work, tracked so it is revisited on purpose — not forgotten.
Each entry: **what · why deferred · impact · fix when · source.**

## TD-001 — `items` allow hard-delete (soft-delete intended)
- **What:** RLS on `items` permits `DELETE` for any org member. The design intends
  soft-delete via `deleted_at`; hard-delete erodes `activity_events` linkage
  (`item_id` → set null) and cascades child rows.
- **Why deferred:** the app never hard-deletes (uses `deleted_at`); no user-facing delete yet.
- **Impact:** a crafted client call could hard-delete items within its **own** org,
  losing audit linkage. Within-tenant only — not a cross-tenant leak.
- **Fix when:** **Permission Model milestone (Doc 8)** — revoke `DELETE` on
  history-bearing tables (or restrict to admins) and enforce soft-delete.
- **Source:** RLS red-team audit, finding #7. *(Recorded at user request during M3 kickoff.)*

## TD-002 — `activity_events` append-only not enforced vs the service role
- **What:** append-only holds for clients (RLS select-only; client insert removed in 0003),
  but the service role / table owner can still `UPDATE`/`DELETE`.
- **Why deferred:** the service role is trusted; low risk for MVP.
- **Impact:** a compromised service key could rewrite history.
- **Fix when:** Permission Model milestone — add a `BEFORE UPDATE/DELETE` guard trigger
  (must handle org-delete cascade) + `force row level security`.
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

## TD-004 — deferred tables need RLS + composite FKs when they ship
- **What:** `recurrence_rules`, `attachments`, `delegations` are designed but not yet
  created; each needs RLS and composite `(child_id, organization_id)` FKs when added.
  (`ai_captures` ships in M3 **with** RLS from the start.)
- **Fix when:** as each table ships.
