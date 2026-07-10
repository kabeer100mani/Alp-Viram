# Alp-Viram — Project Plan (for review)

> Status: **DRAFT — awaiting your approval.** Nothing is built yet.
> Author: Lead Engineer (Claude). Language kept simple on purpose.

---

## 1. What we are building

Alp-Viram is a web-based **AI-powered project management platform**.

It is **not** a ClickUp clone. ClickUp is only a look-and-feel reference.

The core idea in one line:

> The user should spend the least time managing the software.
> The software should spend the most effort helping the user.

It should feel like a **personal AI assistant**, not a task tool.

**Users:** small/medium businesses, software teams, finance teams, ERP
implementation teams, consulting firms. The app is **multi-organization and
multi-user** from day one.

---

## 2. Guiding principles (how we will work)

- Ship in **milestones**. One milestone finished and tested before the next starts.
- **Business logic is separate from UI.** UI never talks to the database directly.
- **AI is separate from business logic.** Providers (OpenAI / Anthropic / Gemini)
  are swappable without touching features.
- **Security first.** Multi-tenant isolation is proven before features are added.
- **No hardcoded config.** Everything configurable lives in one place.
- Every screen must answer: *"can this be done in fewer clicks?"*

---

## 3. The risks I want us to respect (and how we handle them)

**R1 — Tenant data leaks (highest risk).**
Many companies share one database. One wrong security rule = Company A sees
Company B's data. That kills a SaaS. → We build and **test the tenant +
permission model first** (Milestone 1), using Postgres Row Level Security (RLS).

**R2 — "Feels like an assistant" is a feeling, not a feature.**
We cannot build a feeling. We pick **2–3 concrete AI actions** that create it,
and build one really well in the MVP. (See Open Decision D4.)

**R3 — Stolen AI keys.**
React runs on the user's device. Calling AI providers from the browser leaks
your keys instantly. → **All AI runs server-side** in Supabase Edge Functions.

**R4 — Logic leaking into the UI.**
Simple reads/writes live in Postgres + RLS. Anything privileged (inviting users,
billing, AI, admin) lives in **Edge Functions** with the service key. We draw
that line clearly.

**R5 — Scope explosion.**
Five very different user types. → MVP builds **one generic core** (orgs,
projects, tasks, people, assistant) that all of them share. No per-industry
features until real users ask.

---

## 4. Recommended technology (your stack + my additions)

Your stack is kept. These additions make it production-grade.

| Area | Choice | Why |
| --- | --- | --- |
| Language / UI | React + TypeScript + Tailwind | Your choice. Strong typing everywhere. |
| Build tool | **Vite (SPA)** | App is behind login; no SEO need. Faster + simpler than Next.js. |
| UI components | **shadcn/ui** (Radix + Tailwind) | Premium, accessible, you own the code. Restyle freely. |
| Server data | **TanStack Query** | Caching + retries = the "fast / few clicks" feel, less code. |
| UI state | **Zustand** | Tiny store for the bits Query doesn't cover. |
| Animation | **Framer Motion** | Smooth animations, done properly. |
| Forms + validation | **React Hook Form + Zod** | Zod also validates AI input/output — one validation language. |
| Backend / DB | **Supabase + PostgreSQL** | Your choice. Auth, storage, RLS, Edge Functions in one. |
| Server logic / AI | **Supabase Edge Functions** | Safe home for AI + privileged operations. |
| Testing | **Vitest + Testing Library + Playwright** | Unit + end-to-end so "done" means done. |
| Quality | **ESLint + Prettier + TypeScript strict** | Enforced clean code. |

---

## 5. Architecture at a glance

Four clear layers. Each only talks to the one below it.

```
┌─────────────────────────────────────────────┐
│  UI layer        React components, screens    │  ← looks only, no logic
├─────────────────────────────────────────────┤
│  Application     hooks + services (use-cases) │  ← business logic, framework-free
├─────────────────────────────────────────────┤
│  Data layer      repositories (Supabase)      │  ← the ONLY place that queries DB
├─────────────────────────────────────────────┤
│  Platform        Supabase (Auth/DB/Storage),  │
│                  Edge Functions, AI providers │
└─────────────────────────────────────────────┘
```

- UI never imports Supabase. It calls hooks/services.
- Services never know about React. They can be tested alone.
- Only the data layer touches the database.
- AI lives behind an interface; the concrete provider is an adapter.

### Proposed folder structure

```
Alp-Viram/
├─ docs/                       # this plan and future design docs
├─ public/
├─ supabase/
│  ├─ migrations/              # database schema + RLS (versioned SQL)
│  └─ functions/               # edge functions (ai, privileged ops)
├─ src/
│  ├─ app/                     # app shell, routing, global providers
│  ├─ config/                  # env + app config (NO hardcoded values)
│  ├─ core/                    # shared types, errors, logger, Result helper
│  ├─ lib/
│  │  ├─ supabase/             # typed Supabase client
│  │  └─ ai/                   # AI provider interface + adapters
│  ├─ modules/                 # one folder per feature (clean architecture)
│  │  ├─ auth/
│  │  ├─ organizations/
│  │  ├─ projects/
│  │  ├─ tasks/
│  │  └─ assistant/
│  │     ├─ components/        # UI only
│  │     ├─ hooks/             # React glue
│  │     ├─ services/          # business logic (no React, no Supabase import)
│  │     ├─ data/              # repository: the only DB access
│  │     └─ types.ts
│  ├─ components/              # shared UI built on shadcn/ui
│  ├─ styles/
│  └─ main.tsx
├─ tests/                      # e2e (Playwright); unit tests co-located
└─ .env.example                # documents every required variable
```

Every module follows the same shape (`components / hooks / services / data /
types`). This is what makes each module **independently extensible**.

---

## 6. Security & multi-tenant model (summary — full build in M1)

- Every business table carries an `organization_id`.
- **RLS policies** ensure a user only ever sees rows for organizations they
  belong to. Enforced by the database, not the app — so a UI bug can't leak data.
- Roles per organization (e.g. Owner / Admin / Member) drive what actions are allowed.
- Privileged actions (invite user, change roles, billing, AI) run in Edge
  Functions, never from the browser.
- Secrets (service key, AI keys) live only on the server.

We will **write tests that try to break isolation** before moving on from M1.

---

## 7. AI architecture (summary — full build in M4)

- One interface, e.g. `AIProvider`, with methods like `complete()` /
  `structuredOutput()`.
- Adapters implement it: `AnthropicProvider`, `OpenAIProvider`, `GeminiProvider`.
- Business code depends on the **interface only** — swapping providers is a
  one-line config change.
- All calls run inside an Edge Function so keys stay secret.
- Zod schemas validate what the AI returns before we trust it.

---

## 8. Milestone roadmap

Full detail is given for **M0** (next step). Later milestones are summarized;
each will be fully specced when we reach it.

| # | Milestone | Objective |
| --- | --- | --- |
| **M0** | Foundation | Rock-solid base: tooling, config, structure, themed app shell. No features. |
| **M1** | Identity & tenancy | Auth, organizations, memberships, roles, **RLS**, protected routes, org switcher. |
| **M2** | Core domain | Projects & tasks data model + secure CRUD through the data layer. |
| **M3** | Workspace UI | List + board views, minimal-click task actions, dark/light mode polish. |
| **M4** | AI layer | Pluggable provider abstraction + first assistant action via Edge Functions. |
| **M5** | Assistant depth | "Ask your workspace" queries, smart suggestions. |
| **M6** | Collaboration | Comments, assignments, realtime updates. |
| **M7** | Files & notifications | Supabase Storage, attachments, notifications. |
| **M8** | Hardening | Security review, logging, performance, deployment. |

---

## 9. Milestone 0 — Foundation (full spec)

**Objective:** a production-grade, empty-but-solid app you can run, with theme
switching and the folder structure in place. No product features yet. This is
the base everything else is built on.

**Features**
- Vite + React + TypeScript (strict) project.
- Tailwind CSS + shadcn/ui set up.
- Dark / light theme with a working toggle.
- Central config module that reads environment variables (no hardcoding).
- Typed Supabase client (not yet used for features).
- ESLint + Prettier + strict TypeScript enforced.
- One smoke test proving the test setup works.
- The full folder structure from section 5, with placeholder files.

**Files to create (key ones)**
- `package.json`, `tsconfig.json`, `vite.config.ts`
- `tailwind.config.ts`, `postcss.config.js`, `src/styles/globals.css`
- `.eslintrc.cjs`, `.prettierrc`, `.env.example`
- `src/main.tsx`, `src/app/App.tsx`, `src/app/providers.tsx`
- `src/config/env.ts` (validates env vars with Zod)
- `src/core/logger.ts`, `src/core/result.ts`, `src/core/errors.ts`
- `src/lib/supabase/client.ts`
- `src/components/theme/ThemeToggle.tsx`
- Updated `.gitignore` (Node/Vite/env) and `README.md`

**Folder structure:** as in section 5.

**Dependencies**
- Runtime: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`,
  `zustand`, `framer-motion`, `react-hook-form`, `zod`,
  `@supabase/supabase-js`, `clsx`, `tailwind-merge`.
- Dev: `vite`, `typescript`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`,
  `autoprefixer`, `eslint` (+ plugins), `prettier`, `vitest`,
  `@testing-library/react`, `@playwright/test`.
- shadcn/ui added via its CLI.

**Commands (high level — exact list provided when we start)**
```
npm create vite@latest . -- --template react-ts
npm install <runtime deps>
npm install -D <dev deps>
npx tailwindcss init -p
npx shadcn@latest init
npm run dev        # start
npm run lint       # check quality
npm run test       # run smoke test
```

**Testing procedure**
1. `npm run dev` → app opens with no console errors.
2. Toggle theme → switches dark/light, preference remembered.
3. `npm run lint` → passes with zero errors.
4. `npm run test` → the smoke test passes.
5. `npm run build` → builds with no type errors.

**Expected output**
A clean, themed app shell (empty dashboard placeholder), dark/light toggle
working, all quality checks green, folder structure ready for M1. Committed to
the `Development` branch.

---

## 10. Definition of "done" for every milestone

A milestone is done only when:
1. Features work as described.
2. `lint`, `test`, and `build` all pass.
3. The testing procedure has been run and observed.
4. Code is committed to `Development` with a clear message.
5. Any new decisions are recorded.

---

## 11. Open decisions — I need your answers to start M0

**D1 — Build tool.** I recommend **Vite (SPA)** (app is behind login, no SEO
need). Choose Next.js instead only if you expect public marketing pages / SSR
soon. → *Your call:*

**D2 — Supabase during development.** Options:
(a) **Hosted cloud** project (simplest, no Docker),
(b) **Local Supabase via Docker** (best for safe migrations, needs Docker Desktop),
(c) **You don't have Supabase yet** (I'll guide account + project setup in M1).
→ *Your call:*

**D3 — First AI provider** (the layer stays swappable regardless):
Anthropic (Claude) / OpenAI / Gemini / decide later. My lean: **Anthropic** for
structured assistant actions, but "decide later" is fine since it's swappable.
→ *Your call:*

**D4 — First assistant feature to make magical** (pick ONE for the MVP):
(a) **Natural-language task creation** — type a sentence, get a structured task
    (best "fewer clicks" payoff — my recommendation),
(b) **Ask-your-workspace** — plain-English questions about your data,
(c) **Smart daily digest** — what needs attention today,
(d) **Auto-organize / triage** — AI sorts and prioritizes incoming work.
→ *Your call:*

---

*Once you approve this plan and answer D1–D4, I will produce the exact command
list and file contents for Milestone 0 and we build it — nothing further until
M0 is tested and committed.*

---

# Addendum — Approved decisions & product direction (2026-07-10)

Plan **approved**. The following are now locked and override earlier assumptions.

## Locked decisions
- **D1 — Vite (SPA).** Login-based app, no SEO.
- **D2 — Hosted Supabase Cloud.** Simple, fast, easy to collaborate.
- **D3 — Provider-agnostic AI.** No coupling to any provider. Abstraction layer;
  use whichever provider is easiest during development.
- **D4 — First AI feature is the AI Inbox (Universal Capture)** — replaces the
  earlier "natural-language task creation."

## Product direction (guardrail)
Reduce the effort to **capture, organize, and manage** work. Every feature must
answer: **"does this reduce user effort?"** If not, it gets challenged before build.

## AI philosophy (guardrail)
The AI is an **assistant, not an autopilot**. The user always makes the final
decision. AI may reduce typing/clicks, organize, suggest, and remember context —
but it **never auto-executes actions without user confirmation.**

## The AI Inbox (Universal Capture) — feature definition
One chat box is the front door. The user writes or speaks naturally, e.g.
"Tomorrow discuss invoice issue with Infosys", "Remind me to review July MIS",
"Aman will complete hosting reconciliation", "Follow up with TCS".

The AI classifies each input into one of: **Task, Reminder, Meeting, Note,
Follow-up, Question.** If required info is missing, it asks the **minimum**
questions. Then it proposes a structured item; the **user confirms** before it
is saved.

Engineering notes:
- The type list is **config-driven**, not hardcoded — adding a type later is trivial.
- **"Question"** is not stored work; it routes to an "ask your workspace" answer.
- **Voice** ("speaks") is deferred — text first in MVP, voice via Web Speech later.
- Every AI output is validated with **Zod** before we trust or save it.

## Data model — my recommendation (needs your approval before M2)

You asked me to check whether ClickUp's `Workspace → Project → Folder → List →
Task` is right. **My recommendation: drop Folder and List.** Use:

```
Organization (tenant)
   └─ Project            (OPTIONAL, single grouping level)
         └─ Item         (the unit of work)

Item.type ∈ { task, reminder, meeting, note, follow_up }   (extensible)
Tags        flat labels, many-to-many  (cross-cutting organization)
Views       saved filters ("My day", "Overdue", "By project", …)
```

Key point: **items can exist without a project** — a "loose" capture that lives
in the Inbox until organized.

**Why this is better for *our* product:**
1. **Fewer decisions = fewer clicks.** Deep hierarchy forces "which space /
   folder / list?" on every capture. Our thesis is the opposite: capture first,
   let AI suggest placement, user confirms.
2. **The Inbox produces loose items** with no home yet. A rigid hierarchy fights
   this; a flat item store embraces it.
3. **One unified Item table** maps cleanly to the Inbox's six types (via a
   `type` field), instead of five separate subsystems. Simpler + extensible.
4. **Tags + saved views** give all the power of folders/lists without nesting,
   and they are multi-dimensional (an item can be `#finance` *and* `#infosys`).
5. **Fits all user types** (finance, ERP, consulting) because "item + tags +
   views" is generic — teams shape it with tags/views, not schema changes.

**Trade-off / when hierarchy would help:** very large orgs wanting strict
departmental separation sometimes want a "Space" level. We can add an *optional*
second grouping level later **if real demand appears** — not in MVP. Tenant
isolation is by `organization_id` via RLS regardless.

## Revised milestone note
- **M2 "Core domain" is redefined** as the **unified Item model** (task /
  reminder / meeting / note / follow-up) with tags and views — not just
  projects & tasks.
- The AI Inbox (M4) classifies natural language into these Items.

## Milestone reporting (per your process)
At the end of **every** milestone I will provide: what was completed,
screenshots, folder-structure changes, database changes, pending risks, and
recommendations before proceeding. No next milestone starts until the current
one is completed, tested, and **you approve**.

