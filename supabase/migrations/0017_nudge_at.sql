-- 0017_nudge_at.sql
-- Reminder surfacing (M6 Gate B / PDL-011 / M6 D3).
--
-- The bug: `items.remind_at` was written by the AI Inbox but read by NOTHING. The
-- Today/Upcoming views resolved their window against `due_at` only, so a reminder
-- captured with a `remind_at` and no `due_at` ("remind me tomorrow") surfaced in NO
-- view once it left the Inbox. PDL-011 requires reminders to work in Today/Due.
--
-- `nudge_at` = the first moment an item needs a human: the earlier of its due date
-- and its reminder. `least()` ignores NULLs, so:
--   due only      -> nudge_at = due_at
--   reminder only -> nudge_at = remind_at   (this is the case that was invisible)
--   both          -> the earlier of the two (NOT coalesce, which would let a later
--                    due date hide an earlier reminder)
--   neither       -> NULL (never surfaces in a dated window; correct)
--
-- Generated + stored so it is indexable and sortable like a real column, and can
-- never drift from its inputs. Both inputs are timestamptz, so the instant is
-- absolute — the user's local-day windows are resolved at query time (TD-005).
alter table items
  add column nudge_at timestamptz
  generated always as (least(due_at, remind_at)) stored;

-- Mirrors idx_items_org_due; the partial predicate keeps soft-deleted rows out.
create index idx_items_org_nudge on items(organization_id, nudge_at) where deleted_at is null;
