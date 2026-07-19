# M8 — Navigation Restructure, Responsive Shell & Field Customization

> Spec for the tabs/navigation restructure + mobile responsiveness + user-customizable
> status/priority labels & colors. Approved by Palash 2026-07-19 (decisions below).
> Report-first, gated build (A → B → C), stop at each gate for review.

## Why

1. **The app is not mobile-responsive** (verified 2026-07-19): the viewport meta tag
   is present, but the layout is desktop-only — a fixed 208px sidebar always beside
   the content, a header whose buttons run off-screen on a phone, and a
   `min-w-[42rem]` table that clips. Only 4/50 components use any breakpoint.
2. **The top-level IA needs more than an intent rail.** Adding People / Projects /
   Settings / Statuses as peers of the item-views doesn't fit a single flat rail.
3. **Doc 5 §5 already anticipated mobile:** *"Mobile is Future; the same views
   collapse into a bottom nav later."* This milestone implements that.

## Decisions (Palash)
- **Five sections:** Capture · Projects · People · Settings · **Statuses**.
- **Scope = both** the responsive nav shell **and** the content-level mobile pass, as
  one piece (the shell is being rebuilt anyway).
- **Capture = a global floating "+"** opening a capture sheet from any section (not a
  pinned box in one tab).
- **"Statuses" tab** = customize status **and** priority **labels + colors** (a
  settings-style editor of your own values) — **not** a work dashboard, **not** the
  future auto-status vision.
- **Daily Review** = a prominent action inside **Capture**.
- **Gate order A → B → C**, one milestone (**M8**).

## The five sections — mapping from today's screens

| Section | Contains | Change |
| --- | --- | --- |
| **Capture** (default route) | Item **views** (Inbox · Today · Upcoming · Aging · Waiting · Snoozed · Done · By Role), **Search**, **Daily Review**. Views/Search stay as *secondary* nav inside Capture. | Views move under Capture (were the top level) |
| **Projects** | Projects → Folders → Lists tree (`ListTreeNav`) | Promoted to its own section |
| **People** | `PeopleScreen` (members, roles, invites, offboarding) | Direct move |
| **Settings** | Workspace rename + switch (`OrgBar`) + delete (today in People's danger-zone) + (later) theme | New shell consolidating scattered controls |
| **Statuses** | Customize status + priority labels & colors, per org | New feature (Gate C) |

## Responsive nav shell — one structure, two renderings

- One `sections` config (icon, label, route) drives both chrome variants.
- **Desktop (≥768px):** left **sidebar** of the 5 sections; secondary nav (Capture's
  views; Projects tree) in a sub-panel.
- **Mobile (<768px):** **bottom tab bar** of the 5 section icons; secondary nav becomes
  a slide-in drawer/sheet.
- **Sections are real routes** (`/capture`, `/projects`, `/people`, `/settings`,
  `/statuses`). `BrowserRouter` + Vercel SPA rewrites already support deep links.
  `AppShell` renders `<SidebarNav>` or `<BottomTabBar>` by breakpoint over the same routes.

## Content-level mobile fixes (Gate B)

- **Dense table → single-column card list below `md`:** each row → a card (name +
  status pill + assignee + due), tap opens the existing `TaskPanel`. Desktop keeps the
  grid. (Today the grid scrolls sideways and clips columns.)
- **Header reflow:** the overflowing action row is re-homed — Daily Review → Capture,
  Invite → People, Sign out → Settings, workspace name/switch → Settings.

## Floating "+" capture (Gate A)

- A global **"+"** (floating FAB on mobile; top-bar "+"/⌘K on desktop) opens the
  existing `AiCaptureBox` in a **Sheet**, from **all five sections**. Replaces the pinned
  inline capture box. Honors Doc 5's "quick capture one keystroke from anywhere".

## Conflicts with the locked design docs (Doc 5)

| # | Doc 5 | This milestone | Verdict |
| --- | --- | --- | --- |
| 1 | §5: "the same views collapse into a **bottom nav** later" | bottom bar on mobile | ✅ Implements the frozen plan |
| 2 | §8: "Navigation is **by view/intent**, not by tree" (flat rail) | 5 top-level **sections**, intent-views nested under Capture | ⚠️ **Amendment — PDL-048.** Intent-nav preserved *inside* Capture |
| 3 | §5: Quick capture in the **top bar** | global floating **"+"** | ⚠️ Minor amendment (PDL-048) — same principle, new placement |
| 4 | No Settings surface | dedicated **Settings** section | ➕ Additive consolidation |
| 5 | Frozen §2 fixes status/priority colors; enums frozen | user-**customizable** labels+colors | ⚠️ **Additive + constrained — PDL-049.** §2 values become defaults; **relabel/recolor only**, cannot add/remove statuses (enums frozen; view engine + completion key off enum values) |

## Gates

### Gate A — Responsive navigation shell
- Sections as routes; `SidebarNav` (desktop) ⇆ `BottomTabBar` (mobile) over one config.
- Re-home existing screens into sections (nav wiring; minimal content change). Capture
  keeps its views/Search sub-nav (desktop sub-panel; mobile drawer). Daily Review is a
  prominent action in Capture.
- Global "+" capture Sheet, reachable from every section.
- **Done when:** all sections navigable on desktop **and** phone; capture reachable
  everywhere. Content within sections may still be desktop-styled (reflow is Gate B).
- **Verify:** desktop + 390px browser walkthroughs (nav works, bottom bar on phone, "+"
  opens the capture sheet, each section renders) + screenshots; unit tests; typecheck/lint.

### Gate B — Content mobile reflow
- Table → card/list below `md`; header reflow; remove the pinned capture box (→ "+").
- **Done when:** at 390px there is **no horizontal page scroll, nothing clipped**, every
  view usable one-handed.
- **Verify:** mobile walkthrough asserting `scrollWidth == innerWidth`, no clipped rows,
  TaskPanel opens from a card; desktop unaffected; screenshots.

### Gate C — Statuses: status/priority customization
- **Data:** per-org label+color overrides for the 6 statuses & 5 priorities. Store as
  JSONB on `organizations` (admin-only, mirrors `orgs_update`) — migration `0025`.
- **UI:** the Statuses section — label + color picker + reset-to-default for each value.
- **Refactor:** `StatusPill` / `PriorityFlag` / `presentation` read the org's prefs via
  a hook/context, with the §2 values as fallback. **Enum values fixed; relabel/recolor
  only** (completion + view engine untouched — they key off the enum, not the label).
- **Verify:** set a custom label+color → reflects app-wide; admin-only (red-team); default
  fallback; live + unit tests.

## Out of scope (explicit)
- Adding/removing/reordering statuses or priorities (frozen enums + engine coupling).
- A work/status dashboard or the future auto-status vision.
- Native app / Play-Store build (the PWA already installs).
- Real notifications (parked as a future request, 2026-07-19).
