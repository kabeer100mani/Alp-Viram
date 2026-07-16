-- 0011_folders_and_lists.sql
-- PDL-032 — REVERSAL: reinstate Folder → List as OPTIONAL structure.
--
-- "Workspace" = the existing Organization (no new top-level concept). The cheapest
-- correct path: rename the shipped `projects` table to `lists` (data, RLS and FKs
-- survive) and add `folders` above it. A List may sit in a Folder or at the Org root.
--
-- list_id stays NULLABLE: capture must remain zero-click and unfiled — an item with
-- no list lives in the Inbox exactly as before (PDL-005 / PDL-008 untouched).
--
-- Also fixes TD-008 in the same migration, since it rewrites this very FK.

-- ── 1. projects → lists (rename; data preserved) ──────────────────────────
alter table projects rename to lists;
alter index uq_projects_org_name rename to uq_lists_org_name;
alter index idx_projects_org rename to idx_lists_org;
alter trigger trg_projects_updated on lists rename to trg_lists_updated;
alter table items rename column project_id to list_id;
alter index idx_items_org_project rename to idx_items_org_list;

-- Policy names should say what they guard.
drop policy if exists p_projects on lists;
create policy p_lists on lists for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ── 2. TD-008 — tenant-safety gap on the item→list FK ─────────────────────
-- `items.project_id` referenced projects(id) with a PLAIN FK: nothing forced the
-- list to belong to the item's own organization, so a member could point their
-- item at another tenant's list id. This is the cross-tenant smuggling class that
-- migration 0003 closed for item_tags / item_responsible_roles / item_assigned_users
-- / item_collaborators / meeting_details — projects were missed.
--
-- Fixed here with the same composite-FK pattern: the child's organization_id must
-- equal the parent's.
alter table lists add constraint uq_lists_id_org unique (id, organization_id);

-- Null out any pre-existing cross-tenant references so the new constraint can hold.
-- (Expected to affect zero rows; done explicitly rather than letting the migration
-- fail on dirty data.)
update items i set list_id = null
 where i.list_id is not null
   and not exists (
     select 1 from lists l
      where l.id = i.list_id and l.organization_id = i.organization_id
   );

alter table items drop constraint items_project_id_fkey;
alter table items add constraint items_list_fk
  foreign key (list_id, organization_id) references lists(id, organization_id)
  on delete set null;

-- ── 3. folders (optional parent of lists) ─────────────────────────────────
create table folders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  color           text,
  position        int not null default 0,
  is_archived     boolean not null default false,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_folders_id_org unique (id, organization_id)
);
create unique index uq_folders_org_name on folders(organization_id, lower(name));
create index idx_folders_org on folders(organization_id, is_archived);
create trigger trg_folders_updated before update on folders
  for each row execute function set_updated_at();

alter table folders enable row level security;
create policy p_folders on folders for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ── 4. lists.folder_id (optional: a List may live at the Org root) ────────
alter table lists add column folder_id uuid;
alter table lists add column position int not null default 0;
-- Composite FK again: a list can only sit in a folder of its own organization.
alter table lists add constraint lists_folder_fk
  foreign key (folder_id, organization_id) references folders(id, organization_id)
  on delete set null;
create index idx_lists_folder on lists(folder_id, position);

-- ── 5. Retire, never delete (TDL-009) ─────────────────────────────────────
-- Folders and lists carry history (items reference them), so they are archived via
-- is_archived rather than deleted. DELETE is left granted for now — unlike items,
-- deleting a list only nulls item.list_id (no audit linkage is lost) and no
-- responsibility derives from it. Revisit if that stops being true.
