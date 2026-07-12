-- 0003_harden_rls.sql
-- Security hardening from the RLS red-team audit of 0002.
--   #1 HIGH  — cross-tenant FK smuggling → composite (id, organization_id) FKs
--   #2 M-HIGH — activity_events audit forgery → remove client INSERT policy
--   #4 MEDIUM — owner self-escalation / last-owner → owner-protection trigger
--   #5 LOW   — members creating org-wide is_system views → tighten WITH CHECK

-- ── #1 Composite foreign keys (org column must equal the parent's org) ───
alter table items add constraint uq_items_id_org unique (id, organization_id);
alter table roles add constraint uq_roles_id_org unique (id, organization_id);
alter table tags  add constraint uq_tags_id_org  unique (id, organization_id);

alter table item_tags
  drop constraint item_tags_item_id_fkey,
  drop constraint item_tags_tag_id_fkey,
  add constraint item_tags_item_fk
    foreign key (item_id, organization_id) references items(id, organization_id) on delete cascade,
  add constraint item_tags_tag_fk
    foreign key (tag_id, organization_id) references tags(id, organization_id) on delete cascade;

alter table item_responsible_roles
  drop constraint item_responsible_roles_item_id_fkey,
  drop constraint item_responsible_roles_role_id_fkey,
  add constraint irr_item_fk
    foreign key (item_id, organization_id) references items(id, organization_id) on delete cascade,
  add constraint irr_role_fk
    foreign key (role_id, organization_id) references roles(id, organization_id) on delete cascade;

alter table item_assigned_users
  drop constraint item_assigned_users_item_id_fkey,
  add constraint iau_item_fk
    foreign key (item_id, organization_id) references items(id, organization_id) on delete cascade;

alter table item_collaborators
  drop constraint item_collaborators_item_id_fkey,
  add constraint icol_item_fk
    foreign key (item_id, organization_id) references items(id, organization_id) on delete cascade;

alter table meeting_details
  drop constraint meeting_details_item_id_fkey,
  add constraint meeting_item_fk
    foreign key (item_id, organization_id) references items(id, organization_id) on delete cascade;

-- ── #2 activity_events is written only by triggers (security definer) and the
--       service role. Clients must not insert directly (prevents audit forgery).
drop policy p_activity_insert on activity_events;

-- ── #4 Owner protection: only an owner may grant 'owner'; keep >=1 owner ──
create or replace function is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
      and m.is_active and m.role = 'owner'
  );
$$;

create or replace function protect_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only an existing owner may create/grant the owner role.
  -- (Bootstrap runs with auth.uid() = null and is allowed to seed the first owner.)
  if (tg_op in ('INSERT','UPDATE')) and new.role = 'owner'
     and auth.uid() is not null and not is_org_owner(new.organization_id) then
    raise exception 'only an owner can assign the owner role';
  end if;

  -- Never remove/demote/deactivate the last active owner.
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner'
         and (new.role <> 'owner' or new.is_active = false)) then
    if (select count(*) from organization_members
        where organization_id = old.organization_id and role = 'owner'
          and is_active and id <> old.id) = 0 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_protect_owner
  before insert or update or delete on organization_members
  for each row execute function protect_owner_membership();

-- ── #5 Members cannot create org-wide (is_system) saved views ────────────
drop policy p_views_write on saved_views;
create policy p_views_write on saved_views for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_org_member(organization_id) and is_system = false);
