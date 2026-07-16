# M5 — People & Roles + Responsibility · Milestone Spec

> 🟢 **FINALIZED 2026-07-16 with Palash's rulings — awaiting final sign-off to
> begin. No implementation code written yet.**
> Grounded in the **frozen** Product Design Package (2026-07-11).
> Scope ruled by Palash 2026-07-16 (**PDL-031**); `PROJECT_PLAN.md:185` corrected.
>
> **Rulings applied (2026-07-16):**
> - **Member invites are IN scope** — the feature is pointless without a way to add
>   a second person (§4.0). This is a substantial addition; see the proposed gate
>   split below.
> - **Item-assignee role permission stays as-is** (§5-B) — attaching an existing
>   role follows item-write permission, matching `0005`. Approved, no change.
> - **"Current Owner" wording fixed** to Doc 9 vocabulary in `03-user-journey.md`.
>
> **Proposed gate split** — invites roughly double the milestone and touch auth:
>
> | Gate | Scope | Rationale |
> | --- | --- | --- |
> | **A** | Member **invites** (token/link; email delivery deferred per PDL-011) + Members list | Without this, everything below is invisible to every (solo) user. Ships the ability to form a team. |
> | **B** | **Roles** + time-bounded **role-assignments** management surface; **By Role** grouping | The differentiator's management surface — usable only once a team exists. |
> | **C** | **Responsibility on the item card** (Responsible Roles / Assigned Users / Collaborators; "UNFILLED — needs owner"); live triage **Role chip** | Puts responsibility where work happens. |
>
> Gates are a proposal for your approval, mirroring M3.

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

### 4.0 Member invites (Gate A) — ruled in scope

**Why the schema forces real work here.** Today there is *no* client path to add
anyone to an org, even an existing user:
- `organization_members` has `invited_by` / `invited_at` columns but **no pending
  state and no email** — a row needs a real `user_id` referencing an existing
  `profiles` row.
- `profiles` has **no email column** (email lives in `auth.users`), and
  `profiles_select` only exposes yourself or people **already** sharing your org.
  So you cannot look up a stranger by email or id from the client — a chicken-and-egg
  wall: you can't find someone until they're already a member.
- There is **no `invitations` table**.

**Proposed design (token/link invite; email delivery is deferred, PDL-011):**
- **New migration** — an `invitations` table: `organization_id`, `email`, `role`,
  `token` (unguessable), `status` (pending/accepted/revoked), `invited_by`,
  `expires_at`. RLS: admins of the org manage its invites; the accept path reads a
  row **by token only**. Composite FK + `organization_id` per the `0003` pattern.
- **Edge Function** (service role, per TDL-011) for the two privileged steps the
  client cannot do under RLS:
  - *create invite* — admin-only; stores the invite; returns a shareable link.
  - *accept invite* — run for a signed-in user whose email matches the invite:
    inserts the membership (service role, since `members_insert` requires admin and
    the invitee is not one), marks the invite accepted. The existing team-flip
    trigger then flips the org to team mode automatically.
- **UI**: an admin enters an email + role, gets a **copyable invite link** (no
  email is sent — that's Future). A signed-in invitee visiting the link joins.
- **Progressive disclosure**: the moment a second member joins, the team-flip
  trigger sets `team_enabled` — People & Roles appears for that org (PDL-022),
  with no extra client logic.

**Deliberately deferred:** emailed invites (PDL-011 defers delivery channels);
inviting by anything other than email; SSO/domain capture. Link-based is enough to
form a team and unblock the differentiator.

### 4.1 People & Roles surface (rail, admin) — Gate B
- **Roles**: list · create · rename · **retire** (`is_active = false`, never delete).
- **Members**: list org members with their platform permission.
- **Role assignments**: assign a person to a role; **close** an assignment
  (`valid_to = now()`), never delete. Show *current* holders derived through the
  window, plus past holders as history.
- Concurrent holders are allowed by design (no overlap constraint) — show them all.
- Hidden entirely for solo users (PDL-022). Admin-only writes; members see read-only.

### 4.2 Responsibility on the item card — Gate C
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

## 5. Decisions — resolved (2026-07-16)

| # | Question | Resolution |
| --- | --- | --- |
| **A** | Is People & Roles admin-only, or member-readable? | **Card shows responsibility to all** members (roles are readable via `p_roles_read`); the **management surface is admin-only**. My recommendation, adopted. |
| **B** | Can a non-admin set an item's Responsible Role / Assigned User? | **Kept as built — Palash-approved.** Attaching an existing role or assigning a user follows **item-write** permission (`0005`): creator / assignee / current-role-holder / admin. Creating *roles* stays admin-only. |
| **C** | Member invites in M5? | **Yes — Palash-ruled.** Implemented as Gate A (§4.0). Link/token based; email delivery deferred (PDL-011). |

## 6. Conflicts / gaps flagged

### 6.1 `in_progress` still absent from the product docs
Noted in the M3 spec; unchanged. Not this milestone's problem, but still true.

### 6.2 ✅ RESOLVED — roles were unreachable without member invites
Every account today is solo and there was no way to invite anyone, so a
People & Roles surface would have shipped invisible. **Ruled in scope** — invites
are Gate A (§4.0).

### 6.3 ✅ RESOLVED — "Current Owner" was pre-PDL-020 vocabulary
`03:149-151` said "Responsible Role and **Current Owner**". PDL-020 split this into
Responsible Roles + Assigned Users, the current person **derived** through the
role. **Fixed 2026-07-16** in `03-user-journey.md` — annotated inline, not silently
rewritten.

### 6.4 Email delivery of invites is deferred (PDL-011)
Invites are **link/token** based — an admin copies a link; no email is sent.
Flagged so "invite" is not read as "email invite".

### 6.5 Temporary delegation is deferred
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
