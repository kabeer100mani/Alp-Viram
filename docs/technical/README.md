# Technical Design Package

The data-model specification for Alp-Viram, built from the approved Product Design
Package. **No migrations, APIs, or application code are written until this data
model is reviewed and approved.**

| # | Document | Purpose |
| --- | --- | --- |
| 1 | [Entity Relationship Diagram](01-erd.md) | Entities, relationships, cardinality, keys, enums (with a Mermaid diagram). |
| 2 | [Database Design](02-database-design.md) | Every table: purpose, columns, constraints, indexes, RLS, future, challenges. |
| 3 | [Technical Decision Log](03-technical-decision-log.md) | Technical decisions: why, alternatives, trade-offs, status. |

Built on the approved [Product Design Package](../product/README.md).

Planned after data-model approval: API design → Auth → business logic → UI →
Milestone 1.
