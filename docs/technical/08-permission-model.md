# Document 8 — Permission Model

> Part of the Technical Design Package. **Written after implementation** — this
> documents what was actually built in migration `0005_permission_hardening.sql`,
> not a forward-looking proposal. Referenced elsewhere as "Doc 8".
>
> Status: **implemented & verified** (`scripts/m5-permission-test.mjs`, 21 checks
> passing against the live database). Closes TD-001 and TD-002.

---

## 1. What this replaced

Before `0005`, every item-level policy was:

```sql
create policy p_items on items for all using (is_org_member(organization_id));
```

`FOR ALL` grants SELECT/INSERT/UPDATE/**DELETE**. In practice: **any member of an
organization could read, edit, reassign, or hard-delete anything in it.** The
responsibility model existed as *data*, but enforced *nothing*.

## 2. Two independent axes (TDL-017)

This is the most load-bearing constraint in the design, and it is easy to get wrong:

| | Governs | Values | Table |
| --- | --- | --- | --- |
| **Platform permission** | app administration | `owner` / `admin` / `member` | `organization_members.role` |
| **Business responsibility** | work accountability | org-defined roles | `roles` + `role_assignments` |

They are **orthogonal**. An `admin` is not automatically responsible for anything;
a person responsible for critical work needs no elevated platform permission.

## 3. The rules as built

### Read — org-wide (unchanged, deliberately)
Any org member reads any non-deleted item in their org.

Fine-grained item visibility is explicitly **deferred** (`02-database-design.md`).
It was **not** invented here: narrowing reads without a specification would have
been a product decision disguised as a security fix. It also keeps list queries
off a per-row function.

### Write — four principals
`can_write_item(item_id, org)` returns true for:

1. **Org admin/owner** — platform permission.
2. **The creator** (`items.created_by`) — required by PDL-021: 0 responsible roles
   is valid, so an unassigned capture must remain editable by whoever captured it.
3. **An assigned user** (`item_assigned_users`) — the execution axis.
4. **A current holder of a responsible role** — the responsibility axis, *derived*
   through the time-bounded window (see [Doc 9](09-responsibility-model.md)).

**Collaborators deliberately get no write.** They participate; they do not control.

### Delete — nobody
No DELETE policy exists on `items`, `roles`, or `role_assignments`. RLS is
deny-by-default, so DELETE is denied to everyone, including admins.

History-bearing rows are **retired, never removed**:

| Table | Retire via |
| --- | --- |
| `items` | `deleted_at` |
| `roles` | `is_active = false` |
| `role_assignments` | `valid_to` |

*Why* (TD-001): hard-deleting an item cascades its responsibility/assignment/tag/
meeting rows and sets `activity_events.item_id` to NULL — the audit trail survives
but loses its subject, becoming **unattributable**. Deleting a role cascades
`role_assignments` **and** `item_responsible_roles`, erasing the very record the
model derives from.

## 4. Closing the bypasses

A permission model is only as strong as its weakest write path. Three were closed:

1. **Child tables are gated on `can_write_item`.** Otherwise the model is trivially
   bypassable: any member could `INSERT` themselves into `item_assigned_users` and
   thereby grant themselves write on any item in the org. Gated:
   `item_responsible_roles`, `item_assigned_users`, `item_collaborators`,
   `item_tags`, `meeting_details`.
   *(DELETE remains granted on these — unassign/untag is the designed operation and
   is itself logged to `activity_events`. They are current state, not history.)*

2. **`created_by` is immutable** (trigger). It grants write, so without this a
   temporary assignee could set themselves as creator and keep access **permanently**
   after being unassigned.

3. **`created_by` must equal `auth.uid()` on INSERT.** It grants write, so it must
   not be forgeable.

## 5. `activity_events` — append-only (TD-002)

Clients were already blocked (select-only; the client INSERT policy was removed in
`0003`). The remaining hole: RLS is bypassed by roles holding `BYPASSRLS` — notably
`service_role` — so a compromised service key could rewrite history.

**Fix: a `BEFORE UPDATE OR DELETE` trigger.** Triggers run for *every* writer,
including `BYPASSRLS` roles and the table owner.

**Verified against the real service role** (2026-07-15), using an `sb_secret_` key
and a positive control that proves the key genuinely bypasses RLS — so the denials
below are the trigger working, not RLS quietly filtering:

```
✅ service role bypasses RLS and can read activity_events (control)
✅ service role CANNOT update activity_events (trigger beats BYPASSRLS)
✅ service role CANNOT delete activity_events (trigger beats BYPASSRLS)
✅ the audit row actually survived both attempts
```

*(Supabase's new-style `sb_secret_` keys replace the old `service_role` JWT and
needed no code change — they are sent as the same `apikey`/bearer.)*

**`FORCE ROW LEVEL SECURITY` was deliberately not used**, despite being the
originally suggested fix. Two reasons:
- It does **not** constrain `BYPASSRLS` roles — so it would not have closed this hole.
- With no INSERT policy present, it would instead risk **blocking the SECURITY
  DEFINER audit triggers** that legitimately append rows — i.e. breaking audit logging.

Org deletion must still cascade. When an organization is removed, Postgres deletes
its `activity_events`; the parent row is already gone at that point, which is how
the trigger distinguishes a legitimate cascade from erasing history under a live org.
This allowance is verified directly (an organization with no members deletes cleanly).
End-to-end org deletion is nevertheless still blocked further down the stack — see
**TD-007** below.

## 6. Verification

`node scripts/m5-permission-test.mjs` — **22 passing, 3 known failures (TD-007)**.
The run is deliberately **not** reported as green.

It leans on **positive controls**: the same code path returns "allowed" for a
legitimate principal, so a denial cannot be a silent error masquerading as a pass.
This is load-bearing — it caught a wrong key being supplied, under which every
service-role check would have "passed" for entirely the wrong reason (RLS silently
blocking → 0 rows, no error). A security test that passes because the credential is
too weak is worse than no test.

Covered: baseline denial · self-assignment escalation · role-attachment escalation ·
`created_by` laundering · assign→write→unassign→deny · **derived role access** ·
**time-bounded revocation** · hard-delete denial (items/roles/role_assignments) ·
soft-delete success · audit still logging · client cannot mutate `activity_events` ·
**service role cannot mutate `activity_events`**.

Regression: `m1-isolation-test.mjs` (14 checks) still passes.

## 7. Known gaps

| Gap | Status |
| --- | --- |
| **Organization deletion is incomplete** — `0006` fixed the last-owner block; the audit triggers and the `item_id SET NULL` cascade still block teardown. No security impact (a destructive op is refused); blocks offboarding/erasure. | **Open — TD-007**, 3 known-failure checks |
| Fine-grained item **read** visibility | Deferred by design |
| `delegations` (PDL-017) | Not built (TD-004) |
| Point-in-time responsibility read model | Not built |
| Role hierarchy, teams | Future |

## 8. A note on how this was found

`0005`'s guard has to allow an FK cascade while blocking everything else. Testing
that allowance end-to-end surfaced **two unrelated pre-existing bugs** in the org
teardown path (`0003`'s owner protection, and `0002`'s audit triggers) — neither
caused by this milestone, neither previously known. The first is fixed (`0006`);
the rest is TD-007. Worth remembering: the cascade allowance was the one branch
that looked "obviously fine" and was the only one hiding real defects.

## 9. Related

- The model this enforces: [Document 9 — Responsibility Model](09-responsibility-model.md)
- Decisions: PDL-013, PDL-017, PDL-018, PDL-021, PDL-022 · TDL-002, TDL-004, TDL-009, TDL-011, TDL-012, TDL-017
- Debt closed: TD-001, TD-002 · Debt opened: TD-007 ([register](TECHNICAL_DEBT.md))
- Migrations: `0005_permission_hardening.sql`, `0006_fix_org_delete_cascade.sql`
