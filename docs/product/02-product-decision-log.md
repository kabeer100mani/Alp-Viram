# Document 2 — Product Decision Log (PDL)

> The canonical, living log of major decisions. Supersedes the earlier
> `docs/PRODUCT_DECISION_LOG.md`. Each entry: **Decision · Why · Alternatives
> Considered · Trade-offs · Status.** Status: Accepted · Proposed · Superseded · Revisit.

---

### PDL-001 — Build tool: Vite (SPA)
- **Decision:** React SPA built with Vite.
- **Why:** App is behind login; no SEO/SSR need. Fastest, simplest path.
- **Alternatives:** Next.js.
- **Trade-offs:** We give up built-in SSR/routing/marketing-page tooling; if we later need a public marketing site or SEO, we add it separately.
- **Status:** Accepted

### PDL-002 — Backend: Supabase (hosted cloud)
- **Decision:** Hosted Supabase for Postgres, Auth, Storage, Edge Functions.
- **Why:** One platform, fast setup, easy collaboration.
- **Alternatives:** Local Supabase (Docker); custom Node/Postgres backend.
- **Trade-offs:** Some vendor coupling to Supabase's APIs; mitigated by keeping data access behind a repository layer.
- **Status:** Accepted

### PDL-003 — AI is provider-agnostic
- **Decision:** Business logic depends only on an `AIProvider` interface; providers are adapters.
- **Why:** Avoid lock-in; compare/switch OpenAI, Anthropic, Gemini freely.
- **Alternatives:** Couple to one SDK.
- **Trade-offs:** A thin abstraction to maintain; can't use the most exotic provider-specific features without extending the interface.
- **Status:** Accepted

### PDL-004 — AI runs server-side only (Edge Functions)
- **Decision:** All AI calls go through Supabase Edge Functions, never the browser.
- **Why:** Provider keys must never reach the client; clean AI/business boundary.
- **Alternatives:** Client-side AI calls.
- **Trade-offs:** Slightly more latency/infra vs direct calls; worth it for security.
- **Status:** Accepted

### PDL-005 — Core workflow: Capture First, Organize Later, Execute Naturally
- **Decision:** No Project/Folder/List/Priority/Label decisions forced at capture.
- **Why:** Capture friction is the #1 complaint about existing tools (research-verified).
- **Alternatives:** Traditional up-front filing.
- **Trade-offs:** Creates a triage backlog that must be actively managed (addressed by the Daily Review, PDL-016).
- **Status:** Accepted

### PDL-006 — Data model: drop Folder and List
- **Decision:** `Organization → (optional) Project → Item`. No Folder, no List.
- **Why:** Deep hierarchy causes friction and "emergent complexity" (verified: Monday/Notion/ClickUp degrade at scale).
- **Alternatives:** ClickUp's Workspace→Space→Folder→List→Task.
- **Trade-offs:** Flat models can strain at scale; requires strong tags/views/search/performance (PDL-010, and a named risk).
- **Status:** Accepted

### PDL-007 — Unified Item; three stored types + metadata
- **Decision:** One `Item` entity. Stored **types: Task, Note, Meeting.** "Reminder"/"Follow-up" = Task metadata; "Knowledge" = Note metadata; "Question" = routed, not stored.
- **Why:** Classifying among 7 fuzzy types hurts AI accuracy and user effort. Fewer, clearly-distinct types = reliable classification. (Full analysis in Doc 5.)
- **Alternatives:** 6–7 separate types; separate tables per type.
- **Trade-offs:** Some concepts become attributes users can't see as "types"; mitigated by capture intents ("remind me…") and dedicated views (Follow-ups, Knowledge).
- **Status:** Accepted (final confirmation in Doc 5)

### PDL-008 — Items can exist without a Project (Inbox)
- **Decision:** Project is optional; unorganized Items live in the Inbox.
- **Why:** Capture-first naturally yields homeless items.
- **Alternatives:** Mandatory project.
- **Trade-offs:** Needs the Daily Review to prevent Inbox rot.
- **Status:** Accepted

### PDL-009 — Multi-organization: keep, simplified for MVP
- **Decision:** Keep multi-org, but MVP = **one active org at a time + a switcher**, not simultaneous cross-org views.
- **Why:** Real users (consultants, professionals) work across orgs; but simultaneous cross-org state adds major complexity for little early value.
- **Alternatives:** Single org only (rejected — loses a target-user need); full simultaneous cross-org (deferred).
- **Trade-offs:** A user wanting a combined view across orgs must switch; acceptable for MVP, revisit later.
- **Status:** Accepted

### PDL-010 — Organize via Tags and Saved Views, not hierarchy
- **Decision:** Flat Tags + Saved Views (My Day, Overdue, Waiting for Client, per-client, …).
- **Why:** Multi-dimensional, low-friction; avoids naming-drift/duplicate-board problems (verified in Monday's community).
- **Alternatives:** Nested folders/lists.
- **Trade-offs:** Power depends entirely on filter/search quality; weak search = a flat graveyard.
- **Status:** Accepted

### PDL-011 — Reminders: in-app only for MVP
- **Decision:** Reminders work inside the app (Today/Due views). Push/email/WhatsApp are future.
- **Why:** Delivery channels are separate, heavy infra; in-app proves the value first.
- **Alternatives:** Build notification delivery in MVP.
- **Trade-offs:** Users won't get pinged outside the app yet; acceptable for early adopters.
- **Status:** Accepted

### PDL-012 — AI never performs irreversible actions without confirmation
- **Decision:** AI suggests/drafts; the user confirms. No silent, irreversible automation.
- **Why:** 2026 consensus is human-in-the-loop; autopilot tools (Motion) breed distrust and a fully-autonomous PM tool (Height) shut down Sept 2025.
- **Alternatives:** Auto-execute / full autonomy.
- **Trade-offs:** Slightly more taps than "magic"; buys trust and safety — the right trade.
- **Status:** Accepted

### PDL-013 — Multi-tenant isolation via Postgres RLS
- **Decision:** Every business row carries `organization_id`; RLS enforces isolation in the DB.
- **Why:** A UI bug must never leak another org's data.
- **Alternatives:** App-layer-only checks.
- **Trade-offs:** RLS policies add design/testing effort; non-negotiable for a SaaS.
- **Status:** Accepted

### PDL-014 — Frontend stack additions
- **Decision:** shadcn/ui-style primitives (Tailwind v4 + CVA), TanStack Query, Zustand, Framer Motion, React Hook Form + Zod, Vitest + Playwright.
- **Why:** Premium accessible UI we own; caching for a fast feel; Zod validates both forms and AI output.
- **Alternatives:** MUI/AntD (less control over the look).
- **Trade-offs:** We assemble components rather than get them prebuilt; more control, slightly more setup.
- **Status:** Accepted

### PDL-015 — Responsibility = Role → time-bounded Role-Assignment → derived person
- **Decision:** Items store a **Responsible Role** (mandatory, never a user). "Who is responsible now" is *derived* through a time-bounded Role-Assignment (user↔role with valid_from/valid_to). Optional **Current Owner** (executor) and **Collaborators**.
- **Why:** Mirrors PagerDuty schedules and SAP "position vs person" (verified). Replacing a person = one row change; work items are never mass-reassigned; the mapping lives in exactly one place so it can't drift.
- **Alternatives:** Assign to individuals (breaks on staff change); RACI in a side sheet (duplicates, goes stale).
- **Trade-offs:** Adds a setup step (define roles + who fills them) and indirection ("who is 'Ops Lead' today?"). Mitigated by making role→person mapping near-zero-effort and surfacing unfilled roles loudly.
- **Status:** Accepted (detailed design in Doc 9)

### PDL-016 — Inbox has a second job: Daily Triage
- **Decision:** The Inbox is capture **and** a once-a-day guided **Daily Review** — the only way items leave the Inbox — with anti-dumping-ground rules (age limits, guilt-free rollover, snooze, batch confirm).
- **Why:** Easy capture *guarantees* an "overdue graveyard" unless paired with a forced, low-effort triage ritual (verified across GTD/Todoist/Sunsama/Linear/Superhuman).
- **Alternatives:** Capture-only inbox (rejected — becomes a dumping ground).
- **Trade-offs:** Introduces a daily habit; designed to take 5–10 min and feel rewarding (Inbox → 0).
- **Status:** Accepted

### PDL-017 — Temporary Delegation is a non-owning overlay
- **Decision:** Delegation grants another user the right to *act* for a role/period; it does **not** transfer ownership and does **not** cascade. Authority reverts automatically when it expires.
- **Why:** Matches ServiceNow's proven model; keeps ownership and history clean.
- **Alternatives:** Reassigning ownership for cover (pollutes ownership/history).
- **Trade-offs:** Two concepts (assignment vs delegation) to explain; keeps semantics correct.
- **Status:** Accepted (detailed design in Doc 9)

### PDL-018 — Immutable audit via append-only event log
- **Decision:** Responsibility/ownership changes are recorded as append-only events (actor, action, old→new, effective_at, recorded_at); completed items are frozen history.
- **Why:** Enables "who was responsible on date X" and tamper-proof audit (event-sourcing pattern).
- **Alternatives:** Mutating rows in place (loses history).
- **Trade-offs:** More storage and read-model work; essential for enterprise trust.
- **Status:** Accepted (detailed design in Docs 8–9)

### PDL-019 — Voice deferred; text-first, pluggable later
- **Decision:** MVP ships text capture; architecture lets voice plug in without redesign.
- **Why:** Voice adds permissions/accuracy/mobile complexity for the same "fewer clicks" text already delivers.
- **Alternatives:** Voice in MVP.
- **Trade-offs:** No voice at launch; captured as a clean future extension point.
- **Status:** Accepted
