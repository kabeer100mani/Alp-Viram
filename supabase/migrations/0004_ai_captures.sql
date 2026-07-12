-- 0004_ai_captures.sql
-- Milestone 3 (AI Inbox): store each raw capture + the AI's classification result.
-- Powers the experience metrics (% needing clarification, etc.) and future learning.

create table ai_captures (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  user_id                uuid references profiles(id),
  raw_input              text not null,
  parsed                 jsonb not null default '{}'::jsonb,
  provider               text,
  model                  text,
  confidence             numeric,
  required_clarification boolean not null default false,
  resulting_item_id      uuid,
  created_at             timestamptz not null default now(),
  -- composite FK keeps the linked item in the same org (no cross-tenant smuggling)
  constraint aic_item_fk foreign key (resulting_item_id, organization_id)
    references items(id, organization_id) on delete set null
);
create index idx_ai_captures_org on ai_captures(organization_id, created_at);

alter table ai_captures enable row level security;
create policy p_ai_captures_read on ai_captures for select
  using (is_org_member(organization_id));
create policy p_ai_captures_insert on ai_captures for insert
  with check (is_org_member(organization_id) and user_id = auth.uid());
create policy p_ai_captures_update on ai_captures for update
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
