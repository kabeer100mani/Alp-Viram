# Document 1 — Product Requirement Document (PRD)

> Status: **DRAFT — awaiting approval.** Part of the Product Freeze Phase.
> Owner: Product Architect. Language kept deliberately simple.
> Related: `PROJECT_PLAN.md`, `PRODUCT_DECISION_LOG.md`.

---

## 1. Vision

Alp-Viram is an AI-first work platform that makes managing work feel effortless.

Most project tools make people spend time *serving the software* — filing tasks
into folders, lists, and fields before any real work happens. Alp-Viram flips
this: **you capture in plain language, the software does the organizing.**

> One line: *Capture first. Organize later. Execute naturally.*

It should feel like a capable personal assistant that remembers your context and
reduces your effort — not another database you have to maintain.

---

## 2. Target Users

Primary (MVP focus):

- **Small & medium businesses (SMBs)** — owners/operators juggling many threads.
- **Finance teams** — recurring, deadline-driven work (MIS, reconciliations, filings).
- **Software teams** — tasks, follow-ups, discussions.
- **ERP implementation & consulting teams** — client-driven, multi-stakeholder work.

Common traits: multiple people, multiple ongoing threads, work that must survive
staff changes, and low tolerance for heavy process.

Secondary (later): larger enterprises needing deeper permissions and reporting.

---

## 3. Problem Statement

Teams lose time and clarity because existing tools demand structure *up front*:

1. **High capture friction.** To add one task you often pick a space, folder,
   list, project, priority, assignee, and labels. So quick thoughts never get
   captured, or land in scattered notes.
2. **Rigid hierarchies.** Deep nesting (workspace → space → folder → list → task)
   forces filing decisions and makes finding things a navigation exercise.
   <!-- Amended 2026-07-16 (PDL-032). Alp-Viram now HAS Folder → List. The
        objection above is refined, not abandoned: the friction is the word
        "forces". Structure is offered and never required — an item can always be
        captured with zero clicks and no list, landing in the Inbox. What we
        reject is *mandatory* filing at capture, not the existence of structure. -->
   *(Refined by PDL-032: Alp-Viram provides optional Folder → List; the problem is
   **forced** filing, not structure itself. Capture stays zero-click and unfiled.)*
3. **People-based ownership breaks.** Work is assigned to individuals. When
   someone leaves or switches roles, ownership must be manually reassigned and
   context is lost.
4. **AI bolted on.** Where AI exists, it often acts unpredictably or automates
   without asking, so users don't trust it.

Result: the tool becomes overhead. People fall back to WhatsApp, email, and
spreadsheets, and work slips through the cracks.

---

## 4. Product Philosophy

- **Reduce effort above all.** Every feature must answer: *does this reduce user
  effort?* If not, it is challenged before it is built.
- **Capture first, organize later, execute naturally.** Never force
  Project/Folder/List/Priority/Label decisions at capture time.
- **AI assists, the user decides.** AI reduces typing and clicks, organizes,
  remembers context, and suggests — but never performs irreversible actions
  without confirmation.
- **Responsibility is structural, not personal.** Work belongs to a *role*;
  execution belongs to a *current owner*. People can change without breaking
  ownership or rewriting history.
- **Challenge convention.** We do not assume existing PM software has the right
  workflow. Hierarchy, navigation, lifecycle, notifications, and collaboration
  are all open to redesign.

---

## 5. Core Principles

1. **Minimum clicks.** Every screen is measured by clicks-to-outcome.
2. **One front door.** The Inbox is the primary capture surface for everything.
3. **Optional structure over forced structure.** Folder → List exists but is never
   required; tags and saved views remain the primary way to slice work.
   *(Amended 2026-07-16 — PDL-032. Previously "**Flat over deep.** Organize with
   tags and saved views, not nested folders.")*
4. **Confirm, don't autopilot.** AI proposes; the user commits.
5. **Immutable history.** Audit and activity records never change retroactively.
6. **Provider-agnostic AI.** No lock-in to any single AI vendor.
7. **Security by default.** Tenant isolation enforced in the database (RLS).
8. **Capture Speed > Data Completeness.** Never block capture for a field; fill in later.
9. **AI restraint.** The AI knows when *not* to act — obvious input becomes an item
   immediately; it asks a question only when it genuinely improves the work.
   Reducing interaction beats maximizing intelligence.
10. **Progressive disclosure.** Solo users never see enterprise concepts (orgs, roles)
    until they invite someone or enable team collaboration.

---

## 6. MVP Scope (what we build first)

The MVP proves the core thesis end to end for a single team, with real AI capture
and role-based responsibility.

**In scope:**

1. **Accounts & tenancy** — sign up / sign in (Supabase Auth); create and belong
   to one or more **Organizations**; invite members.
2. **Roles & assignment (hybrid)** — define roles per org; assign users to roles
   over time. An Item may have **multiple Responsible Roles** (one Primary) and/or
   **multiple Assigned Users** (one Primary), plus optional **Collaborators**.
   Responsibility = Role; Execution = Assigned User. Assignment is never forced at
   capture. (Recurring-item schema and attachment support are built into the model
   from the start; their UIs may follow shortly after MVP.)
3. **AI Inbox (the centerpiece)** — two jobs: **(a) Capture** — a box where the
   user types naturally; AI classifies the input, asks the **minimum** clarifying
   questions, proposes a structured Item, and the **user confirms** before it is
   saved. **(b) Daily Triage** — a once-a-day guided **Daily Review** that is the
   only way items leave the Inbox, so it never becomes a dumping ground (see
   Document 3 for the ritual).
4. **Items** — a unified entity with a small set of **types**: **Task** (actionable),
   **Note** (information), **Meeting** (scheduled, distinct lifecycle). "Reminder"
   and "Follow-up" are Task **metadata**; "Knowledge" is Note metadata; "Question"
   is routed, not stored (full analysis + final decision in Document 5). Plus
   title, details, due/remind date, status, tags, responsibility fields, and an
   optional project.
5. **Projects (optional)** — a single, optional grouping level. Items can stay in
   the Inbox unorganized.
6. **Tags & Saved Views** — flat tags; system + custom saved views (e.g. My Day,
   Inbox, Overdue, Waiting for Client).
7. **Execution basics** — change status, reassign role/owner, complete items.
8. **Activity log** — immutable record of key changes (incl. responsibility
   transfers).
9. **Experience** — desktop-first responsive UI, light/dark, fast loads.

**Explicitly NOT in the MVP** (see Future Scope): voice capture, calendar sync,
notification delivery channels (email/push), reports/analytics, deep real-time
collaboration, mobile apps, temporary delegation, role inheritance, billing.

---

## 7. Future Scope (deliberately deferred)

- **Voice capture** (architecture must allow plugging it in without redesign).
- **Notifications & reminders delivery** — email, push, in-app, digests.
- **Calendar / meeting integration** (Google/Microsoft).
- **Reports & analytics** — workload, throughput, overdue trends, by role.
- **Advanced AI** — daily digest, "ask your workspace", proactive suggestions,
  auto-triage (all confirmation-based).
- **Deeper collaboration** — comments, mentions, real-time presence.
- **Files & attachments** at scale (Supabase Storage).
- **Enterprise permissions** — teams hierarchy, role inheritance, temporary
  delegation, fine-grained visibility.
- **Mobile / PWA** (and possible Play Store via TWA).
- **Billing & plans.**

---

## 8. User Stories (illustrative, MVP)

Capture:
- *As a finance manager, I type "Prepare July MIS before 8th" and the app creates
  a Task with the right due date and asks only what it truly needs.*
- *As an SMB owner, I type "Follow up with TCS" and it becomes a Follow-up I can
  find later — without me choosing a project or list.*

Organize:
- *As a consultant, I tag items `#infosys` and open a saved view to see everything
  for that client across projects.*
- *As a team lead, I later drag Inbox items into a Project when I'm ready — not
  before.*

Responsibility:
- *As an operations lead, I assign a task to the "Finance Manager" role, so if the
  person changes, the responsibility and open work move automatically.*
- *As an admin, when Kabir replaces Aman in a role, the operational ownership of
  his open items transfers, but the historical record still shows Aman did the
  earlier work.*

Execute:
- *As a current owner, I see "My Day" and complete items with a single action.*
- *As a manager, I see what's overdue by role without building a report.*

AI trust:
- *As any user, the AI shows me what it plans to create and I confirm or edit —
  it never silently changes my data.*

---

## 9. Functional Requirements (MVP)

Auth & Org:
- FR-1: Users can sign up, sign in, sign out (Supabase Auth).
- FR-2: Users can create an Organization and invite members.
- FR-3: A user can belong to multiple Organizations and switch between them.
  (MVP uses a *simplified* multi-org model — one active org at a time with a
  switcher — not simultaneous cross-org views. See Document 5 / PDL.)

Roles & Responsibility:
- FR-4: Admins can create Roles within an Organization and assign users to them.
- FR-5: An Item may have **zero or more Responsible Roles**; one may be marked
  **Primary**. A role is **never forced at capture** — the AI infers it
  (high confidence → pre-fill, low confidence → leave blank); it is confirmed at
  Daily Review or on edit. (PDL-020/021.)
- FR-6: An Item may have **zero or more Assigned Users** (executors); one may be
  marked **Primary**. **Collaborators** are optional. Responsibility = Role;
  Execution = Assigned User.
- FR-7: Responsibility resolves through **time-bounded role assignments**;
  replacing the user filling a role transfers operational ownership of appropriate
  open items with **no manual bulk reassignment**. Historical activity is
  immutable. (Rules detailed in Document 9.)

Inbox & AI Capture:
- FR-8: A user can type a natural-language input in the Inbox.
- FR-9: The AI classifies the input into an Item type and proposes metadata
  (tags, project, role, due date) with confidence.
- FR-10: The AI asks only the minimum missing questions.
- FR-11: The AI presents a structured draft; the Item is created only after the
  user confirms. AI never auto-creates irreversibly without confirmation.
- FR-12: Unclassified/loose Items remain in the Inbox until organized.
- FR-12a: A **Daily Review** presents Inbox + rolled-over items, grouped, for
  one-tap confirm / snooze / done / backlog, with the goal of Inbox → 0.
- FR-12b: Items un-triaged beyond an age limit are surfaced ("aging"), never
  silently left to rot. There is no raw "overdue" state — unfinished items roll
  over as a re-decision.

Items, Projects, Organization:
- FR-13: Items support title, type, details, due/remind date, status, tags,
  responsibility fields, and an optional Project.
- FR-14: Users can create optional Projects and move Items into them.
- FR-15: Users can add/remove flat Tags on Items.
- FR-16: Users can open system and custom Saved Views (filtered lists).

Execution & Audit:
- FR-17: Users can change status and complete Items.
- FR-18: All significant changes are written to an immutable Activity Log.

Experience:
- FR-19: The app supports light/dark themes with persistence.
- FR-20: The app is responsive (desktop-first) and loads fast.

---

## 10. Non-Functional Requirements

- **Security:** multi-tenant isolation enforced by Postgres RLS; AI keys and
  privileged operations server-side only (Edge Functions); least-privilege access.
- **Privacy:** user data sent to AI providers is minimized and clearly scoped;
  provider is swappable; no training on customer data without consent.
- **Performance:** first meaningful screen fast; interactions feel instant
  (optimistic UI + caching). Target: capture-to-saved in a few seconds.
- **Reliability:** no data loss on capture; graceful handling of AI/provider
  failures (capture still succeeds even if classification fails).
- **Accessibility:** keyboard-first, ARIA labels, sufficient contrast in both themes.
- **Maintainability:** clean architecture; business logic separate from UI and AI;
  strong typing; tests.
- **Observability:** structured logging via a single sink; auditability.
- **Scalability:** data model and indexes designed to grow (validated in Docs 6–7).
- **Portability:** provider-agnostic AI; storage/auth behind clear boundaries.

---

## 11. Success Criteria

Numeric targets are **not frozen now** — we instrument these, then set targets
after the first working prototype (PDL-026). Two categories:

**Product Experience Metrics**
- Time to first captured item (from signup).
- Average capture effort (interactions/seconds per capture).
- Daily Review completion rate.
- Inbox-Zero frequency (how often the Inbox is cleared).
- % of captures requiring an AI clarification question (lower is better — AI restraint).

**Business Metrics**
- Daily Active Users.
- Weekly retention.
- Team adoption (invites → active teammates).
- Reduction in manual task management.
- Reduction in task-creation time vs prior tools.

**Non-negotiable quality bars (0 tolerance):**
- No silent, irreversible AI actions.
- No cross-tenant data exposure.
- Replacing a user in a role requires **no manual bulk reassignment** of open work.

---

## 12. Resolved Decisions & Remaining Assumptions

Resolved during this package (see PDL for full rationale):
- **Item types →** Task / Note / Meeting as stored types; Reminder, Follow-up,
  Knowledge as metadata; Question routed, not stored (Document 5).
- **Reminders →** in-app only for MVP; push/email/WhatsApp are future.
- **Multi-org →** kept, but MVP uses a simplified "one active org + switcher" model.
- **Notifications delivery →** future (in-app surfacing only for MVP).

Still to validate (flagged in Architect's Recommendations):
- Whether **attachments** are needed in MVP (currently future).
- Whether **Meeting** stays a distinct type in MVP or starts as Task+metadata
  until calendar sync exists (Document 5 discusses; leaning: keep as a light type).
- Concrete numeric targets for the Success Criteria.

---

*Part of the Product Design Package (Documents 1–5). Delivered together for a
single review — see the package index and the Architect's Recommendations.*
