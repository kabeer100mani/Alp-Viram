# Architect's Recommendations

> The closing section of the Product Design Package. My job is to challenge, not
> just document. Below: assumptions I pushed back on, risks that will be expensive
> to change later, simplifications I recommend, opportunities the research
> surfaced, and the open decisions I need from you.

---

## A. Assumptions I challenged (and what I recommend instead)

1. **"Inbox" as a hierarchy level → it's a *state/view*, not a container.**
   Making it a tier would trap project-less items. Recommend: required containment
   is only `Organization → Item`; Inbox = the capture surface + a view of
   untriaged items. *(See Doc 5.)*

2. **7 item types → 3 stored types + metadata.** Task / Note / Meeting; Reminder &
   Follow-up = Task metadata; Knowledge = Note metadata; Question is routed, not
   stored. Fewer, distinct types make AI classification reliable and reduce user
   effort — the opposite of what 7 overlapping types would do.

3. **Mandatory Responsible Role *at capture* would reintroduce friction.**
   Recommend: at capture the AI infers or omits the role (default to the user or
   "unassigned"); the role is confirmed during the Daily Review. Capture stays a
   single sentence.

4. **Org/Role machinery is overhead for solo users.** Recommend **progressive
   disclosure**: hide Organization and Role concepts until a second person is
   invited. A solo professional should never see "assign a role."

5. **"Reports" in MVP → live Saved Views.** Real dashboards are Future; saved
   views answer the everyday questions with zero report-building.

---

## B. Risks that are expensive to change later (design for them now)

1. **Flat model at scale.** Verified: flat tools become "overdue graveyards" and
   slow past thousands of items. *Mitigation now:* views + strong search are the
   navigation; index `organization_id` + common filter columns; keep an *optional*
   "Space" grouping as a future escape hatch — but only add it on real evidence.

2. **Role→person mapping going stale** (the reason role-based assignment is rare).
   *Mitigation now:* the mapping lives in exactly one place (Role-Assignment);
   every "who" is derived; unfilled roles render loudly as "UNFILLED," never a
   stale name; tie assignment end-dates to offboarding where possible.

3. **Daily Review adoption.** If the ritual feels like a chore, users skip it and
   the graveyard forms anyway. *Mitigation:* Inbox-to-zero streaks, batch confirm,
   guilt-free rollover, 5–10 min target. This is a product-design risk, not a
   technical one — treat it as first-class.

4. **AI cold-start quality.** Early mis-suggestions feel worse than manual.
   *Mitigation:* confidence-gated auto-apply (only high-confidence fields pre-fill),
   easy one-tap correction, and learn from the user's confirmations over time.

5. **Audit/event model must be right from day one.** Retrofitting immutable history
   is very expensive. *Recommendation:* model responsibility/ownership changes as
   append-only events from the first migration, even if the UI for history comes later.

6. **Multi-org "simplified now, full later."** If we don't design for it, cross-org
   later gets expensive. *Mitigation:* `organization_id` on every row and a clean
   user↔org membership model now, so lifting the "one active org" limit later is
   additive, not a rewrite.

7. **Provider-agnostic AI vs structured output differences.** Providers differ in
   tool/JSON-mode behavior. *Mitigation:* define one normalized request/response
   contract (Zod-validated) and capability flags per adapter, so business logic
   never sees provider quirks.

8. **"Meeting" as a thin type.** Without calendar sync it risks being a
   half-feature. *Recommendation:* keep it deliberately light in MVP (time +
   participants + notes + generated action items) and resist scope creep until
   calendar integration is scheduled.

---

## C. Simplifications I recommend for the MVP

- **Progressive disclosure** of Organization/Role for solo users.
- **3 item types** instead of 7.
- **Saved Views instead of a reports engine.**
- **Simplified multi-org** (one active org + switcher).
- **Defer Temporary Delegation UI** — the model supports it (PDL-017), but the
  screen can come just after MVP.
- **In-app reminders only** — no delivery channels yet.

---

## D. Opportunities the research surfaced

1. **A clear, unmet wedge:** ClickUp users have requested a real quick-capture
   Inbox for 4+ years. Frictionless capture is validated demand, still underserved.
2. **Role-based responsibility is a genuine gap** no major PM tool fills (RACI
   lives in side documents). This is both a differentiator *and* a marketing story
   — "your work survives staff changes."
3. **"Who was responsible on date X" audit** is a real enterprise/finance/
   compliance selling point that falls out of the event-log design for free.
4. **Trust positioning:** "AI that suggests, never autopilots" is exactly where the
   market landed after Motion's over-automation complaints and Height's shutdown.
   Lean into it in messaging.
5. **Delightful triage ritual:** guilt-free rollover + Inbox-Zero-for-work is a
   loveable, sticky habit that Todoist/Sunsama fans already want.
6. **Duplicate detection + auto-grouping in triage** can be an early "wow" that
   makes the AI feel smart without ever taking control.

---

## E. Open decisions I need from you (before technical architecture)

1. **Progressive disclosure for solo users** — hide Org/Role until a 2nd person
   joins? *(Recommend yes.)*
2. **Responsible Role at capture** — infer/omit at capture, confirm at triage?
   *(Recommend yes — protects frictionless capture.)*
3. **Meeting** — keep as a light 3rd type, or start as Task+metadata until calendar
   sync? *(Recommend: keep as a light type.)*
4. **Recurring items** — MVP or just-after? *(Recommend: MVP if low-cost, given
   finance/MIS use cases.)*
5. **Attachments** — needed in MVP? *(Recommend: just-after MVP.)*
6. **Success-criteria numbers** — accept my provisional targets (≤3 interactions,
   ≤10s capture, ≥85% classification) or set your own?

---

*Nothing technical (ERD, Database Design, APIs, Auth, business logic, UI, M1)
begins until this package — Documents 1–5 plus these recommendations — is reviewed
and approved.*
