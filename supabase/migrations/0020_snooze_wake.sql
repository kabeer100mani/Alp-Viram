-- 0020_snooze_wake.sql
-- Snooze actually defers-and-returns (TD-011, M7 Gate B).
--
-- The bug: snoozeItem set state='snoozed' + snoozed_until, but NOTHING read
-- snoozed_until back and no view showed 'snoozed' items — so a snoozed item vanished
-- from every view and never returned, even after its wake time. Same class as the
-- reminder hole 0017 fixed (a field written, never read).
--
-- The fix has two halves:
--   1. a wake step that flips DUE snoozes back to 'committed' (this file);
--   2. a "Snoozed" system view so a user can see/undo deferred items before they
--      auto-wake (this file), since M7 removes the manual "set status = snoozed"
--      option (D-c) — snooze becomes a defer-*until* action with a date.

-- ── Wake due snoozes ───────────────────────────────────────────────────────────
-- Flip snoozes whose wake time has passed back to active work. SECURITY DEFINER so
-- it can update across the caller's orgs, but scoped to is_org_member(...) — which
-- reads auth.uid() from the JWT regardless of the executing role — so it only ever
-- touches organizations the caller actually belongs to. Comparing an absolute
-- snoozed_until to now() is timezone-safe by construction (TD-005).
create or replace function wake_due_snoozes()
returns integer language plpgsql security definer set search_path = public as $$
declare woken integer;
begin
  update items
     set state = 'committed', snoozed_until = null
   where state = 'snoozed'
     and snoozed_until is not null
     and snoozed_until <= now()
     and deleted_at is null
     and is_org_member(organization_id);
  get diagnostics woken = row_count;
  return woken;
end; $$;

revoke all on function wake_due_snoozes() from public;
grant execute on function wake_due_snoozes() to authenticated;

-- ── "Snoozed" system view ──────────────────────────────────────────────────────
-- Extend the seed (0007) with an 8th system view. Re-running the backfill adds only
-- the new one to existing orgs (ON CONFLICT DO NOTHING); new orgs get it via the
-- existing bootstrap trigger.
create or replace function seed_system_views(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into saved_views (organization_id, owner_id, name, filter, is_system, sort_order)
  values
    (p_org, null, 'Inbox',    '{"states":["captured"],"sort":"created_desc"}'::jsonb,                        true, 10),
    (p_org, null, 'Today',    '{"states":["committed","in_progress"],"due":"today","sort":"due_asc"}'::jsonb, true, 20),
    (p_org, null, 'Upcoming', '{"states":["committed","in_progress"],"due":"upcoming","sort":"due_asc"}'::jsonb, true, 30),
    (p_org, null, 'Aging',    '{"states":["captured","committed"],"agingDays":3,"sort":"updated_desc"}'::jsonb, true, 40),
    (p_org, null, 'Waiting',  '{"waiting":true,"sort":"updated_desc"}'::jsonb,                                true, 50),
    (p_org, null, 'Snoozed',  '{"states":["snoozed"],"sort":"updated_desc"}'::jsonb,                          true, 55),
    (p_org, null, 'Done',     '{"states":["done"],"sort":"updated_desc"}'::jsonb,                             true, 60),
    (p_org, null, 'By Role',  '{"groupBy":"role","sort":"due_asc"}'::jsonb,                                   true, 70)
  on conflict (organization_id, name) where is_system do nothing;
end; $$;

do $$
declare o record;
begin
  for o in select id from organizations loop
    perform seed_system_views(o.id);
  end loop;
end $$;
