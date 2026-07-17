-- 0018_org_teardown.sql
-- Organization deletion / GDPR erasure (TD-007, M7 Gate B).
--
-- Deleting an org cascades to its children. Two layers still blocked teardown after
-- 0006 fixed the last-owner trigger:
--
--   Layer 2 — the AFTER DELETE audit triggers on item_responsible_roles /
--     item_assigned_users insert a `*_removed` row into activity_events referencing
--     the org that is being deleted in the SAME statement -> violates
--     activity_events_organization_id_fkey.
--   Layer 3 — activity_events.item_id is ON DELETE SET NULL; deleting an item during
--     teardown fires an UPDATE on activity_events, which the 0005 append-only guard
--     refuses (it only excepted DELETE-when-org-gone, not UPDATE-when-org-gone).
--
-- The fix uses the same test 0005/0006 established: inside the teardown transaction
-- the parent org row is ALREADY gone, which cleanly distinguishes a cascade from
-- tampering under a live org.
--
-- ⚠️ Invariant preserved: for a LIVE org, activity_events stays fully append-only —
-- the service role still cannot UPDATE or DELETE an audit row, and the audit
-- triggers still fire normally. Only the org-gone escape is added. The m5 positive
-- control (a live-org audit mutation must still be refused) must stay green.

-- ── Layer 2: skip audit logging on DELETE when the org is already gone ──────────
-- The `*_removed` event would reference a deleted org (FK violation) and, since the
-- org's whole audit trail is cascading away in the same statement, would have no
-- reader. For a live org this is unchanged — the removal is still logged.
create or replace function log_responsible_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'responsible_role_added',
            jsonb_build_object('role_id', new.role_id, 'is_primary', new.is_primary));
  elsif (tg_op = 'DELETE') then
    if exists (select 1 from organizations o where o.id = old.organization_id) then
      insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
      values (old.organization_id, old.item_id, auth.uid(), 'responsible_role_removed',
              jsonb_build_object('role_id', old.role_id));
    end if; -- org gone -> teardown cascade, skip
  elsif (tg_op = 'UPDATE' and new.is_primary is distinct from old.is_primary) then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'primary_role_changed',
            jsonb_build_object('role_id', new.role_id, 'is_primary', new.is_primary));
  end if;
  return coalesce(new, old);
end; $$;

create or replace function log_assigned_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'assigned_user_added',
            jsonb_build_object('user_id', new.user_id, 'is_primary', new.is_primary));
  elsif (tg_op = 'DELETE') then
    if exists (select 1 from organizations o where o.id = old.organization_id) then
      insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
      values (old.organization_id, old.item_id, auth.uid(), 'assigned_user_removed',
              jsonb_build_object('user_id', old.user_id));
    end if; -- org gone -> teardown cascade, skip
  elsif (tg_op = 'UPDATE' and new.is_primary is distinct from old.is_primary) then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'primary_user_changed',
            jsonb_build_object('user_id', new.user_id, 'is_primary', new.is_primary));
  end if;
  return coalesce(new, old);
end; $$;

-- ── Layer 3: allow the teardown SET NULL (an UPDATE) when the org is gone ───────
-- Previously only DELETE-when-org-gone was excepted; the item_id SET NULL is an
-- UPDATE and hit the exception. `old` is populated on both UPDATE and DELETE, so
-- old.organization_id is the org either way. Live-org UPDATE/DELETE still raises.
create or replace function forbid_activity_event_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if not exists (select 1 from organizations o where o.id = old.organization_id) then
      return coalesce(new, old);  -- organization teardown/cascade, allow
    end if;
  end if;

  raise exception
    'activity_events is append-only: % is not permitted (PDL-018 / TDL-004).', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;
