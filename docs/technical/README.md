# Technical Design Package

The data-model specification for Alp-Viram, built from the approved Product Design
Package.

> ✅ **APPROVED & LOCKED 2026-07-11 — Technical Design Phase COMPLETE.**
> Implementation has begun (Milestone 1).

| # | Document | Purpose |
| --- | --- | --- |
| 1 | [Entity Relationship Diagram](01-erd.md) | Entities, relationships, cardinality, keys, enums (with a Mermaid diagram). |
| 2 | [Database Design](02-database-design.md) | Every table: purpose, columns, constraints, indexes, RLS, future, challenges. |
| 3 | [Technical Decision Log](03-technical-decision-log.md) | Technical decisions: why, alternatives, trade-offs, status. |
| 8 | [Permission Model](08-permission-model.md) | Who may read/write/delete what, and why. Written **after** implementation. |
| 9 | [Responsibility Model](09-responsibility-model.md) | Role→person indirection, time-bounded assignments, derivation. Written **after** implementation. |

> Docs 8 and 9 keep their **global** numbering (as referenced throughout the
> package and in `docs/product/README.md`), not a folder-local sequence — Docs 6
> and 7 of that plan became `01-erd.md` and `02-database-design.md` here.

Built on the approved [Product Design Package](../product/README.md).

Also: [Technical Debt Register](TECHNICAL_DEBT.md) — the canonical list.
