-- 0001_identity_and_tenancy.sql
-- Milestone 1 — Identity & Multi-Tenant Foundation
-- Tables: profiles, organizations, organization_members
-- Plus: enums, RLS policies, helper functions, updated_at trigger, and a
-- new-user bootstrap that creates a profile + personal org + owner membership.

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────
create type org_member_role as enum ('owner', 'admin', 'member');

-- ── updated_at helper ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles (1:1 with auth.users) ───────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ── organizations (tenant boundary; always exists, hidden for solo) ──────
create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  is_personal  boolean not null default true,   -- progressive disclosure signal
  team_enabled boolean not null default false,  -- flips when collaboration begins
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_orgs_updated before update on organizations
  for each row execute function set_updated_at();

-- ── organization_members (membership + PLATFORM permission) ──────────────
create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            org_member_role not null default 'member',
  is_active       boolean not null default true,
  invited_by      uuid references profiles(id),
  invited_at      timestamptz,
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_members_org  on organization_members(organization_id);
create index idx_org_members_user on organization_members(user_id);

-- ── Helper functions (security definer → avoid RLS recursion) ────────────
create or replace function is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
      and m.is_active and m.role in ('owner','admin')
  );
$$;

create or replace function shares_org_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from organization_members a
    join organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = target
      and a.is_active and b.is_active
  );
$$;

-- ── Row Level Security ───────────────────────────────────────────────────
alter table profiles             enable row level security;
alter table organizations        enable row level security;
alter table organization_members enable row level security;

-- profiles: yourself, or anyone sharing an org with you
create policy profiles_select on profiles for select
  using (id = auth.uid() or shares_org_with(id));
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

-- organizations: members read; any authed user may create; admins update
create policy orgs_select on organizations for select
  using (is_org_member(id));
create policy orgs_insert on organizations for insert
  with check (created_by = auth.uid());
create policy orgs_update on organizations for update
  using (is_org_admin(id)) with check (is_org_admin(id));

-- organization_members: members read; admins manage
create policy members_select on organization_members for select
  using (is_org_member(organization_id));
create policy members_insert on organization_members for insert
  with check (is_org_admin(organization_id));
create policy members_update on organization_members for update
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy members_delete on organization_members for delete
  using (is_org_admin(organization_id));

-- ── New-user bootstrap ───────────────────────────────────────────────────
-- On sign-up: create a profile, a personal organization, and an owner membership.
-- Runs as security definer so it bypasses RLS for the initial rows.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  base_slug  text;
  final_slug text;
  suffix     int := 0;
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );

  base_slug  := 'org-' || substr(new.id::text, 1, 8);
  final_slug := base_slug;
  while exists (select 1 from organizations where slug = final_slug) loop
    suffix     := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into organizations (name, slug, is_personal, created_by)
  values ('My Workspace', final_slug, true, new.id)
  returning id into new_org_id;

  insert into organization_members (organization_id, user_id, role, is_active)
  values (new_org_id, new.id, 'owner', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Team-state sync ──────────────────────────────────────────────────────
-- Flip a personal org into team mode when it gains a 2nd active member.
-- This drives progressive disclosure (TDL-013 / PDL-022) at the DATA layer, so
-- the signal can never drift regardless of who inserts the membership. Explicit
-- "enable team collaboration" is a separate admin update to team_enabled.
create or replace function sync_org_team_state()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from organization_members
      where organization_id = new.organization_id and is_active) > 1 then
    update organizations
       set is_personal = false, team_enabled = true
     where id = new.organization_id and is_personal = true;
  end if;
  return new;
end;
$$;

create trigger trg_org_team_state
  after insert on organization_members
  for each row execute function sync_org_team_state();
