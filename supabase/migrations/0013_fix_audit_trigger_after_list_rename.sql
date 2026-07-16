-- 0013_fix_audit_trigger_after_list_rename.sql
-- REGRESSION FIX for 0011.
--
-- `alter table ... rename column project_id to list_id` does NOT rewrite function
-- bodies, so log_item_change() (from 0002) still referenced new.project_id. The
-- trigger fires on EVERY items INSERT/UPDATE, so after 0011 *every write to every
-- item* failed with:
--     record "new" has no field "project_id"
--
-- Caught by scripts/m6-structure-test.mjs against the live database. The unit
-- tests never saw it — they mock the DB, so nothing exercised the trigger.
--
-- Lesson worth keeping: renaming a column is not a local change. Anything that
-- names it in a body — triggers, functions, views, policies — has to move with it.

-- The event is semantically unchanged (an item moved grouping); the object was
-- renamed, so its label moves too. Renaming an enum label rewrites no rows, so
-- the append-only guarantee on activity_events is untouched.
alter type activity_event_type rename value 'moved_project' to 'moved_list';

create or replace function log_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.id, coalesce(new.created_by, auth.uid()), 'created',
            jsonb_build_object('type', new.type, 'title', new.title));
  elsif (tg_op = 'UPDATE') then
    if (new.state is distinct from old.state) then
      insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
      values (new.organization_id, new.id, auth.uid(),
              (case when new.state = 'done' then 'completed' else 'state_changed' end)::activity_event_type,
              jsonb_build_object('from', old.state, 'to', new.state));
    end if;
    if (new.list_id is distinct from old.list_id) then
      insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
      values (new.organization_id, new.id, auth.uid(), 'moved_list',
              jsonb_build_object('from', old.list_id, 'to', new.list_id));
    end if;
  end if;
  return coalesce(new, old);
end; $$;
