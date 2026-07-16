-- 0010_checklists_and_dod.sql
-- Checklists + Definition of Done on items.
--
-- Neither was ever in the frozen package — no decision rejected them, they were
-- simply never captured (verified 2026-07-16 across all PDLs/docs). So this is
-- additive: nothing locked is being reversed here.
--
-- DoD ships as a plain note field, deliberately NOT enforced (Palash, 2026-07-16):
-- completing an item does not require the DoD to be satisfied. Tightening later is
-- a column-compatible change.

-- ── Definition of Done ────────────────────────────────────────────────────
alter table items add column definition_of_done text;

-- A Note has no done-state (IA §Item types), so a "definition of done" on one is
-- meaningless. Mirrors the existing honesty CHECKs (chk_reminder_is_task etc.).
alter table items add constraint chk_dod_not_note
  check (definition_of_done is null or type <> 'note');

-- ── Checklists ────────────────────────────────────────────────────────────
create table checklist_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  item_id         uuid not null,
  text            text not null check (length(trim(text)) > 0),
  is_done         boolean not null default false,
  position        int not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Composite FK: the child's org must equal the parent's, so a checklist row can
  -- never be smuggled onto another tenant's item (the 0003 red-team pattern).
  constraint checklist_items_item_fk foreign key (item_id, organization_id)
    references items(id, organization_id) on delete cascade
);
create index idx_checklist_item on checklist_items(item_id, position);

create trigger trg_checklist_updated before update on checklist_items
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Read is org-wide (as items are); writing follows can_write_item — the same rule
-- the item card and every other item child table already obey (Doc 8 / 0005).
alter table checklist_items enable row level security;

create policy p_checklist_select on checklist_items for select
  using (is_org_member(organization_id));
create policy p_checklist_write on checklist_items for all
  using (is_org_member(organization_id) and can_write_item(item_id, organization_id))
  with check (is_org_member(organization_id) and can_write_item(item_id, organization_id));
