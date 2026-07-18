# Plan — Project context → smarter AI classification

**Status:** Scoping for Palash. **No code written.** Grounded in the frozen package with exact citations; conflicts flagged, not built around, per standing instruction.
**Date:** 2026-07-18.

**The ask:** when creating a Project, the user gives context (what it's about, who's on the team, their roles); the AI then uses that to make smarter guesses about **which List** a capture belongs to and **who's responsible**, instead of guessing blind or asking generic questions.

---

## Bottom line up front

This is a genuinely valuable idea, but as framed it collides with the locked design in **four** places, and it splits cleanly into a **conflict-free half** and a **hard-conflict half**:

| Piece | Verdict |
| --- | --- |
| AI uses context to guess **who's responsible** | ✅ **Aligns** — PDL-021 already says the AI infers the responsible role. Clean. |
| AI uses context to guess **which List** | ⛔ **Hard conflict** — PDL-032: "**The AI does not infer the list.**" |
| **Per-project** team + roles as stored structure | ⛔ **Hard conflict** — roles are **org-scoped**; project-level roles are explicitly **Future**. |
| Feeding context at **capture** time | ⚠️ **Structural** — capture is global/unfiled; the item isn't in any project yet. |
| The feature as a whole | ⚠️ **Scope-timing** — reads as "**Advanced AI / smart suggestions**," which the package **defers** until the capture/triage foundation "is trusted" (PDL-031), a condition the docs say **isn't met yet**. |

None of this means "no." It means the honest version is **narrower and sequenced differently** than "add a context box and the AI gets smarter everywhere." My recommendation is at the end.

---

## Q1 — What it requires: a field, and how to structure the context

**Today `projects` has no context field at all** — just `name, color, position, is_archived, created_by` ([0015](supabase/migrations/0015_projects_level.sql)). So this needs new storage. Two shapes:

- **(a) Free-text context (recommended for v1).** One or two free-text fields on `projects` — "What is this project about?" and, optionally, "Who's involved / how does the work split?" The AI reads the prose. **Cheapest; one small migration; no model conflict.**
- **(b) Structured project team + per-project roles.** A real `project_members` (project ↔ user ↔ project-role) table. This is where the **hard model conflict** lives: in the frozen model **roles, role-assignments, and the only membership concept are all Organization-scoped** — Doc 5 ("Roles… live *within* an org"), DB design (`roles.organization_id`, unique `(organization_id, lower(name))`, no `project_id`), ERD (`organizations ||--o{ roles`). A project relates only to items, **not to users/roles**. And "**project-level roles/visibility**" is filed as **Future** in the DB design, and "fine-grained visibility / role inheritance" is **Future** in Doc 4. So structured per-project teams/roles is **net-new schema the frozen model deliberately pushed out of MVP.**

**Recommendation:** **free-text context (a)** for a first version. It gives the AI what it actually needs (prose it can reason over), needs one tiny migration, and sidesteps the project-roles model conflict entirely. Structured project-teams is a separate, heavier, Future-adjacent decision.

---

## Q2 — How it connects to the AI pipeline, and the cost

**Today the classifier is deliberately narrow.** `classifyCapture(input)` sends only `{ input, timezone }` to the Edge Function ([classify.ts](src/lib/ai/classify.ts)); the Zod contract ([classification.ts](src/lib/ai/classification.ts)) has **no** input for context and **no** output for list/project/role. So this feature requires **extending the AI contract** on both ends — a change under the freeze, and it must stay provider-agnostic + Zod-validated (PDL-003/PDL-014) and "AI proposes, user confirms" (PDL-012).

**The cost question hinges on one architectural fork — and it's the crux of the whole feature:**

- **Fork A — feed *all* projects' contexts at capture, let the AI pick the project/list.** This is what "smarter guesses about which List" most naturally implies. **Two problems:** (1) it *is* AI list-inference → the PDL-032 hard conflict; (2) **token cost scales with the number of projects** — every capture's prompt carries every project's context. With 10 projects at ~150 tokens each that's ~1,500 extra input tokens *per capture*; on Gemini's free tier it burns the daily quota faster, and on Anthropic it's real money at volume (order ~$0.0005–0.006 per capture depending on model, ×every capture, growing as projects grow). It also pushes against the privacy NFR ("**minimize** data sent to AI providers") by shipping team rosters on every call. **Not recommended.**
- **Fork B — use a project's context only when that project is *known*.** At Daily Review / when filing an item into a project, or after the List follow-up narrows to a project, feed **just that one project's** context (~100–250 tokens, bounded, only when actually used — not on every capture). **This is the cheap, scalable, privacy-respecting path**, and it's where filing decisions already live in the frozen flow (Daily Review triage).

**So the cost answer is: it depends entirely on the architecture — Fork A is expensive and conflicted; Fork B is cheap and clean.** The pipeline change either way: extend the classifier input to accept optional project context, and (for responsibility) add a role suggestion to the Zod output; re-validate; redeploy the Edge Function.

---

## Q3 — Conflicts with the locked design (flagged, with citations)

1. **⛔ HARD — List inference.** "Smarter guesses about which List" contradicts the exact locked line: PDL-032 — "**The AI does not infer the list — grouping stays a human/triage decision**" (echoed in CLAUDE.md, Doc 5 "forcing a list at capture" rejected, Doc 4 "Mandatory Project/List at capture | The exact friction we exist to remove"). PDL-032 even ties this to AI restraint (PDL-028) and to the "**few clear types = reliable AI**" thesis (PDL-007) — narrowing the AI's decision space is the whole point; list-inference re-expands it. **The only sanctioned nearby behavior is PDL-042** (just approved): the AI may flag *that* filing is uncertain (the dimension); the **app** offers the real lists; the **user** taps. The AI never guesses a *specific* list.
2. **✅ ALIGNS — responsibility inference.** PDL-021 / PRD FR-5: "the AI **infers** the responsible role; high confidence → pre-fill, low confidence → leave blank." Using context to sharpen *this* guess is sanctioned. **Caveat:** it isn't built yet — the shipped Zod contract has no role field — and PDL-042 deliberately chose *not* to ask role at capture (it defers to Daily Review). So this is "permitted, not yet implemented."
3. **⛔ HARD — per-project roles/team vs the org-scoped model** (see Q1b): roles/assignments/membership are all org-scoped; project-level roles are Future.
4. **⚠️ STRUCTURAL — capture is global and unfiled.** PDL-005/032/035: capture is zero-click, org-scoped, lands in the Inbox with no list/project. At classify-time **the item is not in any project**, so per-project context can't condition it there. Context can only realistically apply **later, at Daily Review** (where filing already lives) or via a *new* project-scoped capture surface (itself a change).
5. **⚠️ SCOPE-TIMING — this is "Advanced AI," which is deferred.** "Smart/proactive suggestions" and "ask your workspace" are listed **word-for-word in Future scope** (PRD §7, Doc 4), and **PDL-031** keeps them deferred *"until the capture/triage foundation is trusted"* — and states that condition is **not yet met** ("capture/triage is days old, unused by any real user, validated only on Gemini flash-lite"). Feeding context to the AI for smarter guesses is squarely this bucket. This is the **strategic** flag: even the clean responsibility half is arguably *early*.

---

## Q4 — Relationship to the List-only follow-up

They are **the same problem approached from two directions**, and the relationship is **sequential, not simultaneous**:

- The **List follow-up (PDL-042)** is the *sanctioned, conflict-free mechanism*: AI flags "unsure which list," the app shows real lists, the user taps. It **does not infer** — that's why it's allowed.
- **Project context** is the *"make the suggestion smarter"* layer on top. The only PDL-032-compatible way for context to help with lists: once a project is known, the AI can **rank/pre-highlight** the most likely list *among that project's real lists* — still **app-owned options, user-confirmed** (a refinement of PDL-042, not auto-filing). Whether "pre-highlighting one option" counts as "inferring the list" is a judgment call that **needs your ruling / a PDL amendment**.
- **Dependency direction:** the follow-up does **not** depend on context (it works by asking). Context's list value is **delivered *through* the follow-up** (a smarter thing to confirm). So: **build the List follow-up first** (it's the foundation and it's already approved), then **layer context as an enhancement** — not both at once, and not context first.
- **The cleanest, least-conflicted win for context isn't lists at all — it's responsibility** (PDL-021-aligned) and **filing *within* a project the user has already chosen** (context ranks the lists inside a known project), both at Daily Review where filing lives.

---

## Q5 — Size estimate

This is **not** a small feature, and the honest range depends heavily on how much of the conflicted surface you want:

- **Minimal v1 (recommended):** free-text project-context field + use it at Daily Review filing to suggest the **responsible role** (PDL-021-aligned) and **rank the lists within a chosen project** (PDL-042 pattern), one project's context at a time (Fork B). Includes the classifier contract extension + Edge Function redeploy. **≈ 2–3 gates.** Needs: a PDL amending PDL-032 (context-ranked list *suggestions* the user confirms) + a ruling on the PDL-031 timing.
- **Full version as literally framed** (structured per-project teams/roles + context at blind capture across all projects): **≈ 4–5+ gates**, a new membership/roles model that fights the org-scoped design, the token-cost/privacy problems of Fork A, and multiple deeper PDL amendments. **Not recommended.**

---

## Recommendation

**Don't build it as framed — build the honest core, sequenced, and make three rulings first.**

1. **Ship the List follow-up (PDL-042) first** — it's approved, conflict-free, and it's the mechanism everything else layers on. *(It's mid-scoped in the current build; finish that.)*
2. **Then a minimal Project-context v1:** a **free-text** context field on projects, used **only where a project is known** (Daily Review filing / after the follow-up narrows to a project — **Fork B**), to (a) suggest the **responsible role** (clean, PDL-021) and (b) **rank the real lists within that project** for the user to confirm (PDL-042 pattern). **No** all-projects-at-capture, **no** structured project-teams for now.
3. **Pair it with funding Anthropic (the pending D4).** This feature leans *harder* on AI quality, and PDL-031's own gate for starting "Advanced AI" is a *trusted* foundation — which today means one 30-item Gemini `flash-lite` run and Claude never tested. Doing the accuracy batch first de-risks this whole direction.

### Decisions I need from you
| # | Decision |
| --- | --- |
| **D1** | **Ruling on the PDL-032 conflict.** Approve context-driven **list *suggestions* the user confirms** (app still owns the options), as an amendment to "the AI does not infer the list"? Or keep lists strictly ask-only (PDL-042) and use context **only** for responsibility? |
| **D2** | **Context structure.** Free-text v1 (recommended), or commit now to structured per-project teams/roles (new schema, fights the org-scoped/Future model)? |
| **D3** | **Timing (PDL-031).** This is deferred "Advanced AI." Start it now anyway, or fund + run the Anthropic accuracy batch first so it's built on a trusted, measured foundation? |
| **D4** | **Sequencing.** Confirm: List follow-up first, Project-context as a second layer — not both together? |

No PDLs recorded and no code written — this is the plan. Tell me your rulings and I'll turn the approved slice into a build spec.

---

## Addendum (2026-07-18) — Does the matching even need AI? Keyword matching vs AI reasoning

Palash asked for an **honest** comparison, not an AI-by-default answer. Here it is, and the honest conclusion is: **for a large share of cases, plain string/keyword matching is genuinely good enough — and it should be the *first pass*, with AI only as a fallback.** That's cheaper, more reliable, more private, and de-risks the thin AI foundation.

### The two approaches, head to head

| | **Keyword / string matching (no AI)** | **AI reasoning** |
| --- | --- | --- |
| **How** | Does the capture text contain a List/Project name, a person's name, or a role word? Rank those. | Send the capture + one project's context; the model reasons about the best List/role. |
| **Cost** | **Free** — no tokens, no API call. | Tokens per call; real money at volume on Anthropic. |
| **Latency** | Instant. | A network round-trip. |
| **Determinism** | Fully deterministic + explainable ("matched 'Acme'"). | Non-deterministic; hard to explain a wrong guess. |
| **Privacy** | **Nothing leaves the app.** | Sends project context/rosters to the provider (against the "minimize data to AI" NFR). |
| **Handles explicit mentions** ("prep **Acme** deck", "email **Finance**") | ✅ Excellent — this is the common case. | ✅ Also fine (overkill). |
| **Handles implicit/semantic** ("reconcile the books" → Finance; "the client deck" → Acme when Acme is the only client) | ❌ Misses — no world knowledge, no synonyms. | ✅ This is where AI earns its cost. |
| **Typos / abbreviations / synonyms** | ⚠️ Partial (fuzzy match helps a bit). | ✅ Better. |
| **Failure mode** | Silent miss (no match → falls through to "just ask", which is fine). | Confident-but-wrong guess (worse — needs the user to catch it). |

### Honest verdict
- **For List ranking specifically, keyword matching is often good enough** — and it fits the approved model perfectly (D1: *the app owns the options, the user taps to confirm*). Ranking the org's real lists by "does its name/project appear in the text" needs **no AI at all**; when nothing matches, we fall back to the plain PDL-042 "which list?" tap. So the **List half can largely skip AI.**
- **For responsibility, AI adds more real value** — "who's likely responsible" is more semantic (role inferred from the nature of the work, not a literal name in the text). But even here, keyword matching catches the obvious cases (a role or person named outright).
- **The worst option is "AI by default for everything"** — it's the most expensive, least private, least reliable-to-explain, and leans hardest on the foundation PDL-031 says isn't trusted yet.

### Recommendation: **hybrid, keyword-first**
1. **First pass — keyword/fuzzy match** (free, deterministic) against the org's real Lists, people, and roles, plus the project's free-text context. This alone handles the explicit-mention majority.
2. **Fall back to AI** only when the first pass is empty or ambiguous — and only with **one** project's context (Fork B).
3. Everything stays a **ranked suggestion the user taps to confirm** (D1 / PDL-042) — so a keyword mis-rank costs nothing; the user still chooses.

This is cheaper, more private, and reduces AI dependency — and it directly answers "don't default to AI." **It also lets us ship the List-ranking win early with little or no AI**, and reserve AI spend for the responsibility case where it actually pays. I'd fold this into the Project-context build: **keyword-first ranking**, AI as the optional second pass.
