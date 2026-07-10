# Alp-Viram

An **AI-powered project management platform**. Not another ClickUp — the goal is
to *reduce the effort* required to capture, organize, and execute work. It should
feel like a personal AI assistant, not task-management software.

Core idea: **Capture first. Organize later. Execute naturally.**

See the [Product Design Package](docs/product/README.md) for the frozen product
spec (PRD, decision log, user journey, feature catalogue, information
architecture), and [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) for the
architecture and milestone roadmap.

## Tech stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Server state:** TanStack Query · **UI state:** Zustand
- **Animation:** Framer Motion · **Forms/validation:** React Hook Form + Zod
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI:** provider-agnostic abstraction (OpenAI / Anthropic / Gemini pluggable)
- **Testing:** Vitest + Testing Library

## Getting started

```bash
npm install            # install dependencies
cp .env.example .env   # then fill in Supabase values (Milestone 1+)
npm run dev            # start the dev server
```

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the Vite dev server             |
| `npm run build`     | Type-check and build for production   |
| `npm run preview`   | Preview the production build          |
| `npm run test`      | Run tests (watch mode)                |
| `npm run test:run`  | Run tests once                        |
| `npm run lint`      | Lint with oxlint                      |
| `npm run typecheck` | Type-check without emitting           |
| `npm run format`    | Format with Prettier                  |

## Project structure

```
src/
├─ app/          app shell, routing, global providers
├─ config/       validated environment configuration
├─ core/         shared types, errors, logger, Result helper
├─ lib/          supabase client, AI provider abstraction, utils
├─ modules/      feature modules (see src/modules/README.md)
├─ components/   shared UI (theme, ui primitives, layout)
└─ styles/       global styles + design tokens
```

## Branch strategy

| Branch        | Purpose                                          |
| ------------- | ------------------------------------------------ |
| `Development` | Active development. Day-to-day work lands here.  |
| `Test`        | QA / staging. Stabilized builds for testing.     |
| `Production`  | Release-ready code.                              |

Typical flow: `Development` → `Test` → `Production`.
