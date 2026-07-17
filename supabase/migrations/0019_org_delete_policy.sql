-- 0019_org_delete_policy.sql
-- Make organization deletion REACHABLE by its owner (TD-007, M7 Gate B).
--
-- 0018 made teardown *complete*; there was still no policy letting a client delete
-- an organization at all (only the service role could, in the red-team). An owner
-- deleting their own org is the owner acting on their own tenant — the RLS layer is
-- the right control (this is not a privilege the client shouldn't have; it's an
-- owner's deliberate, confirmed action), consistent with orgs_update using
-- is_org_admin.
--
-- Owner-only (stricter than admin) for a nuclear, irreversible action. The
-- protect_owner_membership trigger guarantees an org always has a live owner, so
-- "is_org_owner" is always answerable.
drop policy if exists orgs_delete on organizations;
create policy orgs_delete on organizations for delete
  using (is_org_owner(id));
