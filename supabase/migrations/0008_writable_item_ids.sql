-- 0008_writable_item_ids.sql
-- M3 (Workspace UI), Gate A — let the client ask which items it may write.
--
-- The card must not offer an action the database will refuse (Doc 8). The client
-- therefore needs the same answer `can_write_item()` gives — admin OR creator OR
-- assigned user OR current holder of a responsible role.
--
-- Re-implementing that in TypeScript would duplicate the authorization rule and
-- let it drift from the database, which is the one place it is actually enforced.
-- So this exposes the SAME function over a whole page of items in one round trip
-- (no N+1), keeping a single source of truth.
--
-- This is an affordance, not a control: RLS remains the enforcement, and the
-- repository still converts a refused write into a PermissionError.

create or replace function writable_item_ids(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select i.id
  from items i
  where i.id = any(p_ids)
    -- SECURITY DEFINER bypasses RLS, so re-assert tenancy explicitly: a caller
    -- must never learn anything about an item outside their own organization.
    and is_org_member(i.organization_id)
    and can_write_item(i.id, i.organization_id);
$$;

revoke all on function writable_item_ids(uuid[]) from public;
grant execute on function writable_item_ids(uuid[]) to authenticated;
