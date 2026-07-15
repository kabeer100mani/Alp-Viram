-- 0006_fix_org_delete_cascade.sql
-- Bug fix (pre-existing, introduced in 0003): an organization can never be deleted.
--
-- 0003 added protect_owner_membership() to stop anyone stripping the final owner
-- from an organization. Its DELETE branch cannot distinguish two very different
-- events:
--   (a) someone removing the last owner from a LIVE org   → must be blocked
--   (b) the org itself being deleted, so ON DELETE CASCADE
--       removes its organization_members rows              → must be allowed
--
-- Because (b) raises 'cannot remove the last owner', deleting any organization
-- that has members — i.e. every real organization — fails outright.
--
-- Found by scripts/m5-permission-test.mjs while verifying the 0005 audit guard's
-- own cascade allowance; the guard was fine, this trigger was not.
--
-- Fix: use the same cascade test as 0005's activity_events guard. During an FK
-- cascade the parent row is already gone within the transaction, so its absence
-- distinguishes (b) from (a). This does NOT weaken the rule: it only permits the
-- delete when the organization no longer exists, which cannot be reached while
-- the org is live.

create or replace function protect_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (b) organization cascade → allow. The last-owner rule protects a live org.
  if tg_op = 'DELETE'
     and not exists (select 1 from organizations o where o.id = old.organization_id) then
    return old;
  end if;

  -- Only an existing owner may create/grant the owner role.
  -- (Bootstrap runs with auth.uid() = null and is allowed to seed the first owner.)
  if (tg_op in ('INSERT','UPDATE')) and new.role = 'owner'
     and auth.uid() is not null and not is_org_owner(new.organization_id) then
    raise exception 'only an owner can assign the owner role';
  end if;

  -- (a) Never remove/demote/deactivate the last active owner of a live org.
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner'
         and (new.role <> 'owner' or new.is_active = false)) then
    if (select count(*) from organization_members
        where organization_id = old.organization_id and role = 'owner'
          and is_active and id <> old.id) = 0 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;
