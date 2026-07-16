# M5 Milestone Report — People & Roles + Responsibility

**Status:** ✅ **COMPLETE — signed off by Palash 2026-07-16.**
**Date:** 2026-07-16 · Grounded in the frozen Product Design Package + Docs 8/9.
**Sign-off note:** accepted with its known gaps open and explicitly **not** silently
carried as done — org rename and the multi-org switcher were both *Doc 4 Must Haves*
left unbuilt here, and they are now in scope as **M6 Gate A**. No member-removal /
role-change UI; the point-in-time responsibility read model and delegations (TD-004)
stay deferred.
Scope ruled by Palash (PDL-031); built to [the M5 spec](M5-people-roles-spec.md).

---

## Headline

The responsibility differentiator is now **reachable**. Migration `0005` and the
TDL-012 derivation had *enforced* responsibility since the Permission Model
milestone, but it could only be exercised by writing SQL. M5 gives it a UI: invite
a team, define roles, assign people with time-bounded assignments, and set
responsibility on items — with "who is responsible now" derived, never stored.

## Gates

| Gate | Delivered | Commit |
| --- | --- | --- |
| **A** | Member invites (link/token) · Members list · `/invite` accept · active-org primitive | `dd07de1` |
| **B** | Roles (create/rename/retire) · time-bounded assignments · By Role grouping | `2f4fa40` |
| **C** | Responsibility on the item card · live triage Role chip · solo-invite hatch · role rename | `0410aa0` |

## What the frozen package required, and how it's met
- **Two axes (Doc 9):** responsibility = Role, execution = Assigned User. ✅ both on the card.
- **The indirection (PDL-015):** who's responsible now is derived; a handover changes no item rows. ✅ proven live (below).
- **0 responsible roles is valid (PDL-021).** ✅ items need no role; "No responsible role" is a valid state.
- **UNFILLED — needs owner (`03:149`).** ✅ shown, never a stale name.
- **Platform permission ≠ business role (TDL-017).** ✅ role writes are admin-only and independent of responsibility.
- **Progressive disclosure (PDL-022).** ✅ solo users see none of it — except the one invite action they need.
- **Retire, never delete (TDL-009).** ✅ roles/assignments retire; DELETE denied by RLS and absent from the UI.

## Verification (all against the live database)
- **`m5-invite-test.mjs`** — 12/12: non-admin can't invite; token secret; leaked-link safe; single-use; no owner escalation; team-flip.
- **`m5-roles-test.mjs`** — 12/12: role/assignment writes admin-only; no hard-delete; **after a handover the derived responsible person changed (M→A) while the item row's `updated_at` was untouched.**
- **`m5-responsibility-test.mjs`** — 7/7: setting responsibility follows `can_write_item`; **assigning a member to the responsible role makes them the item's derived responsible person *and* grants them write on it** — the whole model closing the loop.
- **`m5-invite-walkthrough.mjs`** — 20/20 in a real browser (two users): invite → sign-up → accept → team mode; roles create/rename/assign; member sees roles read-only; an item starts "Unassigned" in By Role then groups under its role once set.
- **57 unit tests** · typecheck · lint · build.

## Decisions & scope notes
- **M5 replaced the roadmap's "assistant depth"** (PDL-031) — that was Future scope; this is the Must-Have differentiator.
- **Invites are link/token, not emailed** (PDL-011 defers delivery).
- **Active-org primitive** added mid-Gate-A: a user can belong to several orgs, so a stored choice decides the active one (seed of the PDL-009 switcher). Without it, an invitee landed in their own personal org.
- **Item-assignee role permission** kept as `0005` behaves (Palash-approved): attaching an existing role follows item-write permission; creating roles is admin-only.

## Known gaps (honest)
- **Org rename** is unbuilt, so a team sees the admin's personal-org name ("My Workspace"). Must-Have, not in M5's scope — flag for next.
- **No member removal / role-change UI** (only invite + assign). Add when needed.
- **Point-in-time "who was responsible on date X"** — events are written; the read model is not built (deferred).
- **Delegations (PDL-017 / TD-004)** — not built.
- **By Role card glance** can briefly read "No responsible role" on first paint before its per-item query resolves (the grouping query already has the answer). Cosmetic.

## Reproduce
```
npm run dev
node scripts/m5-invite-test.mjs         # invite security (live)
node scripts/m5-roles-test.mjs          # roles + handover (live)
node scripts/m5-responsibility-test.mjs # responsibility follows can_write_item (live)
node scripts/m5-invite-walkthrough.mjs  # full two-user browser flow (needs dev server)
node scripts/m5-demo-invites.mjs        # generate demo invite links to try by hand
```
