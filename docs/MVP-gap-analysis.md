# Alp-Viram — What's Left Before This Is a Real MVP

**Status:** Analysis for Palash. **No code proposed yet** — this is the "what's actually left" read you asked for after signing off M6, before we decide what's next.
**Date:** 2026-07-17 · Grounded in the frozen Product Design Package (locked 2026-07-11) and a file-by-file audit of what's actually on disk.
**Method:** every verdict below was checked against real code, not the CLAUDE.md summary (which has been wrong before). Two areas — the feature Must-Haves and the quality/operability dimensions — were audited in depth; the load-bearing findings were re-verified by hand.

---

## The headline

**The feature checklist is essentially done.** Every Doc 4 *Must Have* is built and wired into the UI — capture, triage, responsibility, tags, saved views, search, reminders, the hierarchy, execution. On features, this *is* an MVP.

**What's left is not features — it's the stuff that turns "a working demo" into "a product real people and real companies can be trusted with":** account recovery, removing a departing employee, deleting a customer's data, and knowing when something breaks. Plus a handful of things that are built but thinner than they look.

One thing worth saying plainly: the engineering discipline here is **above typical MVP grade** — a real audit log verified against the database's most privileged key, live security red-team scripts, a deploy guard built after a past mistake. The gaps below are breadth-of-lifecycle gaps, not rot. That matters for the go/no-go: the foundation is sound; what's missing is the edges.

---

## Tier 1 — True blockers before real users touch it

These four are the "we cannot ship to real customers until these exist" items.

### 1. No password reset — users get permanently locked out
Auth is exactly three flows: sign up, sign in, sign out ([auth module](src/modules/auth)). There is **no "forgot password"** anywhere. A real user who forgets their password today is locked out for good, with no self-serve recovery. This is table-stakes for any product with real accounts.
**Catch:** a proper reset emails a link, and we deliberately deferred email delivery (PDL-011). So this is entangled — it needs a minimal transactional-email path, which we've been avoiding. That trade-off needs a decision (see Decisions, D1).

### 2. No way to remove or offboard a team member
The People screen lists members **read-only** ([PeopleScreen.tsx](src/modules/people/components/PeopleScreen.tsx)). You can invite people and manage *responsibility roles* (who holds "Finance"), but you **cannot remove a person from the org, deactivate them, or change their admin/member permission.** For a multi-user product, "an employee left and we can't revoke their access" is a security and trust hole.
*(Precision: this is distinct from the role handover that M5 built — that reassigns a business role; this is about org membership and access.)*

### 3. A customer's account/data cannot be deleted — GDPR/offboarding (TD-007)
Organization deletion still fails partway through teardown (documented as TD-007). No security exposure — a destructive operation is *refused* — but the moment a real company signs up, "we cannot delete your account or erase your data on request" is a legal and trust blocker. The fix is already drafted in the debt register; it just hasn't been applied.

### 4. A snoozed item never comes back — the defer loop is half-built (TD-011, **found in this audit**)
Snooze *looks* done — Daily Review sets a wake date. But **nothing ever reads that wake date.** A snoozed item drops out of every view and **never resurfaces**, even after "tomorrow" arrives; it's findable only by Search. This is the exact same bug class as the reminder hole we just fixed in M6 (a field written but never read). It quietly loses a user's deferred work — the opposite of what a work-management tool promises.
*(Newly logged as TD-011; not in the register before today.)*

---

## Tier 2 — Serious, fix-soon (not strictly blocking, but risky to skip)

### 5. Tag delete is one irreversible, un-undoable click (TD-010)
Already logged, already flagged to you. Deleting a tag strips it from every item in the org with no undo, and the admin-only limit is UI-only — the database still lets any member delete via the API. One accidental click = permanent, org-wide data loss.

### 6. No automated safety net (no CI)
There is **no continuous integration** — nothing runs the tests, linter, or the security red-team scripts automatically. Every check is manual, and some have silently gone stale before (the M3 walkthrough tested a deleted button for two milestones). For a multi-tenant app where a permissions regression means one customer seeing another's data, having the isolation/permission suites run *only when someone remembers* is a real operational risk.

### 7. When a read fails, the user is told "you have no work"
Mutations (edits) fail loudly and correctly. But **read failures fail silently**: if loading a view errors (network blip, etc.), the table shows the same "Nothing here" as a genuinely empty view. The user is told they have nothing to do when the load actually broke. There's also **no global error boundary** — a render crash anywhere is a blank white screen with no recovery.

### 8. The AI accuracy evidence is thin, and the intended provider has never run
The AI Inbox is the differentiator, and its pipeline is genuinely robust (no AI output is trusted without validation; failures show an error and let the user retry). But the accuracy number — 97% — is a **single 30-item run on the smallest Gemini model**, not a real measurement, with a 23% "asked a clarifying question" rate that cuts against the "minimize effort" promise. And **Claude/Anthropic — the intended production provider — has never had a single successful run** (no credits). This isn't a code defect; it's a "know what you're standing on" disclosure before launch.

### 9. Blind in production (no observability)
There's a logging choke point ready for a real error tracker, but nothing is wired in. If the app breaks for a real user, **we have no way to find out.** For a live product that's a fix-soon.

---

## Tier 3 — Built but thinner than they look (scope-honesty)

- **Meeting is Task-with-a-different-word.** A Meeting can be captured and classified, and a full `meeting_details` table exists (start/end time, location, agenda, outcome) — but **nothing writes or shows it.** A Meeting has no date/time, no distinct behaviour; it renders with the identical Task fields. The PRD promises Meeting "a distinct lifecycle"; that lifecycle is unbuilt.
- **You can create containers but not manage them.** Projects/Folders/Lists can be created and selected, but there's **no rename, archive, move, or delete** in the UI (the schema supports archive; the UI doesn't use it).
- **The Activity feed doesn't show field edits (TD-009).** It shows creation, status, completion, list moves, responsibility, tags — but not title/priority/date/description changes. It weakens exactly the question the responsibility model makes people ask: "who changed this due date?"
- **Magic-link sign-in isn't built** (password works; Doc 4 named "magic link / password" — password satisfies the need, but the named alternative is absent).
- **AI captures are stamped with the wrong provider (TD-012, found in this audit)** — every `ai_captures` row records `provider: 'anthropic'` even though Gemini did the work. Minor, but it corrupts the very calibration data we said we were keeping.

---

## Explicitly NOT gaps (out of MVP scope by design — don't build these now)

These are deferred *on purpose* in the frozen package; listing them so they don't get mistaken for holes:
- **Notification delivery** (email/push/WhatsApp) — Future (PDL-011). In-app surfacing is the MVP.
- **Comments, real-time/presence** — Good-to-Have / Future (the reason not to build M7-as-written).
- **File attachments, recurring items, delegations, calendar sync, voice capture, reports/analytics, mobile app** — all Future/Good-to-Have.
- **Mobile-optimized layout** — desktop-first is the stated stance (FR-20); the app is cramped but not broken on a phone, which is acceptable.

---

## How I'd bundle this into a milestone

If you want to close the "real MVP" gap, the natural shape is **one milestone, two gates**, scoped like M6:

- **Gate A — "Trust & lifecycle" (the Tier 1 blockers):** password reset · member removal/deactivation/role-change · finish org deletion (TD-007) · fix the snooze wake loop (TD-011). This is the set that gates real users and real customers.
- **Gate B — "Operability & safety" (the worst of Tier 2):** CI running the test + red-team suites · a global error boundary + real read-error states · minimal production error tracking · tag soft-delete (TD-010).

Tier 3 items are individually small; they can ride along where cheap (e.g. the provider-label fix, TD-012, is a few lines) or wait for an explicit "finish Meeting" / "container management" decision.

**Deliberately not included:** anything from the Future/Good-to-Have list, and the AI-accuracy question (§8), which is a *testing/disclosure* task — best handled by funding Anthropic and running a real accuracy batch, not by writing app code.

---

## Decisions I need from you

| # | Decision | Why it needs you |
| --- | --- | --- |
| **D1** | **Email delivery.** Password reset (Tier 1 #1) and real invites both need transactional email, which we deferred (PDL-011). Do we stand up a minimal email path now (unblocks reset + invites), or keep deferring and accept no self-serve recovery? | This is a product/infra call with a cost, not a code detail. It's the single biggest unblock. |
| **D2** | **Scope of the next milestone.** Full "Trust & lifecycle + Operability" as above, or a thinner cut (e.g. just the Tier 1 blockers)? | Sizing depends on your launch timeline and who the first users are (internal/friendly vs. real paying companies). |
| **D3** | **Meeting type (Tier 3).** Finish it into a real scheduled item with date/time/location, or formally drop Meeting from MVP and make it Task/Note only until later? | It's a product-scope call — the frozen package lists three item types, but the third is currently hollow. |
| **D4** | **AI accuracy (§8).** Fund Anthropic and run a real accuracy batch before launch, or ship on Gemini `flash-lite` with the caveat documented? | Cost + risk-appetite call on the flagship feature. |

Nothing has been built or changed from this analysis except recording two newly-found defects (TD-011 snooze-never-wakes, TD-012 provider mislabel) in the debt register. Tell me which decisions you want to make and how to scope the next milestone, and I'll write the spec before any code — same as M6.
