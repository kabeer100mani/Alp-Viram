# Document 4 — Feature Catalogue

> Part of the Product Design Package. Every feature is sorted into **Must Have
> (MVP)**, **Good to Have**, **Future**, or **Rejected**, each with a reason.
> Guiding test: *does it reduce user effort, and is it core to proving the thesis?*

---

## Must Have (MVP)

These are the minimum to prove "capture → triage → responsibility → execute" for a
real team.

| Feature | Why it's essential |
| --- | --- |
| **Email auth** (magic link / password) via Supabase Auth | Can't have multi-user/tenant without identity. |
| **Organization** (auto-created, renamable, invite members) | The tenant boundary; auto-created so it's never a setup gate. |
| **Simplified multi-org switcher** (one active org at a time) | Target users work across orgs; simplified to avoid MVP complexity (PDL-009). |
| **Roles + time-bounded Role-Assignments** | The heart of the responsibility differentiator; role→person indirection (PDL-015). |
| **Unified Item** — types **Task / Note / Meeting** | The single unit of work; few clear types = reliable AI (PDL-007). |
| **Responsibility fields** — Responsible Roles (**optional; 0 is valid**), Assigned Users, Collaborators | The differentiator, on every item. Capture never forces a role (PDL-021); responsibility = role, execution = assigned user (PDL-020). |
| **AI Inbox — Capture** (classify + minimal questions + user confirm) | The centerpiece; frictionless capture (PDL-005, PDL-012). |
| **AI Inbox — Daily Review (triage)** | Stops the Inbox becoming a dumping ground (PDL-016) — non-negotiable. |
| **Optional Folder → List** *(added 2026-07-16, PDL-032)* | Structure when wanted, never required; an item with no list lives in the Inbox (PDL-008). Supersedes "Optional Projects" — Project was renamed to List. |
| **Checklists + Definition of Done** *(added 2026-07-16, PDL-033)* | Sub-steps and a plain-text DoD on an item. DoD is descriptive, not enforced. Not on Notes (no done-state). |
| **Tags** (flat) | Multi-dimensional organization without hierarchy (PDL-010). |
| **Saved Views** — system (Inbox, Today, Upcoming, Aging, Waiting, by Role) + custom | Replaces reports for everyday questions; the anti-graveyard surface. |
| **Execution** — status changes, complete, snooze/defer | The "do the work" loop. |
| **Immutable activity/audit log** (responsibility + completion at minimum) | Enterprise trust; "who was responsible on date X" (PDL-018). |
| **Search** | A flat model lives or dies on find-ability. |
| **Reminders (in-app)** | Time-based nudges surfaced in views; delivery channels deferred (PDL-011). |
| **Dark/light, responsive (desktop-first), fast** | Baseline quality bar. |

---

## Good to Have (build soon; include in MVP only if cheap)

| Feature | Why not Must (yet) |
| --- | --- |
| **Recurring items** | High value (e.g. monthly MIS) but adds scheduling logic; include if low-cost. |
| **Duplicate detection / merge in triage** | Improves triage a lot; depends on AI maturity. |
| **Auto-grouping of similar Inbox items** | Speeds the Daily Review; refinement over the core loop. |
| **Timeboxing onto a simple internal calendar** | Nice for planning; not required to prove the thesis. |
| **Temporary Delegation** | Model supports it now (PDL-017); UI can follow shortly after MVP. |
| **Comments on items** | Useful collaboration; not core to capture/triage. |
| **Basic file attachments** (Supabase Storage) | Common need; can wait a beat behind the core. |
| **Templates** | Convenience; must never become a setup gate. |

---

## Future (deliberately deferred)

| Feature | Why deferred |
| --- | --- |
| **Notification delivery** — push, email, WhatsApp, digests | Separate heavy infra; in-app surfacing first (PDL-011). |
| **Voice capture** | Text delivers the same "fewer clicks" now; voice added via a clean extension point (PDL-019). |
| **Calendar sync** (Google / Microsoft) | Integration surface + auth; after the internal loop is solid. |
| **Reports & analytics dashboards** | Real value, but diverts from the core; live views cover MVP questions. |
| **Real-time collaboration / presence** | Depth beyond MVP collaboration. |
| **Enterprise permissions** — teams hierarchy, role inheritance, fine-grained visibility | Needed for large orgs; MVP uses a simpler role model. |
| **Cross-org combined views** | The non-simplified multi-org; revisit after MVP. |
| **Mobile app / PWA / Play Store (TWA)** | After the web product proves out. |
| **Advanced AI** — daily digest, deep "ask your workspace," proactive suggestions | Build on the capture/triage foundation once it's trusted. |
| **Billing & plans** | Not needed to validate the product. |

---

## Rejected (and why — challenging convention)

| Rejected idea | Why we reject it |
| --- | --- |
| ~~**Deep hierarchy** (Space/Folder/List/nested projects)~~ **— REVERSED 2026-07-16 (PDL-032)** | Was: *"Causes capture friction and 'emergent complexity' that degrades at scale."* Now: **Folder → List is built, but optional** — an item never needs a list. Still rejected: **nesting deeper than Folder → List**, and **forcing a list at capture**. The emergent-complexity risk is live again and consciously accepted. |
| **Individual-only assignment** | Breaks on every staff change; orphaned work. Replaced by role-based responsibility. |
| **Auto-executing AI** (auto-schedule, auto-triage without confirm) | Breeds distrust (Motion) and failed commercially (Height shut down Sept 2025). We confirm, never autopilot. |
| **Mandatory Project/List at capture** | The exact friction we exist to remove. |
| **6–7 separate Item types** | Overlap ("Note" vs "Knowledge" vs "Question") hurts AI accuracy and user clarity. Collapsed to 3 + metadata. |
| **Forcing fields (priority, labels, assignee) at capture** | Every forced field is a reason a thought never gets captured. |
| **A raw "overdue" shaming state** | Demotivating; creates the graveyard. Replaced by guilt-free rollover + aging nudges. |
| **Template-picker onboarding gate** | Delays first value; templates are an optional convenience, not a gate. |
| **Simultaneous cross-org views in MVP** | Large complexity for little early value; simplified to a switcher. |
