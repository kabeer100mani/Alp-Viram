-- 0021_project_context.sql
-- Free-text Project context (PDL-044, D2): what the project is about / who's
-- involved. Fed to the capture follow-up as KEYWORD-first ranking of the user's
-- real lists (no AI needed for the common case; the AI never guesses a list —
-- PDL-032/PDL-042). Plain nullable text — no structured team/role data (D2), which
-- would fight the org-scoped role model (project-level roles stay Future).
alter table projects add column context text;
