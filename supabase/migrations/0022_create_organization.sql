-- 0022_create_organization.sql
-- Self-service workspace creation (PDL-045). A signed-in user may create additional
-- personal organizations of their own — "Personal", "Job 1", "Job 2" — and switch
-- between them (the switcher from PDL-009 already lists every membership).
--
-- Why a SECURITY DEFINER routine and not two client inserts: orgs_insert already
-- lets any authed user create the organization row, but members_insert requires
-- is_org_admin(organization_id) — and the creator is NOT yet a member of the
-- brand-new org, so the owner-membership insert would be refused by RLS. This is
-- exactly why the sign-up bootstrap (handle_new_user, 0001) is SECURITY DEFINER;
-- this routine mirrors it for the on-demand case. The 8 system views seed
-- automatically via trg_seed_system_views (0007) on the organizations INSERT, and
-- sync_org_team_state (0001) leaves the org personal (only one member).

create or replace function create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  new_org_id uuid;
  base_slug  text;
  final_slug text;
  suffix     int := 0;
  clean_name text := nullif(btrim(p_name), '');
begin
  -- Runs as definer (bypasses RLS), so it must enforce its own guards.
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if clean_name is null then
    raise exception 'workspace name is required';
  end if;

  -- A random slug base (not the user id) so it never collides with the user's
  -- sign-up personal org (org-<uid8>); the loop keeps it unique regardless.
  base_slug  := 'org-' || substr(gen_random_uuid()::text, 1, 8);
  final_slug := base_slug;
  while exists (select 1 from organizations where slug = final_slug) loop
    suffix     := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  end loop;

  insert into organizations (name, slug, is_personal, created_by)
  values (clean_name, final_slug, true, uid)
  returning id into new_org_id;

  insert into organization_members (organization_id, user_id, role, is_active)
  values (new_org_id, uid, 'owner', true);

  return new_org_id;
end;
$$;

-- Callable only by a signed-in user; never anon.
revoke all on function create_organization(text) from public;
grant execute on function create_organization(text) to authenticated;
