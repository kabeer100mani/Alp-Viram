-- 0024_due_assumed.sql
-- PDL-047: at capture, when the AI extracts no due date, the app defaults it to
-- "today" instead of leaving it blank. `due_assumed` marks a due date the SYSTEM
-- assumed (not one the user typed or confirmed), so the UI can show a small
-- "assumed" marker that distinguishes it from a real, user-set date. The flag is
-- cleared whenever the user explicitly sets due_at (see updateItem).
alter table items add column due_assumed boolean not null default false;
