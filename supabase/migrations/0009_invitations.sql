-- 0009_invitations.sql
-- M5 (People & Roles), Gate A — member invitations.
--
-- Why this is needed at all: there is no client path to add anyone to an org.
-- organization_members needs a real user_id and members_insert requires
-- is_org_admin; profiles has no email and profiles_select only exposes people who
-- ALREADY share your org. So an admin cannot even discover an invitee, let alone
-- add them. This table + the accept-invite Edge Function close that gap.
--
-- Model: link/token invite. Email DELIVERY is deferred (PDL-011) — the admin
-- copies a link. The token is the capability: whoever holds it, and whose signed-in
-- email matches, may join. So the token must be unguessable and never exposed to
-- non-admins through RLS.

create type invitation_status as enum ('pending', 'accepted', 'revoked');

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            org_member_role not null default 'member',
  token           text not null unique,
  status          invitation_status not null default 'pending',
  invited_by      uuid references profiles(id),
  accepted_by     uuid references profiles(id),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  -- One live invite per email per org: re-inviting updates the existing pending
  -- row rather than accumulating duplicates.
  constraint uq_invitations_pending unique (organization_id, email)
);
create index idx_invitations_org on invitations(organization_id, status);
-- Owner can't be granted via an invite — owner is protected (0003) and must be an
-- explicit, deliberate act, never something a link can confer.
alter table invitations add constraint chk_invite_role_not_owner check (role <> 'owner');

-- Normalise email so "A@x.com" and "a@x.com " can't create two invites / dodge match.
create or replace function normalise_invite_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end; $$;
create trigger trg_invitations_email before insert or update on invitations
  for each row execute function normalise_invite_email();

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Admins manage their org's invites. There is deliberately NO broad SELECT for
-- invitees: the token is a secret, and a policy that let anyone read a pending
-- row by email would leak which orgs have invited an address. The accept path
-- runs in an Edge Function under the service role and looks a row up BY TOKEN, so
-- it does not need a client-visible read policy.
alter table invitations enable row level security;

create policy p_invitations_admin_read on invitations for select
  using (is_org_admin(organization_id));
create policy p_invitations_admin_insert on invitations for insert
  with check (is_org_admin(organization_id) and invited_by = auth.uid());
create policy p_invitations_admin_update on invitations for update
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy p_invitations_admin_delete on invitations for delete
  using (is_org_admin(organization_id));
