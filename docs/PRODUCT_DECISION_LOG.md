# Product Decision Log (PDL)

A living record of major product and engineering decisions. Every entry has:
**Decision · Reason · Alternatives Considered · Date · Status.**

Status legend: `Accepted` · `Superseded` · `Proposed` · `Revisit`.

---

## PDL-001 — Build tool: Vite (SPA)
- **Decision:** Use Vite as a single-page app.
- **Reason:** The app lives behind login; SEO/SSR are not needed. Vite is faster and simpler.
- **Alternatives Considered:** Next.js (rejected for now — added complexity, benefits us only if we later need public marketing/SEO pages).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-002 — Backend: Supabase (hosted cloud)
- **Decision:** Use hosted Supabase Cloud for Postgres, Auth, Storage, Edge Functions.
- **Reason:** Simple setup, fast development, easy collaboration; one platform for DB/auth/storage/serverless.
- **Alternatives Considered:** Local Supabase via Docker (more setup); custom Node backend (more to build/operate).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-003 — AI is provider-agnostic
- **Decision:** Business logic depends only on an `AIProvider` interface; concrete providers are adapters.
- **Reason:** Avoid vendor lock-in; swap OpenAI/Anthropic/Gemini/future without touching features.
- **Alternatives Considered:** Coupling directly to one SDK (rejected — lock-in, harder to compare providers).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-004 — AI runs server-side only
- **Decision:** All AI calls go through Supabase Edge Functions, never the browser.
- **Reason:** Provider API keys must never reach the client. Also a clean AI/business-logic boundary.
- **Alternatives Considered:** Client-side AI calls (rejected — leaks keys immediately).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-005 — Core workflow: Capture First, Organize Later, Execute Naturally
- **Decision:** Users never have to choose Project/Folder/List/Priority/Labels at capture time.
- **Reason:** Reduce effort. Organizing decisions can happen later, with AI help.
- **Alternatives Considered:** Traditional up-front filing (rejected — high friction, the problem we're solving).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-006 — Data model: drop Folder and List
- **Decision:** `Organization → (optional) Project → Item`. No Folder, no List.
- **Reason:** Deep hierarchy forces decisions and clicks. A flat item store fits capture-first and the Inbox.
- **Alternatives Considered:** ClickUp's `Workspace → Space → Folder → List → Task` (rejected — too much nesting/friction).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-007 — Unified Item model with six types
- **Decision:** One `Item` entity with a `type`: Task, Reminder, Meeting, Follow-up, Note, Knowledge/Discussion. Config-driven.
- **Reason:** The Inbox classifies natural language into these; one table + a type is simpler and extensible than separate subsystems.
- **Alternatives Considered:** Separate tables per type (rejected — duplication, harder to query/extend).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-008 — Items can exist without a Project (Inbox)
- **Decision:** A Project is optional; unorganized Items live in the Inbox.
- **Reason:** Capture-first naturally produces items with no home yet.
- **Alternatives Considered:** Mandatory project on every item (rejected — reintroduces capture friction).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-009 — Role-based Responsibility Model (core differentiator)
- **Decision:** Each Item has a **Responsible Role** (mandatory), an optional **Current Owner**, and optional **Collaborators**.
  Responsibility belongs to the Role; execution belongs to the Current Owner. Replacing a user in a role transfers
  operational ownership where appropriate; historical activity is immutable.
- **Reason:** People change; business ownership shouldn't. Roles keep responsibility stable across staff changes.
- **Alternatives Considered:** Traditional per-individual assignment (rejected — breaks when people leave/switch;
  loses institutional responsibility).
- **Open questions (to resolve in M2):** exact meaning of "replacing a user in a role" (removed from org vs removed
  from role?); which items auto-transfer (all where they are Current Owner? only active/incomplete?); how the
  immutable activity log records the transfer.
- **Date:** 2026-07-10
- **Status:** Accepted (design details Proposed)

## PDL-010 — Organize via Tags and Saved Views, not hierarchy
- **Decision:** Use flat Tags and Saved Views (e.g. My Day, Overdue, Waiting for Client) instead of nested folders/lists.
- **Reason:** Multi-dimensional, low-friction organization; an item can be `#finance` and `#infosys` at once.
- **Alternatives Considered:** Nested folders/lists (rejected — single-dimensional, high friction).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-011 — Voice deferred; text-first MVP
- **Decision:** MVP ships text capture. Architit so voice plugs in later without redesign.
- **Reason:** Voice adds real complexity (permissions, accuracy, mobile). Text delivers the same "fewer clicks" now.
- **Alternatives Considered:** Voice in MVP (rejected for scope/risk).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-012 — AI never performs irreversible actions without confirmation
- **Decision:** AI suggests and drafts; the user confirms. No silent, irreversible automation.
- **Reason:** The user must stay in control. Trust is built on predictability.
- **Alternatives Considered:** Full autonomy/auto-execute (rejected — removes user control).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-013 — Multi-tenant isolation via Postgres RLS
- **Decision:** Every business row carries `organization_id`; Row Level Security enforces isolation in the database.
- **Reason:** A UI bug must never be able to leak another org's data. The DB is the last line of defense.
- **Alternatives Considered:** App-layer-only checks (rejected — one missed check = data leak).
- **Date:** 2026-07-10
- **Status:** Accepted

## PDL-014 — Frontend stack additions
- **Decision:** shadcn/ui-style primitives (Tailwind v4 + CVA), TanStack Query, Zustand, Framer Motion, React Hook Form + Zod, Vitest + Playwright.
- **Reason:** Production-grade, accessible UI; caching for a fast feel; one validation language (Zod) for forms and AI output.
- **Alternatives Considered:** Heavier component libraries (MUI/AntD — less control over the premium look).
- **Date:** 2026-07-10
- **Status:** Accepted
