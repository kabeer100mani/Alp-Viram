# Modules

Each feature lives in its own module folder and follows the same shape so any
module is independently understandable and extensible:

```
<module>/
├─ components/   UI only — no business logic, no data access
├─ hooks/        React glue between UI and services
├─ services/     business logic — framework-free, unit-testable
├─ data/         the ONLY place that talks to Supabase (repositories)
└─ types.ts      module-local types
```

Rules:

- UI never imports Supabase directly — it calls hooks/services.
- Services never import React.
- Only `data/` accesses the database.

Planned modules: `auth`, `organizations`, `roles`, `projects`, `items`,
`inbox`, `assistant`. They are added milestone by milestone, not up front.
