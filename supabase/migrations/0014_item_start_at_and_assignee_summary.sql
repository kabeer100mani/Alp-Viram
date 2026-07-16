-- 0014_item_start_at_and_assignee_summary.sql
-- Dense table view (PDL-034): the one requested column that wasn't a real field.
--
-- `start_at` was earmarked "Future" in the DB design; the dense table promotes it
-- to a real column now. Nullable — an item needs no start date, and nothing about
-- capture changes. A Note has no execution, so (like due/reminder) start_at is
-- task/meeting-only, enforced by CHECK to keep the field honest.

alter table items add column start_at timestamptz;
alter table items add constraint chk_start_is_not_note
  check (start_at is null or type <> 'note');

-- Batched assignee/derived-responsible summary for a page of items.
--
-- The card fetched responsibility one item at a time (useItemResponsibility per
-- card). A table's Assignee column over N rows would be N round trips; this
-- returns the whole page in one call. SECURITY DEFINER + explicit is_org_member so
-- it can join across the responsibility tables without re-entering RLS, while
-- never revealing anything outside the caller's org.
--
-- Returns, per item: the primary (or any) assigned user, and the current derived
-- responsible holder via the role's assignment window (Doc 9 / current_responsible_users).
create or replace function item_assignee_summary(p_ids uuid[])
returns table (
  item_id        uuid,
  assigned_user  uuid,
  responsible_user uuid
)
language sql stable security definer set search_path = public as $$
  select
    i.id as item_id,
    (
      select iau.user_id from item_assigned_users iau
      where iau.item_id = i.id
      order by iau.is_primary desc, iau.created_at asc
      limit 1
    ) as assigned_user,
    (
      select r.user_id from current_responsible_users(i.id) r
      order by r.is_primary desc
      limit 1
    ) as responsible_user
  from items i
  where i.id = any(p_ids)
    and is_org_member(i.organization_id);
$$;

revoke all on function item_assignee_summary(uuid[]) from public;
grant execute on function item_assignee_summary(uuid[]) to authenticated;
