-- 0002_core_domain.sql
-- Milestone 2 — Core domain: roles, assignments, projects, tags, items,
-- meeting_details, hybrid responsibility/assignment tables, saved views, and the
-- append-only activity_events audit (with triggers that log ownership/state
-- changes from the first migration that touches ownership — Architect Rec B5).

-- ── Enums ────────────────────────────────────────────────────────────────
create type item_type  as enum ('task', 'note', 'meeting');
create type item_state as enum ('captured', 'committed', 'in_progress', 'done', 'snoozed', 'backlog');
create type priority   as enum ('none', 'low', 'medium', 'high', 'urgent');
create type activity_event_type as enum (
  'created', 'state_changed', 'completed',
  'responsible_role_added', 'responsible_role_removed', 'primary_role_changed',
  'assigned_user_added', 'assigned_user_removed', 'primary_user_changed',
  'moved_project', 'tag_added', 'tag_removed'
);

-- ── roles (durable business responsibilities) ────────────────────────────
create table roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index uq_roles_org_name on roles(organization_id, lower(name));
create index idx_roles_org on roles(organization_id);
create trigger trg_roles_updated before update on roles
  for each row execute function set_updated_at();

-- ── role_assignments (time-bounded user<->role indirection) ──────────────
create table role_assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index idx_role_assign_role on role_assignments(role_id, valid_to);
create index idx_role_assign_user on role_assignments(user_id, valid_to);
create index idx_role_assign_current on role_assignments(role_id) where valid_to is null;

-- ── projects (optional flat grouping) ────────────────────────────────────
create table projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  color           text,
  is_archived     boolean not null default false,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index uq_projects_org_name on projects(organization_id, lower(name));
create index idx_projects_org on projects(organization_id, is_archived);
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

-- ── tags (flat labels) ───────────────────────────────────────────────────
create table tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  color           text,
  created_at      timestamptz not null default now()
);
create unique index uq_tags_org_name on tags(organization_id, lower(name));

-- ── items (the unit of work) ─────────────────────────────────────────────
create table items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type            item_type not null,
  state           item_state not null default 'captured',
  title           text not null check (length(trim(title)) > 0),
  body            text,
  priority        priority not null default 'none',
  project_id      uuid references projects(id) on delete set null,
  due_at          timestamptz,
  remind_at       timestamptz,
  snoozed_until   timestamptz,
  completed_at    timestamptz,
  is_reminder     boolean not null default false,  -- reminder = task metadata
  waiting_on      text,                            -- follow-up = task metadata
  is_reference    boolean not null default false,  -- knowledge = note metadata
  source          text not null default 'manual',  -- inbox | manual | ai
  ai_confidence   numeric,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- type-specific metadata must stay honest:
  constraint chk_reminder_is_task   check (is_reminder = false or type = 'task'),
  constraint chk_waiting_is_task    check (waiting_on is null or type = 'task'),
  constraint chk_reference_is_note  check (is_reference = false or type = 'note'),
  -- full-text search vector
  search tsvector generated always as
    (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored
);
create index idx_items_org_state   on items(organization_id, state) where deleted_at is null;
create index idx_items_org_due      on items(organization_id, due_at) where deleted_at is null;
create index idx_items_org_project  on items(organization_id, project_id) where deleted_at is null;
create index idx_items_org_type     on items(organization_id, type) where deleted_at is null;
create index idx_items_search       on items using gin(search);
create trigger trg_items_updated before update on items
  for each row execute function set_updated_at();

-- ── meeting_details (1:1 with meeting items; calendar-ready) ─────────────
create table meeting_details (
  item_id             uuid primary key references items(id) on delete cascade,
  organization_id     uuid not null references organizations(id) on delete cascade,
  starts_at           timestamptz,
  ends_at             timestamptz,
  location            text,
  agenda              text,
  outcome_notes       text,
  external_calendar_id text,
  external_provider   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_meeting_org_starts on meeting_details(organization_id, starts_at);
create trigger trg_meeting_updated before update on meeting_details
  for each row execute function set_updated_at();

-- ── item_tags (M:N) ──────────────────────────────────────────────────────
create table item_tags (
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references items(id) on delete cascade,
  tag_id          uuid not null references tags(id) on delete cascade,
  primary key (item_id, tag_id)
);
create index idx_item_tags_tag on item_tags(tag_id);

-- ── item_responsible_roles (responsibility; multi, one primary) ──────────
create table item_responsible_roles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references items(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  is_primary      boolean not null default false,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  unique (item_id, role_id)
);
create unique index uq_irr_primary on item_responsible_roles(item_id) where is_primary;
create index idx_irr_item on item_responsible_roles(item_id);
create index idx_irr_role on item_responsible_roles(role_id);

-- ── item_assigned_users (execution; multi, one primary) ──────────────────
create table item_assigned_users (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references items(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  is_primary      boolean not null default false,
  assigned_via    text not null default 'direct',  -- direct | role_derived
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  unique (item_id, user_id)
);
create unique index uq_iau_primary on item_assigned_users(item_id) where is_primary;
create index idx_iau_item on item_assigned_users(item_id);
create index idx_iau_user on item_assigned_users(user_id);

-- ── item_collaborators (optional) ────────────────────────────────────────
create table item_collaborators (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null references items(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (item_id, user_id)
);
create index idx_icol_item on item_collaborators(item_id);
create index idx_icol_user on item_collaborators(user_id);

-- ── saved_views (system + custom filters) ────────────────────────────────
create table saved_views (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_id        uuid references profiles(id) on delete cascade,  -- null = system/shared
  name            text not null,
  filter          jsonb not null default '{}'::jsonb,
  is_system       boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_saved_views_org on saved_views(organization_id, owner_id);
create trigger trg_saved_views_updated before update on saved_views
  for each row execute function set_updated_at();

-- ── activity_events (append-only audit) ──────────────────────────────────
create table activity_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid references items(id) on delete set null,
  actor_id        uuid references profiles(id),
  event_type      activity_event_type not null,
  payload         jsonb not null default '{}'::jsonb,
  effective_at    timestamptz not null default now(),
  recorded_at     timestamptz not null default now()
);
create index idx_activity_item on activity_events(item_id, recorded_at);
create index idx_activity_org  on activity_events(organization_id, recorded_at);

-- ── Audit triggers (write append-only events on ownership/state change) ──
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
    if (new.project_id is distinct from old.project_id) then
      insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
      values (new.organization_id, new.id, auth.uid(), 'moved_project',
              jsonb_build_object('from', old.project_id, 'to', new.project_id));
    end if;
  end if;
  return coalesce(new, old);
end; $$;
create trigger trg_log_item after insert or update on items
  for each row execute function log_item_change();

create or replace function log_responsible_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'responsible_role_added',
            jsonb_build_object('role_id', new.role_id, 'is_primary', new.is_primary));
  elsif (tg_op = 'DELETE') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (old.organization_id, old.item_id, auth.uid(), 'responsible_role_removed',
            jsonb_build_object('role_id', old.role_id));
  elsif (tg_op = 'UPDATE' and new.is_primary is distinct from old.is_primary) then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'primary_role_changed',
            jsonb_build_object('role_id', new.role_id, 'is_primary', new.is_primary));
  end if;
  return coalesce(new, old);
end; $$;
create trigger trg_log_irr after insert or update or delete on item_responsible_roles
  for each row execute function log_responsible_role_change();

create or replace function log_assigned_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'assigned_user_added',
            jsonb_build_object('user_id', new.user_id, 'is_primary', new.is_primary));
  elsif (tg_op = 'DELETE') then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (old.organization_id, old.item_id, auth.uid(), 'assigned_user_removed',
            jsonb_build_object('user_id', old.user_id));
  elsif (tg_op = 'UPDATE' and new.is_primary is distinct from old.is_primary) then
    insert into activity_events(organization_id, item_id, actor_id, event_type, payload)
    values (new.organization_id, new.item_id, auth.uid(), 'primary_user_changed',
            jsonb_build_object('user_id', new.user_id, 'is_primary', new.is_primary));
  end if;
  return coalesce(new, old);
end; $$;
create trigger trg_log_iau after insert or update or delete on item_assigned_users
  for each row execute function log_assigned_user_change();

-- ── Row Level Security ───────────────────────────────────────────────────
alter table roles                  enable row level security;
alter table role_assignments       enable row level security;
alter table projects               enable row level security;
alter table tags                   enable row level security;
alter table items                  enable row level security;
alter table meeting_details        enable row level security;
alter table item_tags              enable row level security;
alter table item_responsible_roles enable row level security;
alter table item_assigned_users    enable row level security;
alter table item_collaborators     enable row level security;
alter table saved_views            enable row level security;
alter table activity_events        enable row level security;

-- Member read/write tables (tenant-scoped by organization_id).
create policy p_roles_read   on roles for select using (is_org_member(organization_id));
create policy p_roles_modify on roles for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy p_ra_read     on role_assignments for select using (is_org_member(organization_id));
create policy p_ra_write    on role_assignments for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy p_projects on projects for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_tags     on tags     for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_items    on items    for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_meeting  on meeting_details for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_item_tags on item_tags for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_irr on item_responsible_roles for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_iau on item_assigned_users    for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy p_icol on item_collaborators    for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- saved_views: members read system + own; write own.
create policy p_views_read  on saved_views for select using (is_org_member(organization_id) and (is_system or owner_id = auth.uid()));
create policy p_views_write on saved_views for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and is_org_member(organization_id));

-- activity_events: members read + insert; NO update/delete (append-only).
create policy p_activity_read   on activity_events for select using (is_org_member(organization_id));
create policy p_activity_insert on activity_events for insert with check (is_org_member(organization_id));
