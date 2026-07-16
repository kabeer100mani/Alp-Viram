# M5 — People & Roles + Responsibility · Milestone Spec (DRAFT)

> 🟡 **DRAFT — awaiting Palash's approval. No code until sign-off.**
> Date: 2026-07-16 · Grounded in the **frozen** Product Design Package (2026-07-11).
> Scope ruled by Palash 2026-07-16 (**PDL-031**); `PROJECT_PLAN.md:185` corrected.
>
> Where the frozen package specifies something, this spec follows it. Where it is
> silent or self-contradictory, it **asks** — see §5 and §6.

---

## 1. Objective

Make the differentiator reachable. Roles, time-bounded role-assignments, and
responsibility on items are all **Must-Have** (Doc 4) and all fully **enforced**
already — by migration `0005` and the TDL-012 derivation — yet none of it can be
reached without writing SQL.

## 2. Why this, and not M5 as written

M5's roadmap line ("ask your workspace", smart suggestions) is listed word for
word in the frozen package's **Future** scope, deferred *"until the capture/triage
foundation is trusted"* — a condition not yet met. Meanwhile Doc 4 calls
Roles+Role-Assignments *"the heart of the responsibility differentiator"* and
Responsibility fields *"the differentiator, on every item"*, and both have no UI.
See **PDL-031**.

---

## 3. What the frozen package already decides (not open for redesign)

**Two orthogonal axes** (PDL-020, Doc 9): Responsibility = **Role**;
Execution = **Assigned User**. Collaborators are optional and get no write.

**The indirection** (PDL-015): an item never stores a person for responsibility —
it stores a Role. "Who is responsible now" is **derived** through the time-bounded
`role_assignments` window. Handover = close one assignment, open another; **zero
item rows change**.

**Never force a role** (PDL-021): **0 responsible roles is valid**; capture never
demands one. The feature catalogue was corrected to match on 2026-07-16.

**Unfilled roles** (`03:145-149`): render **"UNFILLED — needs owner"**, *never* a
stale name.

**Platform permission ≠ business role** (TDL-017): `organization_members.role`
(owner/admin/member) governs administration; `roles` govern work. Orthogonal.

**Progressive disclosure** (PDL-022): a solo user sees **no** Organization, Roles
or team concepts. Same data model, two UX modes.

**Rail** (`05:143-147`): **People & Roles** is an admin surface in the rail —
already stubbed and hidden for solo users.

**History never rewrites** (PDL-020, PDL-018): completed items freeze
responsibility; role changes never rewrite the past.

**Retire, never delete** (TDL-009, `0005`): `roles.is_active = false`;
`role_assignments.valid_to`. **DELETE is denied by RLS** — the UI must not offer it.

**Admin-only writes** (`0005`): only an org admin/owner may create roles or make
role-assignments. Members read only.

---

## 4. Proposed scope

### 4.1 People & Roles surface (rail, admin)
- **Roles**: list · create · rename · **retire** (`is_active = false`, never delete).
- **Members**: list org members with their platform permission.
- **Role assignments**: assign a person to a role; **close** an assignment
  (`valid_to = now()`), never delete. Show *current* holders derived through the
  window, plus past holders as history.
- Concurrent holders are allowed by design (no overlap constraint) — show them all.
- Hidden entirely for solo users (PDL-022). Admin-only writes; members see read-only.

### 4.2 Responsibility on the item card
- Show **Responsible Roles** (0..N, ≤1 primary) and **Assigned Users** (0..N, ≤1
  primary) and **Collaborators**.
- An unfilled role renders **"UNFILLED — needs owner"**.
- Add/remove responsibility + assignment, gated on `can_write_item` — the UI must
  never offer an action RLS will refuse (as in M3).
- Show *who is responsible now*, derived — never a stored person.

### 4.3 Triage chip
The Role chip in the Daily Review is currently **read-only** ("set in People &
Roles") because responsibility is a join row. With this surface built, it becomes
live — completing the specified `Type ▸ Project ▸ Role ▸ Due` chip row.

### 4.4 By Role view
The seeded **By Role** system view exists with `{"groupBy":"role"}` but the view
engine does not implement grouping yet — it currently renders ungrouped. This
milestone makes it real.

---

## 5. Decisions needed from Palash

| # | Question | My recommendation |
| --- | --- | --- |
| **A** | **Does a member need to see People & Roles read-only, or is it admin-only entirely?** Doc 5 marks it "(admin)". But roles are readable by all members (`p_roles_read`), and an item card must show *who is responsible* to everyone. | Card shows responsibility to all; the **management surface** is admin-only. |
| **B** | **Can a non-admin set an item's Responsible Role?** `0005` allows it if they can write the item (creator/assignee/role-holder) — creating roles is admin-only, but *attaching* an existing one is not. | Keep as built: attaching an existing role follows item-write permission. Flagging because it is a real permission boundary you may want tighter. |
| **C** | **Assigned Users — who may assign?** Same as B: anyone who can write the item. | Keep as built. |
| **D** | **Does M5 include inviting members?** Doc 4 Must-Have says Organization is *"auto-created, renamable, **invite members**"* — but invites are unbuilt, and without them a solo user can never get a second member, so **roles can never be exercised in practice**. | ⚠️ **This may be the real blocker.** See §6.2. |

## 6. Conflicts / gaps flagged

### 6.1 `in_progress` still absent from the product docs
Noted in the M3 spec; unchanged. Not this milestone's problem, but still true.

### 6.2 ⚠️ Roles are unreachable without member invites
PDL-022 hides all role concepts from solo users, and every account today is solo
because **there is no way to invite anyone** (`04:15` lists "invite members" as
Must-Have; `0001`'s notes mention an invite path but no UI exists). So a
freshly-built People & Roles surface would be **invisible to every current user**.

Either M5 includes **member invites**, or the milestone ships something nobody can
see. This is a scope question, not a design one — **flagged for ruling**.

### 6.3 "Current Owner" vocabulary is pre-PDL-020
`03:145-149` says an item shows "Responsible Role (durable) and **Current Owner**
(who's doing it now)". PDL-020 later split this into Responsible Roles + Assigned
Users. → Recommend Doc 9's vocabulary; Doc 3's wording is stale (same class as the
feature-catalogue fix on 2026-07-16).

### 6.4 Temporary delegation is deferred
PDL-017 designs delegation (grants the right to *act*, never ownership, does not
cascade). `delegations` is unbuilt (**TD-004**) and Doc 6 defers the UI. → Out of scope.

---

## 7. Out of scope
Delegation UI (TD-004) · role hierarchy / inheritance (Future) · teams / sub-groups
(Future) · fine-grained item visibility (Future) · point-in-time "who was
responsible on date X" read model (events are written; the read model is not).

## 8. Definition of done
1. Features work as described. 2. `lint`, `test`, `build` pass. 3. Testing
procedure run **and observed in a browser**. 4. Committed to `Development`.
5. New decisions recorded.

Plus: the UI never offers an action the permission model will refuse — verified
against a non-privileged member, as in M3. And a role handover must be provable:
close an assignment, and responsibility moves with **zero item rows changed**.
