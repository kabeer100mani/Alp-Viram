-- 0012_rename_leftover_list_constraints.sql
-- Housekeeping after 0011. `alter table projects rename to lists` keeps the old
-- CONSTRAINT names, so the lists table was still carrying projects_*_fkey. Renaming
-- indexes/policies/triggers but not these was an oversight in 0011 — a future
-- reader (or red-team) should not have to wonder what "projects" is.
alter table lists rename constraint projects_organization_id_fkey to lists_organization_id_fkey;
alter table lists rename constraint projects_created_by_fkey to lists_created_by_fkey;
alter table lists rename constraint projects_pkey to lists_pkey;
