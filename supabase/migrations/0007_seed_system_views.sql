-- 0007_seed_system_views.sql
-- M3 (Workspace UI), Gate A — seed the 7 system saved views.
--
-- Doc 5 §4 specifies them (Inbox · Today · Upcoming · Aging · Waiting · Done ·
-- By Role) and calls views "how users navigate — by intent, not by tree". They
-- were never actually created, and `0003` correctly stops clients from inserting
-- `is_system` rows, so they must ship here.
--
-- `owner_id IS NULL` = system/shared. The filter shape is the Zod contract in
-- src/modules/views/view-filter.ts (TDL-010) — keep the two in step.
--
-- Naming follows Doc 5 (the IA authority): "Today", not "My Day"; "Aging", not
-- "Overdue" — FR-12b states there is no raw overdue state, and Doc 4 rejects a
-- shaming state outright.

-- Idempotency: `saved_views` has no unique constraint, so ON CONFLICT DO NOTHING
-- would match nothing and re-running this seed would silently duplicate every
-- system view. This index gives the conflict something to bite on, and stops a
-- second "Inbox" existing regardless of how the seed is invoked.
create unique index if not exists uq_saved_views_system_name
  on saved_views(organization_id, name) where is_system;

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
    (p_org, null, 'Done',     '{"states":["done"],"sort":"updated_desc"}'::jsonb,                             true, 60),
    (p_org, null, 'By Role',  '{"groupBy":"role","sort":"due_asc"}'::jsonb,                                   true, 70)
  on conflict (organization_id, name) where is_system do nothing;
end; $$;

-- Backfill every existing organization.
do $$
declare o record;
begin
  for o in select id from organizations loop
    perform seed_system_views(o.id);
  end loop;
end $$;

-- New organizations get them at bootstrap. handle_new_user() (0001) creates the
-- profile + personal org + owner membership; extend that path rather than add a
-- second trigger, so a new org is never briefly view-less.
create or replace function seed_views_for_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform seed_system_views(new.id);
  return new;
end; $$;

drop trigger if exists trg_seed_system_views on organizations;
create trigger trg_seed_system_views
  after insert on organizations
  for each row execute function seed_views_for_new_org();
