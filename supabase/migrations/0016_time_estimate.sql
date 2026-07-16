-- 0016_time_estimate.sql
-- Task detail panel (PDL-036): a "Time estimate" quick field.
--
-- This is an ESTIMATE (a planned duration), not time TRACKING — tracking stays
-- out of scope per Palash. The DB design already earmarked "estimate/effort" as
-- Future alongside start_at; this promotes it, exactly as 0014 did for start_at.
--
-- Minutes (int) rather than an interval: simple to edit ("2h 30m" → 150) and to
-- sum later if a totals row is ever wanted. Nullable — nothing requires it.
alter table items add column time_estimate_minutes int
  check (time_estimate_minutes is null or time_estimate_minutes > 0);

-- A Note has no execution, so (like start_at/due_at) an estimate is meaningless.
alter table items add constraint chk_estimate_not_note
  check (time_estimate_minutes is null or type <> 'note');
