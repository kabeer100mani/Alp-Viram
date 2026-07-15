# Document 9 — Responsibility Model

> Part of the Technical Design Package. **Written after implementation** — this
> documents what was actually built in migration `0005_permission_hardening.sql`,
> not a forward-looking proposal. Referenced elsewhere as "Doc 9".
>
> Status: **implemented & verified** (`scripts/m5-permission-test.mjs`, 21 checks).
> Implements PDL-015 / PDL-020 / PDL-021 and closes TDL-012.

---

## 1. The idea

RACI's failure mode isn't its four roles — it's that they are bound to **people**.
People change; the mapping rots. Bind responsibility to a **role** instead, and
staleness inverts in your favour: replacing a person is one assignment change, and
every item they were responsible for follows automatically.

So an item **never stores a person for responsibility**. It stores a **Role**.

```
item ──> item_responsible_roles ──> roles ──> role_assignments ──> profiles
                                              (time-bounded)
```

"Who is responsible **now**" is *derived* at read time, never materialised (TDL-012/TDL-020).

## 2. Two orthogonal axes

| Axis | Question | Table | Cardinality |
| --- | --- | --- | --- |
| **Responsibility** | Who is accountable? (a *role*) | `item_responsible_roles` | 0..N roles, ≤1 `is_primary` |
| **Execution** | Who is doing it? (a *person*) | `item_assigned_users` | 0..N users, ≤1 `is_primary` |
| Collaborators | Who else is involved? | `item_collaborators` | 0..N, optional |

Single-primary is enforced by partial unique indexes (`uq_irr_primary`, `uq_iau_primary` — TDL-018).

Three supported modes: **role-only** (derive the people), **user-only** (no role),
**hybrid** (both). All three are valid; none is privileged.

**0 responsible roles is valid** (PDL-021). Capture never forces a role — that
would tax the very moment the product exists to make frictionless. This is why
the permission model treats `created_by` as a first-class principal (see Doc 8):
an unassigned capture must still be editable by whoever captured it.

## 3. The time-bounded indirection

`role_assignments` is a **temporal** table:

| Column | Meaning |
| --- | --- |
| `valid_from` | when this person began holding the role |
| `valid_to` | when they stopped; **`NULL` = currently holding** |

A person **currently** holds a role when `valid_from <= now() AND (valid_to IS NULL OR valid_to > now())`.

**Handover = close one row, open another. Zero item rows change.** Every item
responsible to that role silently follows the new holder. This is the differentiator.

Concurrent holders are allowed by design (no overlap constraint) — two people can
share a role during a transition.

## 4. What was built (the derivation — TDL-012)

TDL-012 was the technical log's only *Proposed* decision. It is now **implemented**
as SQL functions, derived on read, not materialised:

```sql
is_current_role_holder(p_role_id)      -- does auth.uid() hold this role right now?
current_responsible_users(p_item_id)   -- (user_id, role_id, is_primary) for an item, now
```

Both are `STABLE SECURITY DEFINER`. `SECURITY DEFINER` is **required**: they are
called from RLS policies and must read the underlying tables without re-entering
RLS, which would recurse.

`current_responsible_users` is the read model behind "who owns this right now".

## 5. Provenance

`item_assigned_users.assigned_via ∈ {direct, role_derived}` records *why* a person
is on an item — chosen directly, or materialised from a role. This keeps a
role-derived assignment distinguishable from a deliberate one.

## 6. Verified behaviour

From `scripts/m5-permission-test.mjs` (all passing against the live database):

- A user assigned to an item can edit it; once unassigned, they cannot.
- A user holding a **responsible role** for an item can edit it — access arrives
  through the role, with no item row naming them.
- **Closing their role assignment (`valid_to = now()`) revokes access immediately**,
  with no change to the item. This is the indirection proving itself.

## 7. Deliberately not built

| Deferred | Why |
| --- | --- |
| `delegations` table (PDL-017) | Grants the right to *act*, never ownership; does not cascade; reverts on expiry. Designed (TD-004) but not needed yet. |
| Point-in-time "who was responsible on date X" | The events are already written to `activity_events`; the read model is not built (PDL-018). |
| Role hierarchy / inheritance | Explicitly future (`02-database-design.md`). |
| Teams / sub-groups | Explicitly future. |

## 8. Related

- Permissions built on this model: [Document 8 — Permission Model](08-permission-model.md)
- Decisions: PDL-015, PDL-020, PDL-021, PDL-017, PDL-018 · TDL-003, TDL-012, TDL-018, TDL-020
- Research: [responsibility model research](../research/responsibility-model-research.md)
