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
