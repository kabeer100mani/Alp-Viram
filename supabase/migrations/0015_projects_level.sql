-- 0015_projects_level.sql
-- PDL-035 — add the PROJECT level above Folder, completing the ClickUp-style
-- hierarchy: Organization(=Workspace) → Project → Folder → List → Item.
--
-- Corrects PDL-032, which (on my recommendation) collapsed Project into List to
-- avoid "three groupings". Palash's real requirement is all three container levels.
-- So: add `projects` (org-level), re-parent Folder under Project, and give List a
-- project directly (a List may sit in a Folder OR straight under a Project —
-- "folderless lists", approved 2026-07-16).
--
-- OPTIONAL throughout: an Item still needs no List (zero-click capture → Inbox),
-- and a List needs no Folder. Nothing about capture changes.

-- ── projects (org-level container) ────────────────────────────────────────
create table projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  color           text,
  position        int not null default 0,
  is_archived     boolean not null default false,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_projects_id_org unique (id, organization_id)
);
create unique index uq_projects_org_name on projects(organization_id, lower(name));
create index idx_projects_org on projects(organization_id, is_archived);
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;
-- Member-writable, like folders/lists (organising, not responsibility).
create policy p_projects on projects for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ── add project_id to folders and lists ───────────────────────────────────
alter table folders add column project_id uuid;
alter table lists   add column project_id uuid;

-- Backfill: every org that already has folders or lists gets one "General"
-- project, and its existing folders/lists move under it. (Done before NOT NULL so
-- the constraint can hold; expected to touch only the demo orgs.)
do $$
declare r record; pid uuid;
begin
  for r in (
    select distinct organization_id from folders
    union
    select distinct organization_id from lists
  ) loop
    insert into projects(organization_id, name) values (r.organization_id, 'General')
      returning id into pid;
    update folders set project_id = pid where organization_id = r.organization_id and project_id is null;
    update lists   set project_id = pid where organization_id = r.organization_id and project_id is null;
  end loop;
end $$;

-- ── folders: belong to a project ──────────────────────────────────────────
alter table folders alter column project_id set not null;
alter table folders add constraint uq_folders_id_project unique (id, project_id);
-- Composite FK: a folder's project must be in the folder's own organization.
alter table folders add constraint folders_project_fk
  foreign key (project_id, organization_id) references projects(id, organization_id) on delete cascade;
create index idx_folders_project on folders(project_id, position);

-- ── lists: belong to a project; optionally to a folder within it ──────────
alter table lists alter column project_id set not null;
alter table lists add constraint lists_project_fk
  foreign key (project_id, organization_id) references projects(id, organization_id) on delete cascade;
-- If a list IS in a folder, that folder must be in the SAME project. Composite FK
-- with a nullable column is skipped when folder_id is null (MATCH SIMPLE) — which
-- is exactly what allows folderless lists.
alter table lists add constraint lists_folder_project_fk
  foreign key (folder_id, project_id) references folders(id, project_id);
create index idx_lists_project on lists(project_id, position);
