# M7 — Trust & Lifecycle (spec, for review)

**Status:** Draft for Palash's approval. **No code written.**
**Date:** 2026-07-17 · Scope = the **Tier 1 blockers** from [the MVP gap analysis](MVP-gap-analysis.md), ruled by Palash (D2: Tier 1 only; Tier 2/3 deferred).
**Numbering note:** this proposes taking the **M7** slot. The roadmap's old "M7 — Files & notifications" is Future/Good-to-Have scope (already annotated in `PROJECT_PLAN.md`, PDL-038) and is **not** what this builds. I'll record the renumbering as a PDL **on approval** — not before.

---

## 1. What this milestone is

The four things that stand between "a working demo" and "a product real people and real companies can be trusted with." Nothing here is a new feature — it's the account, team, tenant, and defer lifecycles that a real MVP has to close.

| # | Blocker | Ruling |
| --- | --- | --- |
| 1 | **No password reset** — a locked-out user has no recovery | Build it; stand up minimal email (D1) |
| 2 | **No member offboarding** — can't remove/deactivate/demote a member | Build the UI (RLS already allows it) |
| 3 | **Org deletion fails (TD-007)** — no tenant deletion / GDPR erasure | Apply the drafted fix |
| 4 | **Snooze never wakes (TD-011)** — a deferred item is lost forever | Build the wake mechanism |

Plus one **tag-along**: **remove Meeting as a user-facing type** (PDL-039, D3).
And one **parallel track, not blocking**: **the Anthropic accuracy batch** (D4) — see §8.

---

## 2. Gates

Two gates, same rhythm as M6. Gate A is the email-dependent lifecycle work; Gate B is the two self-contained data-layer fixes.

- **Gate A — Accounts & team:** minimal email delivery · password reset · member offboarding · the Meeting-type removal tag-along.
- **Gate B — Tenant & defer:** org deletion (TD-007) · snooze wake (TD-011).

*(A-before-B because email is the biggest unblock and the riskiest external dependency; get it landed first. B is DB-migration work that doesn't touch email.)*

---

## 3. Gate A1 — Minimal email delivery (D1)

**The key thing to understand:** most of "email delivery" is **Supabase project configuration, not app code.** Once one transactional email provider is connected to the Supabase project via SMTP, three things light up at once:
- **Password-reset emails** — sent by Supabase Auth itself.
- **Signup-confirmation emails** — same (if we choose to require confirmation).
- **Invite emails** — the existing `invitations` Edge Function can send the link it already mints.

### What I recommend
- **Provider: Resend** (simple, generous free tier, first-class Supabase SMTP support). Alternatives — Postmark, SendGrid — work identically; this is a small decision (see D-a).
- **Wire it as Supabase custom SMTP** (project setting / `config.toml`), so Supabase Auth's own emails work without app code.
- **A verified sender domain** is needed for deliverability (so reset emails don't land in spam). This is a DNS step on whatever domain we send from — a config task, flagged here because it needs a real domain (D-b).

### What is code vs. config
- **Config (Palash + me, dashboard/DNS):** create the email-provider account, add SMTP secrets to Supabase, verify a sender domain, turn on Auth emails.
- **Code:** the invitations Edge Function gains an "email the link" step (behind the same SMTP); the password-reset UI in A2. That's it — Auth reset/confirm emails need **no** app code.

### Ready-to-use steps for Palash (drafted; I'll give the exact click-path at build time)
1. Create a Resend account, add and verify the sending domain (DNS records).
2. Generate SMTP credentials; I'll add them to the Supabase project as secrets.
3. Confirm the "from" address (e.g. `no-reply@<yourdomain>`).
I'll handle everything downstream of that.

---

## 4. Gate A2 — Password reset

Standard Supabase recovery flow. Small code lift on top of A1's email.

- **"Forgot password?"** link on the sign-in screen → calls `resetPasswordForEmail(email, { redirectTo: <reset-page> })`.
- **A reset page/route** (`/reset-password`): Supabase puts the user in a short-lived recovery session via the emailed link; the page collects a new password and calls `updateUser({ password })`, then routes to the app.
- **Deliberately generic UX:** "If that email exists, we've sent a reset link" — never reveal whether an address is registered (account-enumeration hygiene).
- **Reuses the existing password validation** (`src/modules/auth/validation.ts`), so reset and signup enforce the same rules.
- **Out of scope (stays deferred):** email *verification* on signup and self-serve account deletion — not Tier 1. (Account deletion partly overlaps TD-007; noted, not built.)

---

## 5. Gate A3 — Member offboarding

**No new RLS or migration** — `organization_members` already has admin-gated `update`/`delete` policies and a `protect_owner_membership` trigger that refuses removing/demoting/deactivating the **last active owner** (verified in `0001`/`0003`). This is the same shape as org rename: mirror in the UI what the database already enforces.

- **New repository functions** (`people-repository`): `removeMember` (delete), `setMemberActive` (deactivate/reactivate via `is_active`), `changeMemberRole` (owner/admin/member). All admin-only; all convert a silent RLS 0-row into a `PermissionError`, same discipline as the rest of the codebase.
- **UI in `PeopleScreen`** (currently a read-only list): per-member admin controls — change role, deactivate, remove. Hidden entirely for non-admins (never offer what RLS refuses, Doc 8).
- **Handle the last-owner guard gracefully:** the trigger raises `cannot remove the last owner` / `only an owner can assign the owner role` — surface these as clear messages, not raw errors. You can't strand an org with no owner, by design.
- **Deactivate vs. remove:** deactivate (`is_active = false`) revokes access but keeps the row and its history/attribution intact; remove deletes the membership. Deactivate is the safer default for offboarding; both offered.
- **What this is NOT:** it does **not** reassign the departing person's responsibilities — that's the existing role-handover in `RoleCard` (M5). The two compose: hand over their roles, then deactivate them.

---

## 6. Gate B1 — Organization deletion (TD-007)

Apply the fix **already drafted and reviewed** in the debt register — a migration that lets a tenant teardown complete, without weakening the append-only audit guarantee for live orgs.

- **The problem (recap):** deleting an org fails because (layer 2) the `AFTER DELETE` audit triggers on `item_responsible_roles` / `item_assigned_users` try to log `*_removed` events referencing the org that's already being deleted → FK violation; and (layer 3) the `activity_events.item_id` `ON DELETE SET NULL` is an UPDATE, which the append-only guard refuses.
- **The fix (from the register):** inside the same transaction the parent org row is already gone, which cleanly distinguishes *teardown* from *normal operation*:
  - in `log_responsible_role_change()` / `log_assigned_user_change()`: on `DELETE`, **skip logging if the organization no longer exists** (those audit rows are cascading away in the same statement — the event has no reader);
  - in `forbid_activity_event_mutation()`: **allow the mutation when the organization no longer exists**, permitting the teardown `SET NULL`.
- **Non-negotiable invariant:** **live-org behaviour is unchanged** — `activity_events` stays append-only, and the service role still cannot hard-delete an item or rewrite the audit log. The test proves both: teardown succeeds **and** a positive control shows a live-org audit mutation is still refused.
- **Verification:** `m5-permission-test.mjs` currently carries **3 known-failure** org-teardown checks — this migration turns those green (25/25) **without** regressing the 22 that pass or the `m1-isolation-test` 14/14.
- **UI scope:** a minimal admin "delete organization" action is **in** scope (with a real confirmation — type-to-confirm), because "the data can be deleted" must be reachable, not just possible in SQL. Guard it hard: admins/owners only, irreversible, clearly worded.

---

## 7. Gate B2 — Snooze wake (TD-011)

Make snooze actually defer-*and-return*, instead of hiding an item forever.

- **The problem (recap):** `snoozeItem` sets `state='snoozed'` + `snoozed_until`, but **nothing reads `snoozed_until` back** and no view shows `snoozed` items — so a snoozed item vanishes from every view and never returns. Same class as the reminder bug `0017` fixed.
- **The fix — a wake step (recommended):** a `wake_due_snoozes()` database function (SECURITY DEFINER, scoped to the caller's org memberships) that flips rows with `snoozed_until <= now()` back to `state='committed'`, `snoozed_until = null`. Called **opportunistically** on app load and on Daily Review open — the same "surface what's due now" moment the rollover stage already owns. Deterministic, live-testable, and timezone-safe (it compares absolute instants; TD-005 discipline).
  - *Why an RPC and not a view predicate:* the Today/Upcoming filters are state-based (`committed`/`in_progress`); showing a still-`snoozed` item there would misrepresent its status. Waking it back to `committed` keeps the state model honest — the item genuinely *is* active again.
  - *Why not a cron:* hosted Supabase scheduling isn't wired, and an on-load sweep needs no new infra. If a scheduler is added later, the same function is what it would call.
- **Close the second hole (the inert status route):** selecting "Snoozed" from the plain status dropdown currently sets `state='snoozed'` with **no** wake date, guaranteeing a permanent vanish. Fix: either drop `snoozed` from the raw status dropdown (snooze becomes an *action* with a date, as in triage) **or** require a date when it's chosen. **Recommended:** remove it from the dropdown — snooze is a defer-*until* action, not a status you set by hand. (See D-c.)
- **Optional, cheap, recommended:** a **"Snoozed" system view** so a user can see and un-snooze deferred items before they auto-wake. Small; include if it stays cheap.
- **Verification:** a live test (mirroring `m10-reminder-test`) — snooze an item to a past instant, run the wake, assert it returns to an active view; snooze to a future instant, assert it stays hidden. Run in a non-UTC zone (IST) so a timezone regression fails loudly.

---

## 8. Parallel track (D4) — Anthropic accuracy batch (NOT blocking)

Separate from the code above; runs alongside, gated only on funding.
- Once Anthropic is funded: set `AI_PROVIDER=anthropic`, `npm run deploy:function` (the JWT guard runs automatically), then `node scripts/m3-classify-test.mjs` for a real Claude accuracy read on the same battery M4 used for Gemini.
- **Fix TD-012 as part of this** (a few lines): `ai_captures.provider` is hardcoded `'anthropic'` — thread the *actual* provider through so the provenance is right before any accuracy comparison relies on it.
- Deliverable: an accuracy report comparing Claude vs. the Gemini `flash-lite` baseline (97% on 30). This informs the production-provider choice; it does not block M7.

---

## 9. What this milestone will NOT do (Tier 2/3, deferred per D2)

CI · global error boundary + read-error states · production observability · tag soft-delete (TD-010) · field-edit auditing (TD-009) · container rename/archive UI · magic-link auth · typed Supabase client (TD-003). All remain logged; none block a first real-user launch as much as the four blockers here. Revisit after M7.

---

## 10. Decisions I need from you

| # | Decision | My recommendation |
| --- | --- | --- |
| **D-a** | **Email provider.** | **Resend** — simplest Supabase SMTP setup, generous free tier. Postmark/SendGrid are fine substitutes. |
| **D-b** | **Sending domain.** Reset emails need a verified sender domain for deliverability (DNS records). Which domain do we send from? | Use your product domain (e.g. `no-reply@alp-viram.<tld>`). If there's no domain yet, that's a small prerequisite I'll flag — Auth's built-in sender works for testing but not for real deliverability. |
| **D-c** | **The raw "Snoozed" status option.** Remove it from the status dropdown (snooze becomes a defer-*until* action only), or keep it but force a date? | **Remove it** — a status you can set to "snoozed" with no wake date is exactly the trap that loses work. |
| **D-d** | **Signup email confirmation.** Once email works, do we require users to confirm their address on signup? | **Not for MVP** — keep signup frictionless; add confirmation later. (Password reset doesn't need it.) |

---

## 11. Size estimate

- **Gate A ≈ 1.5–2 gates** — the email setup has a real external-config dependency (provider + DNS) that's more coordination than code; password reset and offboarding are each modest and self-contained; Meeting-removal is tiny.
- **Gate B ≈ 1 gate** — two contained DB fixes (one migration each, both already designed), each with a live test.

Gate A carries the external dependency and the biggest user-facing unblock (recovery + real invites). Gate B closes two silent data-loss holes (a customer's data that can't be deleted; a user's work that never comes back).

---

## 12. Verification plan

Held to the standard that's actually caught bugs here (live red-team + browser walkthroughs; unit tests mock the DB):
- **Password reset:** browser walkthrough — request reset → (email path) → set new password → sign in with it. Generic "if it exists" copy asserted.
- **Offboarding:** live red-team — an admin can remove/deactivate/demote; a non-admin cannot; the **last owner cannot be removed** (positive + negative). Browser walkthrough for the UI.
- **Org deletion:** `m5-permission-test.mjs` → **25/25** (the 3 known failures go green) with the live-org append-only positive control still refusing; `m1-isolation-test` still 14/14.
- **Snooze wake:** live test in IST — due snooze returns, future snooze stays hidden.
- **Meeting removal:** capture/triage no longer offer Meeting; the classifier never emits it; existing `meeting`-typed rows still render.
- Full sweep before sign-off: typecheck · lint · unit · `m3` · `m7`(table) · `m9` · `m10` · the new tests. Walkthroughs re-run when a surface changes.

> ⚠️ Script prefixes are **not** plan milestones. New scripts here use `m11-*` to avoid deepening the numbering confusion (the `m6/m7/m8/m9/m10` scripts are named after *work*, not roadmap Mn).
