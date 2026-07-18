# Document 2 — Product Decision Log (PDL)

> The canonical log of major decisions. Supersedes the earlier
> `docs/PRODUCT_DECISION_LOG.md`. Each entry: **Decision · Why · Alternatives
> Considered · Trade-offs · Status.** Status: Accepted · Proposed · Superseded · Revisit.
>
> 🔒 **LOCKED — architecture frozen 2026-07-11. Product Design Phase COMPLETE.**
> Changing a locked decision now requires an explicit change request (and a new
> PDL entry recording it).

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
- **Status:** ⛔ **SUPERSEDED by [PDL-032](#pdl-032--reversal-reinstate-folder--list-optional-2026-07-16) (2026-07-16).** Folder → List is reinstated as **optional** structure. The capture-first half of this decision survives in PDL-005 (nothing is forced at capture).

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
- **Status:** Accepted — **amended 2026-07-16 by [PDL-032](#pdl-032--reversal-reinstate-folder--list-optional-2026-07-16).** Hierarchy is no longer excluded: Folder → List exists, but is **optional**. Tags + Saved Views remain the **primary cross-cutting** mechanism — a List is one place; tags and views are many angles. Read this as "tags and views **as well as** optional hierarchy", not "instead of".

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
- **Decision:** Responsibility is modeled through **Roles**, resolved to people via a **time-bounded Role-Assignment** (user↔role, valid_from/valid_to). A responsible role is **not** forced at capture (may be blank). *(Extended by PDL-020: hybrid, multi-role AND multi-user assignment with primary markers.)*
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

---

## Batch 3 decisions (2026-07-10) — package approval + assignment model

### PDL-020 — Assignment model: hybrid, multi-role and multi-user
- **Decision:** Support **three assignment methods — Role, User, Hybrid.** An Item may have **multiple Responsible Roles** (one may be marked **Primary**) and **multiple Assigned Users** (one may be marked **Primary**); Collaborators remain optional. A user can belong to many roles; a role can hold many users. **Responsibility = Role; Execution = Assigned User.** Historical ownership never changes.
- **Why:** Real teams mix role-based responsibility with direct execution ownership; forcing one model is too rigid.
- **Alternatives:** Single responsible role + single owner (too rigid); user-only assignment (breaks on staff change).
- **Trade-offs:** More relationship tables and UI affordances (primary markers, multiple chips); mitigated by progressive disclosure and sensible defaults (usually one role, one user).
- **Status:** Accepted

### PDL-021 — Capture priority: Speed > Completeness
- **Decision:** Never force role/owner/fields at capture. AI **infers** the responsible role; **high confidence → pre-fill**, **low confidence → leave blank**. Final confirmation happens at Daily Review or on edit.
- **Why:** Capture friction is the core problem; an incomplete-but-captured item beats a perfect-but-abandoned thought.
- **Alternatives:** Require a role/owner at capture.
- **Trade-offs:** Some items are under-specified until triage; that's acceptable and by design.
- **Status:** Accepted

### PDL-022 — Progressive disclosure for solo users
- **Decision:** Hide Organization, Roles, and team-management concepts for solo users. They appear only when a second member is invited or team collaboration is explicitly enabled.
- **Why:** A solo professional should never face enterprise concepts.
- **Alternatives:** Always show org/role UI.
- **Trade-offs:** Two UX modes (solo vs team) to maintain; data model is identical underneath (an org always exists, just hidden).
- **Status:** Accepted

### PDL-023 — Meeting stays a separate, calendar-ready Item type
- **Decision:** Meeting remains its own type (distinct before/after lifecycle). Type-specific fields live in a separate `meeting_details` structure so future calendar integration needs no Item-model redesign.
- **Why:** Different lifecycle than Task; isolate meeting/calendar concerns.
- **Alternatives:** Meeting as Task metadata.
- **Trade-offs:** A third type + a side table; kept deliberately light in MVP.
- **Status:** Accepted

### PDL-024 — Recurring items: design DB now, UI if simple
- **Decision:** Model recurrence in the database now (RRULE-based). Include the UI in MVP **if reasonably simple**; otherwise ship the schema and defer the UI.
- **Why:** Recurring work (MIS, GST, payroll, weekly reviews, follow-ups) is fundamental for our users.
- **Alternatives:** Ignore recurrence until later (would force a schema change).
- **Trade-offs:** Some schema built ahead of UI; low cost, avoids redesign.
- **Status:** Accepted

### PDL-025 — Attachments: model now, UI just-after MVP
- **Decision:** The Item model supports attachments from day one (Supabase Storage); the upload UI is delivered immediately after MVP.
- **Why:** Common need; must not require a later database redesign.
- **Alternatives:** Add attachments schema later.
- **Trade-offs:** A dormant table/relationship for a short while.
- **Status:** Accepted

### PDL-026 — Success metrics: two categories, targets after prototype
- **Decision:** Track **Product Experience Metrics** (time-to-first-capture, capture effort, Daily Review completion, Inbox-Zero frequency, % captures needing AI clarification) and **Business Metrics** (DAU, weekly retention, team adoption, reduction in manual task management, reduction in task-creation time). **Numeric targets are set after the first working prototype**, not now.
- **Why:** Real baselines beat guessed targets.
- **Alternatives:** Freeze numeric targets today.
- **Trade-offs:** No hard targets yet; we instrument first, target second.
- **Status:** Accepted

### PDL-027 — Reminder: UX independent of storage
- **Decision:** Reminder is stored as Task metadata (`remind_at` + a reminder marker), but the **experience feels like a real Reminder** ("Remind me tomorrow to review GST" → a Reminder). Never expose storage internals to users.
- **Why:** Clean data model + natural UX; the two are decoupled.
- **Alternatives:** A separate Reminder type (rejected — type proliferation) OR exposing "it's really a task" (rejected — leaks implementation).
- **Trade-offs:** UI must map metadata to a distinct reminder presentation; small effort.
- **Status:** Accepted

### PDL-028 — AI restraint: know when NOT to use AI
- **Decision:** The AI must minimize interaction. Obvious inputs ("Buy milk") become a Task immediately with no questions. Ask a question **only** when it genuinely improves the captured work. **Reducing interaction > maximizing intelligence.**
- **Why:** Every needless question is friction; restraint is a feature.
- **Alternatives:** Always confirm/clarify (annoying); always auto-fill silently (risky).
- **Trade-offs:** Requires good confidence calibration to decide when to stay silent.
- **Status:** Accepted

### PDL-029 — No board view; the workspace is navigated by intent (2026-07-16)
- **Decision:** Alp-Viram has **no board surface**. The workspace is navigated through the intent-based left rail and saved views specified in Doc 5 (Inbox · Today · Upcoming · Projects · Views · Search · People & Roles). `PROJECT_PLAN.md`'s M3 line ("List + **board** views") **predates the 2026-07-11 freeze and is superseded** by Doc 5; the roadmap line has been corrected.
- **Why:** Doc 5 (`:124`) already rejects boards by name — tags+views *"avoids the **duplicate-board** / naming-drift failure of hierarchical tools"* — and the competitive analysis criticises Monday as *"Board-centric; no lightweight global inbox"*. The word "board" appears nowhere in Docs 1–6 as a workspace surface. Building one would contradict the frozen IA, not extend it.
- **Alternatives:** (a) Build a board as a projection of `item_state` — rejected: it would need an explicit change request to unfreeze Doc 5, and re-introduces the failure mode the IA was written to avoid. (b) Defer the decision — rejected: it would leave M3's scope ambiguous.
- **Trade-offs:** Users arriving from Trello/Monday will look for a board and not find one. Accepted deliberately: the differentiator is the Inbox + intent views, not another board tool.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-031 — M5 "Assistant depth" deferred; People & Roles + Responsibility is next (2026-07-16)
- **Decision:** Do **not** build M5 as the roadmap describes it. "Ask your workspace" queries and smart/proactive suggestions **stay in Future scope**. The next milestone is **People & Roles + Responsibility** — the Must-Have surfaces for creating roles, making time-bounded role-assignments, and setting Responsible Roles / Assigned Users / Collaborators on items. `PROJECT_PLAN.md`'s M5 line is corrected.
- **Why:** M5's two named deliverables are listed **word for word** in the frozen package's deferred scope — PRD §7 *"Future Scope (deliberately deferred): **Advanced AI** — daily digest, **"ask your workspace"**, proactive suggestions"* and Doc 4 *Future*: *"**Advanced AI** — daily digest, deep **"ask your workspace,"** proactive suggestions — **build on the capture/triage foundation once it's trusted**"*. That deferral is conditional, and the condition is not met: capture/triage is days old, unused by any real user, and validated only on Gemini `flash-lite` (Anthropic has never had a successful run). Meanwhile two **Must-Have** items have no UI whatsoever: *"Roles + time-bounded Role-Assignments — the heart of the responsibility differentiator"* and *"Responsibility fields — the differentiator, on every item"*. The permission model (`0005`) and the TDL-012 derivation already **enforce** responsibility, but it can only be reached by writing SQL — the product's central claim is fully built underneath and completely unreachable.
- **Alternatives:** (a) Build M5 as written — rejected: contradicts frozen Future scope, would need a change request, and leaves the differentiator unusable. (b) Projects first — rejected as the *first* step: also Must-Have but smaller and less central; scheduled after.
- **Trade-offs:** The roadmap's numbering drifts further from the plan (as with PDL-029). Accepted: the roadmap predates the 2026-07-11 freeze, and the frozen package governs.

### PDL-032 — REVERSAL: reinstate Folder → List, optional (2026-07-16)
- **Decision:** **Supersedes PDL-006.** Reinstate structure as `Organization → Folder → List → Item`, where **"Workspace" = the existing Organization** (a user keeps several — Personal, Profile 1, Profile 2 — and switches between them; no new top-level concept). Implemented the cheapest way: **today's `Project` is renamed to `List`** (same table, data preserved) and **`Folder` is added above it**. A List may sit inside a Folder or at the Org root.
  - **`list_id` stays OPTIONAL.** Quick capture with zero clicks must keep working: an item with no list lands in the Inbox exactly as today.
  - **The AI does not infer the list** — grouping stays a human/triage decision (see Trade-offs).
- **Why:** This is a **deliberate reversal, recorded as such** — not a silent schema change. PDL-006 rejected ClickUp's `Workspace→Space→Folder→List→Task` by name, and the PRD's problem statement (`01:44-47`) cites that exact nesting as the friction Alp-Viram exists to remove. Palash, as Product Architect and the product's first real user, judges that his actual work needs Folder → List structure. Lived use outranks a document written before the product existed. What PDL-006 got *right* is preserved: the friction it feared came from **mandatory, deep** filing at capture time, and capture stays unfiled and zero-click (PDL-005 is untouched).
- **Alternatives:** (a) Keep the flat model — rejected by Palash. (b) Add Folder/List *alongside* Project — rejected: three overlapping groupings. (c) Drop Project and build Folder/List fresh — rejected: discards a shipped, RLS'd table for no gain. (d) Make List mandatory — **rejected: it would break capture-first and void the AI Inbox's premise.**
- **Trade-offs:**
  - The flat-model thesis ("Flat over deep") is now a **qualified** principle, not an absolute: structure exists but is never required. PRD `01:82`, PDL-010, Doc 4's Rejected row and Doc 5's structural model are amended accordingly.
  - Optional structure means two ways to organise (hierarchy **and** tags/views). That redundancy is accepted; PDL-010's tags/views remain the primary cross-cutting mechanism, since a List is one place while tags are many angles.
  - **Emergent complexity — the risk PDL-006 named — is now live again.** It is mitigated only by List being optional and by the Inbox/Daily Review remaining the default path. Worth revisiting once real folders exist at scale.
  - Keeping the AI out of list inference preserves PDL-028 (AI restraint) and costs nothing today; revisit if triage proves tedious.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-033 — Checklists and Definition of Done (2026-07-16)
- **Decision:** Items get a **checklist** (ordered, tickable sub-steps) and a **Definition of Done**. DoD is a **plain note field** — descriptive, **not enforced**: completing an item does not require it to be satisfied. Neither applies to Notes (no done-state, IA).
- **Why:** Both were **never captured** in the frozen package — a search of every PDL and doc (2026-07-16) found no decision rejecting them, no deferral, and no mention at all; the words appear only in the competitive analysis describing other tools. So this is an **omission being filled, not a decision being reversed** — unlike PDL-032.
- **Alternatives:** (a) Enforced DoD (cannot complete until satisfied) — deferred: a materially different product decision that touches the completion path and needs a DB constraint to be real rather than cosmetic. (b) DoD as a flagged checklist — deferred; the note field is column-compatible with tightening later.
- **Trade-offs:** An unenforced DoD is documentation, not a gate — it can go stale. Accepted for now; tightening later is additive.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-043 — Item start/end time-of-day + a 06:00–24:00 default window (timeboxing-lite) (2026-07-18)
- **Decision:** Two parts. **(a) In-contract bug fix:** the AI already captures a clock time on `due_at`/`remind_at` (TD-005), but the client dropped it — `formatDate` showed date-only and the date editors overwrote the time with noon. Fixed: time-of-day is displayed when present and **never clobbered** on a date edit. **(b) New (pulled forward):** an item's schedule reads as a **start→end time window** — `start_at` = start, `due_at` = end, both **time-aware** — and when a date carries **no clock time**, the window defaults to **06:00 → 24:00** ("anytime that day"). **Reuses `start_at`/`due_at`; NO new `end_at` column; no migration** (midnight-local = "no specific time", the D5 convention). The classifier is told to emit **midnight when the user gives no clock time**, so the convention is deterministic.
- **Amends the frozen package:** Doc 4 files "**Timeboxing onto a simple internal calendar**" as **Good-to-Have** ("not required to prove the thesis"), and PDL-039 declined to build "start/end time" scheduling (in the dormant `meeting_details`). Part (b) pulls that Good-to-Have forward, minimally. Part (a) is not new scope — it honors the shipped TD-005 datetime contract. The **06:00–24:00 window has no prior source**; it is introduced here.
- **Why:** Palash wants real time-of-day captured without slowing capture. The time was already captured and silently lost — a genuine bug. The window default gives a "no specific time" dated item a sensible working-day span instead of a misleading 00:00.
- **Deliberately minimal / excluded:** no `end_at` column (reuse `due_at` as the window end — a task's deadline ≈ its window end); no calendar/drag-to-timebox surface (that stays the deferred Good-to-Have); `remind_at` keeps its own precise datetime field (unchanged).
- **Alternatives:** (a) a `*_has_time` boolean per field — rejected for MVP (a column + contract change; the midnight convention is enough). (b) a real `end_at` — rejected: heavier, closer to the deferred calendar feature.
- **Status:** Accepted (ruled by Palash, 2026-07-18).

### PDL-042 — Capture-time follow-up is List-only, tap-to-answer (2026-07-18)
- **Decision:** After the AI classifies a capture, if it is **genuinely unsure which List** the item belongs to *and* the org has lists, show **one skippable, tap-to-answer question** offering the org's real lists as buttons (+ "Inbox for now"). One tap files it; skipping leaves it in the Inbox. This **upgrades the existing PDL-028 clarifying-question slot** (previously a free-text box) to tap buttons, scoped to **List only**. Capture input stays zero-click; the question lives in the existing confirm card (PDL-012) and never blocks saving. The **AI does not infer the list** (PDL-032) — it only flags the *dimension*; the app owns the options.
- **Explicitly excluded from the follow-up, with reasons (Palash, 2026-07-18):**
  - **Priority, assigned user** — Doc 4 names them in the "Forcing fields (priority, labels, assignee) at capture" **Rejected** row (Doc 4:77); PDL-005/PRD §4 too.
  - **Responsible role** — PDL-021/FR-5 already specify the unsure case: **low confidence → leave blank, confirm at Daily Review**, not ask at capture.
  - **Due date** — many tasks legitimately have none; a missing due date is not "missing information."
  - **Project** — redundant once a List is picked (a List sits inside a Project).
  - **Checklist / Definition of Done** — these need real typing, not a one-tap answer; they belong at work-the-task time, not capture.
- **Amends the frozen package (narrowly):** the locked docs place filing "**later**, in Daily Review or manually" (PDL-035) and "Capture First, Organize **Later**" (PDL-005), and reject **forced** or **AI-inferred** filing (Doc 4:75, PDL-032). A **skippable, user-tapped** List choice violates neither the "forced" nor the "AI-inferred" letter, but it does bend the "organize later" **spirit** by offering one filing tap at capture. Ruled acceptable by Palash because it is optional, one-tap, and only appears when genuinely useful.
- **Alternatives:** (a) Ask nothing at capture; file everything at Daily Review (the pure frozen stance) — rejected by Palash: a one-tap file saves a real step for obviously-project-bound captures. (b) Also ask who/priority — rejected (the Doc 4 / PDL-021 conflicts above).
- **Status:** Accepted (ruled by Palash, 2026-07-18).

### PDL-041 — Installable PWA + Vercel deployment, pulled forward from Future scope (2026-07-17)
- **Decision:** Ship an **installable PWA** (manifest + icons + a conservative service worker) so browsers offer "Install" / "Add to Home Screen" and the app launches without browser chrome on phone and desktop; and **prepare real deployment** on **Vercel** (frontend host) with **Supabase unchanged** as the backend. Not a native app / app-store build.
- **Amends the frozen package:** Doc 4 lists "**Mobile app / PWA / Play Store (TWA)**" under **Future ("after the web product proves out")**. Ruled forward by Palash (2026-07-17); recorded, not silent.
- **Why it's low-risk to pull forward:** it's **additive infrastructure** — no change to the product model, data, RLS, or the "minimize effort" thesis. The PWA is an install/distribution wrapper; Vercel is static hosting for the existing Vite SPA talking to the existing Supabase. The heavier Future item (a *native* app / Play Store TWA) is **not** built.
- **Deliberately conservative service worker:** never intercepts cross-origin (Supabase) requests; network-first for navigations + assets with cache only as an offline fallback — avoids the classic "PWA serves a stale app after deploy" trap. No offline *data* mode (the app needs Supabase).
- **Alternatives:** (a) `vite-plugin-pwa` (Workbox) — rejected for MVP: a hand-rolled minimal SW avoids a build-plugin dependency and the stale-cache footgun, and is sufficient for installability. (b) A native wrapper / Play Store TWA — out of scope (the real Future item). (c) A different host (Netlify, Cloudflare Pages) — Vercel chosen for first-class Vite support and the simplest founder-run setup.
- **Trade-offs:** icons are generated from the brand mark (`public/favicon.svg`) via Playwright (`npm run gen:icons`) — no image dependency, but re-run if the mark changes. Password-reset/auth links require the Vercel URL to be added to Supabase's allow-list (documented in [docs/DEPLOY.md](../DEPLOY.md)).
- **Status:** Accepted (ruled by Palash, 2026-07-17). Code prep complete + verified; deployment is founder-run per [docs/DEPLOY.md](../DEPLOY.md).

### PDL-040 — M7 is "Trust & Lifecycle", not "Files & notifications" (2026-07-17)
- **Decision:** **M7 is the "Trust & Lifecycle" milestone** — the Tier-1 MVP blockers from the gap analysis (password reset + minimal email, member offboarding, org deletion/TD-007, snooze wake/TD-011). The roadmap's old "M7 — Files & notifications" is **not** what M7 now is.
- **Why:** same pre-freeze-roadmap trap as PDL-038 (M6) — `PROJECT_PLAN.md` §8's M7 line ("Supabase Storage, attachments, notifications") is Future/Good-to-Have scope: Doc 4 files attachments as *Good-to-Have* and notification delivery as *Future*, and PRD `:143` puts notification channels in "explicitly NOT in the MVP". Building it would add deferred surface while real-user blockers (no password recovery, no offboarding, no tenant deletion) stand open. Scope ruled by Palash (D2: Tier-1 only). Spec: [docs/M7-trust-lifecycle-spec.md](../M7-trust-lifecycle-spec.md).
- **Trade-offs:** the roadmap's M7/M8 numbering no longer matches the plan table; §8 is annotated (as it already was for M6). Files & notifications remain genuinely deferred.
- **Status:** Accepted (ruled by Palash, 2026-07-17). **COMPLETE — both gates signed off 2026-07-17** (Gate A accounts/team; Gate B org deletion/TD-007 + snooze wake/TD-011).

### PDL-039 — Meeting dropped as a distinct item type for MVP (Task/Note only) (2026-07-17)
- **Decision:** **Meeting is removed as a distinct, user-facing item type for the MVP.** Capture and triage offer **Task** and **Note** only; the AI classifier no longer returns `meeting` (a meeting-ish capture becomes a **Task**). The `meeting_details` table and the `meeting` enum value **stay in the schema, dormant** — no data is destroyed, and Meeting can be revived later without a migration. **No scheduling logic is built** (start/end time, location, agenda, calendar) until it's actually needed.
- **Amends the frozen package:** Doc 4 / Doc 5 / the ERD list **three** stored item types (Task, Note, Meeting), and the PRD promises Meeting "a distinct lifecycle". Recorded as an explicit amendment ruled by Palash (2026-07-17), not a silent deviation.
- **Why:** the MVP gap audit found Meeting was **Task-with-a-different-word** — the type classified but `meeting_details` was written by nothing, so a Meeting had no date/time and no distinct behaviour. Shipping a hollow third type is worse than shipping two honest ones; a "Meeting" that silently behaves like a Task misleads. Building real scheduling is Good-to-Have effort the MVP doesn't need (calendar sync is explicitly Future). Dropping it removes a misleading surface at near-zero cost.
- **Alternatives:** (a) Finish Meeting into a real scheduled item — rejected: scheduling/calendar is Future scope, not an MVP blocker. (b) Leave Meeting as-is (hollow) — rejected: it presents as a distinct type while behaving identically to a Task, which is a credibility gap on the data model.
- **Trade-offs:** the item-type enum keeps a value the UI won't emit (harmless; the DB already accepts it, and reviving it is additive). Any historical items already typed `meeting` still render (labelled "Meeting") — this changes creation, not existing rows.
- **Status:** Accepted (ruled by Palash, 2026-07-17). Implementation folds into the "Trust & lifecycle" milestone as a small tag-along.

### PDL-038 — M6 is "MVP completion", not "Collaboration" (2026-07-16)
- **Decision:** **M6 is renumbered** from the roadmap's *"Collaboration — comments, assignments, realtime"* to **"MVP completion"**: the five Doc 4 **Must Haves** still unbuilt — **Tags**, **organization rename**, **multi-org switcher (PDL-009)**, **custom saved views**, and **reminder surfacing (PDL-011)** — plus a **TD-006** tag-along (stop displaying the fake "confidence 100%"). Spec: [docs/M6-mvp-completion-spec.md](../M6-mvp-completion-spec.md). **M5 was formally signed off** at the same time, with its known gaps (org rename, switcher) explicitly moved here rather than carried as done.
- **Why:** `PROJECT_PLAN.md` §8's roadmap **predates the 2026-07-11 freeze** and M6's line is contradicted by it on all three counts — Doc 4 files **Comments** as *Good-to-Have* ("MVP only if cheap") and PRD §7 as *Future* ("Deeper collaboration — comments, mentions"); Doc 4 files **Real-time collaboration/presence** as *Future* and PRD `:143` puts "deep real-time collaboration" in **explicitly NOT in the MVP**; and **assignments already shipped in M5**. Meanwhile five Must Haves sit unbuilt. Building M6 as written would add deferred surface while the MVP is incomplete.
- **This is the third instance of the same trap** — PDL-029 (board views) and PDL-031 (assistant depth) corrected the same pre-freeze roadmap. The roadmap line is the thing that keeps being wrong.
- **The milestone is mostly UI, by luck of good schema:** `tags`/`item_tags` (with the `0003` composite FKs), `orgs_update` (`is_org_admin`), and `saved_views` (owner-private) **already exist and are correctly hardened** — four of the five need **no migration**. Only reminder surfacing proposes one, and only to make an existing column reachable.
- **The real bug it fixes:** `items.remind_at` is **queried nowhere** — the `due` window resolves `due_at` only. A reminder captured by the AI ("remind me tomorrow", `remind_at` set, `due_at` null) surfaces in **no view** once triaged out of the Inbox. PDL-011 requires reminders to work in the Today/Due views; they never have.
- **Alternatives:** (a) Build M6 as written — rejected: needs a PDL to pull Future/Good-to-Have scope into MVP, while Must Haves are missing. (b) Skip to M8 Hardening — rejected: hardening an incomplete MVP. (c) Do only the reminder bug — rejected: the other four are Must Haves and Gate A needs no migrations.
- **Trade-offs:** the roadmap's M6/M7 numbering no longer matches the plan table; §8 is annotated. Comments remain unbuilt, so the PDL-036 Activity feed stays read-only, and **TD-009** (field edits unaudited) stays open — ruled 2026-07-16.
- **Reminder mechanism (D3, decided):** `nudge_at` = `least(due_at, remind_at)`, a stored **generated** column (migration `0017`), indexed. `least()` ignores NULLs, so a reminder-only item surfaces on its `remind_at`, and an item with both surfaces on the **earlier** of the two — `coalesce` was rejected because due-wins would let a Friday due date hide a Tuesday reminder. Today/Upcoming and the `due_asc` sort resolve against it. This is the fix for the bug this milestone exists to catch: `remind_at` had been written but never read.
- **Status:** Accepted (ruled by Palash, 2026-07-16). **COMPLETE — both gates signed off (Gate A 2026-07-16, Gate B 2026-07-17).**

### PDL-037 — The `captured` state is displayed as "To Do", not "Inbox" (2026-07-16)
- **Decision:** The `captured` lifecycle state **displays as "To Do"**. The **Inbox view keeps its name** in the rail, and "Inbox (no list)" remains how an unfiled item's *location* is described. The `captured` **enum value is unchanged** — this is a display-label change only, in `itemStateLabel()`.
- **Amends the frozen package:** Doc 5 `:63` ("lifecycle state: Captured(Inbox) → …"), Doc 5 `:196` and the ERD `:135` (`item_state: captured (Inbox)`) all name this state "Inbox". Doc 5 §2a is titled *"'Inbox' is a state, not a container"*. Those docs are **locked (2026-07-11)**; this is recorded as an explicit amendment ruled by Palash, not a silent deviation.
- **Why:** Doc 5 §2a was making a *modelling* argument — Inbox is a state, not a hierarchy level — and it won that argument; the model is unchanged. But it then reused the word as the **user-facing label**, while the rail also ships an **Inbox view**. So one word did double duty: a Status column reading "Inbox" looks like it is naming *where the item is*, next to a rail entry named Inbox. Palash read the Status column as showing location rather than state — which is exactly the failure the collision predicts. "To Do" names the state without borrowing the view's word.
- **The data was never wrong:** the Status column always rendered `item.state`. Verified live — three items in the same location ("No list") correctly showed three different statuses. This is a naming fix, not a data fix.
- **Alternatives:** (a) Keep "Inbox" — rejected: preserves the collision. (b) Rename the *view* instead — rejected: "Inbox" is the right name for the capture destination, and PDL-016 builds the whole Daily Review around that word. (c) "Captured"/"New"/"Unsorted" — rejected: "Captured" is the raw enum (PDL-027 forbids it as a label); "To Do" is what Palash asked for and is the term users already know.
- **Trade-offs:** Doc 5 and the ERD now carry a display label that differs from their prose; both are annotated to point here. The one-word-two-meanings ambiguity is removed at the point it actually bit.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-036 — Task detail side-panel; `time_estimate_minutes` promoted to a real field (2026-07-16)
- **Decision:** Replace the in-row expand (PDL-034) with a **task detail side-panel** that slides in from the right when a task's name is clicked. It does not navigate away — the list stays mounted behind it, and Escape / the close button / clicking the scrim all dismiss it. Contents: inline-editable **title**; a quick-field row (**Status** + a complete checkmark, **Dates** start → due, **Priority**, **Time estimate**, **List**); a **description** box mapped to the existing `items.body`; a **Fields** section holding the existing Checklist and Definition of Done; and a read-only **Activity** feed rendering the existing `activity_events` audit trail. The table row keeps only the four scannable columns — **Name · Assignee · Priority · Due date · Status** — with Assignee reduced to an **avatar only**; **Start moves off the row into the panel**. `time_estimate_minutes` — previously earmarked *Future* alongside `start_at` — becomes a real nullable column (migration `0016`).
- **Why:** The row-expand could only ever hold a fragment of an item, and it pushed the table around when opened. A panel gives the item a real surface without leaving the list, which is what makes a dense table usable: the row stays scannable precisely *because* the depth lives elsewhere. Every locked behaviour is preserved — the panel writes through the same hooks as the row, so `writable_item_ids`/RLS still gate every edit (no editor is offered that the DB would refuse), the `state` enum stays behind human labels (PDL-027), lateness stays neutral (no red "overdue"), and capture stays zero-click. This is UI only.
- **Time estimate is an estimate, not tracking:** a *planned* duration, entered as "2h 30m". It does not measure elapsed time — time **tracking** remains rejected. Not applicable to a Note (DB-enforced, `chk_estimate_not_note`).
- **Activity is read-only:** comment-writing is **deferred**, not built. The feed can only show what the DB triggers actually log — the `activity_event_type` enum has events for creation, state changes, completion, list moves, responsibility and tags, but **none for field edits**, so changing priority/dates/title/description does *not* appear in Activity. Pre-existing (the trigger never logged them); recorded as **TD-009** rather than silently widening the audit schema.
- **Alternatives:** (a) Keep the row-expand — rejected: too small for description + checklist + DoD + responsibility + activity, and it displaced the table. (b) A full-page task route — rejected: navigating away from the list is exactly what the panel avoids. (c) Drop Time estimate rather than add the column — rejected: the design already anticipated an estimate/effort field, same as `start_at` in PDL-034.
- **Trade-offs:** The panel is desktop-first (FR-20) — the Activity column hides below `lg`. Free-text fields (title, description, estimate) save on **blur** and are deliberately not disabled while other saves are in flight, since disabling them mid-typing silently drops keystrokes.
- **Status:** Accepted (built 2026-07-16; awaiting Palash's sign-off)

### PDL-035 — Full container hierarchy: Project → Folder → List (2026-07-16)
- **Decision:** Corrects **PDL-032**. The container hierarchy is `Organization (= "Workspace") → Project → Folder → List → Item`, the full ClickUp-style nesting. PDL-032 collapsed Project into List (renamed `projects` → `lists`) **on my recommendation to avoid "three groupings" — that was a misread of the requirement.** So: add a `projects` table (org-level), re-parent Folder under Project (`folders.project_id`), and give List a project directly (`lists.project_id`). A List may sit inside a Folder **or** straight under a Project ("folderless lists"). Subtasks are explicitly **skipped** for now.
- **Optional at every level (unchanged, PDL-005/PDL-032):** capture stays **zero-click** — a task needs no List and lands in the Inbox; a List needs no Folder. Filing (into Project/Folder/List) happens later, in Daily Review or manually. Filing is **never** mandatory at capture.
- **Why:** Palash (Product Architect and first real user) needs the full nesting for how he actually organises work. The earlier simplification was mine, not his; this restores what he asked for. What PDL-006/PDL-032 got right is preserved — the friction is *forced* filing, and nothing here forces it.
- **Difference that was being conflated:** a **List** is a container that holds Tasks; a **Checklist** is tickable sub-steps *inside one Task*. Different concepts — the UI now keeps them in clearly separate, labelled sections.
- **Alternatives:** (a) Keep the two-level Folder → List — rejected by Palash. (b) Nest deeper than Project → Folder → List — out of scope. (c) Mandatory filing at capture — rejected: breaks zero-click capture / the AI Inbox premise.
- **Trade-offs:** three container levels reintroduce the emergent-complexity risk PDL-006 named; mitigated by all of it being optional and the Inbox/Daily Review staying the default path. Existing folders/lists were backfilled under one "General" project per org.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-034 — Dense table layout; `start_at` promoted to a real field (2026-07-16)
- **Decision:** Replace the spaced item-card layout with a **dense, table-style row layout** (rows + columns: Assignee, Priority, Start, Due, Status), applied to **every** view (they all share one presentation). Columns for Priority, Start, and Due are **editable inline in the row**; heavier editors (checklist, DoD, full responsibility) live behind a **row-expand**. Items group into **collapsible sections with counts** (e.g. by List). `start_at` — previously earmarked *Future* — becomes a real nullable column so the Start column uses an actual field.
- **Why:** Palash's own use wants a scannable, ClickUp-style dense view with far less blank space; the frozen package prescribes **no layout** (it uses "card" only descriptively and locks *behaviours*, not density). A table keeps every locked behaviour: status/complete are still one action from the row, responsibility is still glanceable, the `state` enum stays hidden behind human labels (PDL-027), lateness stays neutral (no red "overdue", Doc 4), and the Assignee column is team-only (PDL-022).
- **Alternatives:** (a) Table only for the List view — rejected: there is no separate list-view component; all views share `ItemList`, so one presentation is less code and consistent. (b) Keep cards as a toggle — deferred; revisit if the density is ever too tight. (c) Drop the Start column instead of adding `start_at` — rejected: the design already anticipated the field.
- **Trade-offs:** A wide table is desktop-first (FR-20); narrow screens scroll horizontally / hide columns. The Assignee column needs a **batched** fetch (`item_assignee_summary`) rather than the per-row responsibility query, or it would be N round trips.
- **Status:** Accepted (ruled by Palash, 2026-07-16)

### PDL-030 — Daily Review and Search ship in M3 (2026-07-16)
- **Decision:** The **Daily Review** (triage) and **Search** are both in scope for **M3 — Workspace UI**, though the roadmap line mentions neither.
- **Why:** PDL-016 makes Daily Review the *only* way items leave the Inbox. M4 shipped capture, so without it the Inbox is a one-way door — items go in and nothing comes out; M3 would deliver an Inbox that cannot be emptied. Search is Must-Have (Doc 4) and sits in the frozen rail; Doc 5 (`:170-172`) makes views+search the substitute for hierarchy navigation, so the navigation model is incomplete without it. The `items.search` tsvector already ships (migration `0002`).
- **Alternatives:** Daily Review as its own later milestone (rejected — leaves the Inbox unusable in the interim); Search deferred (rejected — delivers the rail only partly).
- **Trade-offs:** M3 is a larger milestone than its one-line roadmap summary implies.
- **Status:** Accepted (ruled by Palash, 2026-07-16)
