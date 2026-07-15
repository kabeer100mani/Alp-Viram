-- 0005_permission_hardening.sql
-- Permission Model milestone — access control keyed to the hybrid responsibility
-- model, plus the two open red-team items.
--
--   TDL-012  derive "who is responsible now" via SQL function (closes the log's
--            only *Proposed* decision — implemented, not materialized)
--   TD-001   items/roles/role_assignments allow hard-delete → revoke DELETE (TDL-009)
--   TD-002   activity_events not append-only vs service role → guard trigger
--
-- Before this migration every item-level policy was
--   `FOR ALL USING (is_org_member(organization_id))`
-- i.e. any org member could read, edit, reassign or hard-delete anything.


-- ── TDL-012 — derived responsibility ──────────────────────────────────────
-- An item never stores a person for responsibility; it stores a Role. Who is
-- responsible *now* is derived through the time-bounded role_assignments window
-- (PDL-015/PDL-020). Replacing a person = close one assignment, open another;
-- zero item rows change. Derived on read, never materialized (TDL-012/TDL-020).
--
-- SECURITY DEFINER is required: these are called from RLS policies and must read
-- the underlying tables without re-entering RLS (which would recurse). STABLE so
-- the planner can cache within a statement.

create or replace function is_current_role_holder(p_role_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra
    where ra.role_id = p_role_id
      and ra.user_id = auth.uid()
      and ra.valid_from <= now()
      and (ra.valid_to is null or ra.valid_to > now())
  );
$$;

/**
 * Current responsible people for an item, derived: role → current assignments.
 * The read model behind "who owns this right now" (no person is stored).
 */
create or replace function current_responsible_users(p_item_id uuid)
returns table (user_id uuid, role_id uuid, is_primary boolean)
language sql stable security definer set search_path = public as $$
  select ra.user_id, irr.role_id, irr.is_primary
  from item_responsible_roles irr
  join role_assignments ra on ra.role_id = irr.role_id
  where irr.item_id = p_item_id
    and ra.valid_from <= now()
    and (ra.valid_to is null or ra.valid_to > now());
$$;


-- ── Who may modify an item ────────────────────────────────────────────────
-- Write is granted to exactly four principals:
--   1. org admin/owner  — platform permission (TDL-017: distinct from business role)
--   2. the creator      — PDL-021 allows 0 responsible roles, so an unassigned
--                         capture must still be editable by whoever captured it
--   3. an assigned user — execution axis (item_assigned_users)
--   4. a current holder of a responsible role — responsibility axis, derived
-- Collaborators deliberately get NO write (they are read/participate only).
--
-- Read is intentionally NOT narrowed here: fine-grained item visibility is
-- explicitly deferred to Doc 8 (02-database-design.md). Org members still read
-- all items in their org, as before. This keeps list queries off the per-row
-- function and avoids inventing a visibility rule that was never specified.

create or replace function can_write_item(p_item_id uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    is_org_admin(p_org)
    or exists (
      select 1 from items i
      where i.id = p_item_id and i.created_by = auth.uid()
    )
    or exists (
      select 1 from item_assigned_users a
      where a.item_id = p_item_id and a.user_id = auth.uid()
    )
    or exists (
      select 1 from current_responsible_users(p_item_id) r
      where r.user_id = auth.uid()
    );
$$;


-- ── items ─────────────────────────────────────────────────────────────────
-- `FOR ALL` also granted DELETE to every member. Hard-delete cascades the
-- responsibility/assignment/tag/meeting rows and sets activity_events.item_id to
-- NULL — audit survives but loses its subject, becoming unattributable. Each
-- history-bearing table has a soft-retire path, so DELETE is simply not granted:
--   items.deleted_at · roles.is_active · role_assignments.valid_to
-- Omitting a DELETE policy denies DELETE (RLS is deny-by-default).

drop policy if exists p_items on items;
create policy p_items_select on items for select
  using (is_org_member(organization_id));
-- created_by must be the caller: it grants write, so it must not be forgeable.
create policy p_items_insert on items for insert
  with check (is_org_member(organization_id) and created_by = auth.uid());
create policy p_items_update on items for update
  using (is_org_member(organization_id) and can_write_item(id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(id, organization_id));
-- (no DELETE policy → retire via deleted_at)

-- created_by grants write, so it must be immutable: otherwise anyone who can
-- currently write (e.g. a temporary assignee) could set themselves as creator
-- and keep write access permanently after being unassigned.
create or replace function forbid_created_by_change()
returns trigger language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'items.created_by is immutable (attribution integrity).'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_items_created_by_immutable on items;
create trigger trg_items_created_by_immutable
  before update on items
  for each row execute function forbid_created_by_change();


-- ── item child tables ─────────────────────────────────────────────────────
-- These MUST be gated on can_write_item, otherwise the model is bypassable:
-- a member could simply insert themselves into item_assigned_users and thereby
-- grant themselves write on any item in the org.
-- DELETE stays granted here (unassign/untag is the *designed* operation and is
-- logged to activity_events by trigger) — these are current state, not history.

drop policy if exists p_irr on item_responsible_roles;
create policy p_irr_select on item_responsible_roles for select
  using (is_org_member(organization_id));
create policy p_irr_write on item_responsible_roles for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));

drop policy if exists p_iau on item_assigned_users;
create policy p_iau_select on item_assigned_users for select
  using (is_org_member(organization_id));
create policy p_iau_write on item_assigned_users for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));

drop policy if exists p_icol on item_collaborators;
create policy p_icol_select on item_collaborators for select
  using (is_org_member(organization_id));
create policy p_icol_write on item_collaborators for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));

drop policy if exists p_item_tags on item_tags;
create policy p_item_tags_select on item_tags for select
  using (is_org_member(organization_id));
create policy p_item_tags_write on item_tags for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));

drop policy if exists p_meeting on meeting_details;
create policy p_meeting_select on meeting_details for select
  using (is_org_member(organization_id));
create policy p_meeting_write on meeting_details for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));


-- ── roles & role_assignments ──────────────────────────────────────────────
-- Admin-only writes (unchanged), but DELETE is revoked: deleting a role cascades
-- role_assignments AND item_responsible_roles, erasing the responsibility record
-- the whole model derives from. Retire instead: roles.is_active = false,
-- role_assignments.valid_to = now(). SELECT is unaffected (p_roles_read/p_ra_read).

drop policy if exists p_roles_modify on roles;
create policy p_roles_insert on roles for insert
  with check (is_org_admin(organization_id));
create policy p_roles_update on roles for update
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
-- (no DELETE policy → retire via is_active = false)

drop policy if exists p_ra_write on role_assignments;
create policy p_ra_insert on role_assignments for insert
  with check (is_org_admin(organization_id));
create policy p_ra_update on role_assignments for update
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
-- (no DELETE policy → close via valid_to)


-- ── TD-002 — activity_events is append-only, including for the service role ─
-- Clients are already blocked (select-only; client INSERT removed in 0003). The
-- remaining hole: RLS is bypassed by BYPASSRLS roles — notably `service_role` —
-- so a compromised service key could rewrite history.
--
-- A TRIGGER is the correct control: triggers run for every writer, including
-- BYPASSRLS roles and the table owner. (`FORCE ROW LEVEL SECURITY` is
-- deliberately NOT used: it does not constrain BYPASSRLS roles so it would not
-- close this hole, and with no INSERT policy present it would instead risk
-- blocking the SECURITY DEFINER audit triggers that legitimately append rows.)
--
-- Org deletion must still cascade: when an organization is removed Postgres
-- deletes its activity_events. The parent row is already gone at that point,
-- which distinguishes a legitimate cascade from erasing history under a live org.

create or replace function forbid_activity_event_mutation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from organizations o where o.id = old.organization_id) then
      return old;  -- organization cascade, allow
    end if;
  end if;

  raise exception
    'activity_events is append-only: % is not permitted (PDL-018 / TDL-004).', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_activity_events_no_update on activity_events;
create trigger trg_activity_events_no_update
  before update on activity_events
  for each row execute function forbid_activity_event_mutation();

drop trigger if exists trg_activity_events_no_delete on activity_events;
create trigger trg_activity_events_no_delete
  before delete on activity_events
  for each row execute function forbid_activity_event_mutation();
