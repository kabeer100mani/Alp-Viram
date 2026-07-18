-- 0023_allow_first_owner_seed.sql
-- Fix protect_owner_membership so self-service workspace creation (PDL-045, 0022)
-- can seed its own first owner.
--
-- The guard (0006) blocks granting `owner` unless auth.uid() is already an owner of
-- the org. The sign-up bootstrap (handle_new_user) slips through only because it
-- runs with auth.uid() = null. create_organization() runs as a signed-in user, so
-- auth.uid() is NOT null and the caller is not yet an owner of the brand-new org →
-- the owner-seed was refused ("only an owner can assign the owner role").
--
-- The correct generalisation of the rule "only an existing owner may grant owner"
-- is: block only when the org ALREADY has an active owner. Seeding the FIRST owner
-- of an owner-less org is legitimate bootstrap. A live org can never reach zero
-- owners (the last-owner rule below prevents removing the final one), so this branch
-- only ever fires during genuine creation — a member of an existing org still cannot
-- escalate to owner. No security regression; the escalation threat is unchanged.

create or replace function protect_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (b) organization cascade → allow. The last-owner rule protects a live org.
  if tg_op = 'DELETE'
     and not exists (select 1 from organizations o where o.id = old.organization_id) then
    return old;
  end if;

  -- Only an existing owner may grant the owner role — EXCEPT when seeding the first
  -- owner of an owner-less org (bootstrap: sign-up, or create_organization). Bootstrap
  -- via handle_new_user still passes with auth.uid() = null; this adds the on-demand case.
  if (tg_op in ('INSERT','UPDATE')) and new.role = 'owner'
     and auth.uid() is not null
     and exists (
       select 1 from organization_members m
        where m.organization_id = new.organization_id
          and m.role = 'owner' and m.is_active and m.id <> new.id
     )
     and not is_org_owner(new.organization_id) then
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
