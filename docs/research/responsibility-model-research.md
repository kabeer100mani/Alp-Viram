# Responsibility Model — Research & Recommendation

> Research input for the Product Freeze documents (feeds Docs 5, 8, 9 and the
> Responsibility Model design). "Verified" = vendor/source-stated (cited);
> "Inference" = design analysis. Sourced via web research.

## What real systems teach us (verified)

**RACI stays in documents, not the task object — deliberately.** PM tools (Jira,
Asana, Trello) support RACI only via custom fields/labels/side spreadsheets, not
as first-class attributes. Two documented reasons: RACI **duplicates** what the
tool already tracks (assignee, watchers), and it binds responsibility to
*individuals*, clashing with shared-team accountability.
*Inference:* the pitfall isn't RACI's four roles — it's binding them to **people**.
Bind them to **roles** and the staleness problem inverts in our favor.
Sources: [Atlassian](https://www.atlassian.com/work-management/project-management/raci-chart),
[project-management.com](https://project-management.com/understanding-responsibility-assignment-matrix-raci-matrix/)

**Enterprise delegation separates "who owns" from "who acts now."** ServiceNow
models ownership as an **assignment group** (role/queue) plus optional
**assigned-to** individual. Delegation lets a user grant another the right to act
during absence, with two load-bearing rules: delegates **do not own** the records,
and delegation **does not cascade**. Salesforce shows the cost of getting it
wrong: approval steps can't target a role — only users or a **queue** — so named
users "require updating whenever someone arrives, leaves, or moves roles"; the fix
is to route to a queue and put roles in the queue.
Sources: [ServiceNow delegation](https://www.servicenow.com/docs/r/servicenow-platform/self-service/t_DelegateApprovalsTasks.html),
[ServiceNow assignment groups](https://www.servicenow.com/docs/bundle/washingtondc-servicenow-platform/page/administer/users-and-groups/concept/c_ConfigGroupTypesForAssignGroups.html),
[Salesforce Queues](https://www.salesforceben.com/everything-you-need-to-know-about-salesforce-queues/)

**On-call systems already solved "role owns the page, not a person."** PagerDuty
escalation targets are **either a user or a schedule**; a schedule resolves to
*whoever is on call now*, so rotations/replacements change no configuration. The
schedule is the indirection layer we need.
Source: [PagerDuty](https://support.pagerduty.com/main/docs/escalation-policies-and-schedules)

**HR "position vs. person" is the canonical persistence pattern.** SAP
SuccessFactors Position Management: the **Position** is a durable object; the
**person** is an *incumbent* linked via a Job Info record. Managers/staff change;
the position persists. Exactly "work owned by a role, filled by an employee."
Source: [SAP Help](https://help.sap.com/docs/successfactors-employee-central/implementing-position-management/what-is-position-management)

**Immutable audit = append-only event log + point-in-time replay.** Event sourcing
stores state as an ordered, immutable append-only log; replay to any past instant
reconstructs state ("who was responsible on date X"), provided each event carries
actor, timestamp, action. *Inference:* we need this only for the
ownership/assignment facts, not the whole product.
Sources: [Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing),
[AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html)

## Recommended conceptual model (no SQL — design only)

**Core entities**
- **Role** — a durable named responsibility ("Tax Reviewer — West"); the SAP
  *position*. Never deleted, only deactivated.
- **Role-Assignment** — a **time-bounded** link between a User and a Role, with
  `valid_from`/`valid_to` (open-ended = current). This is the PagerDuty *schedule*:
  the indirection that makes replacement a data change, not a mass edit. Multiple
  concurrent assignments allowed.
- **Work Item responsibility fields:** **Responsible Role** (mandatory → points at
  a Role, never a user), **Current Owner** (optional User executing now),
  **Collaborators** (optional Users). (Optional full RACI: Accountable = a second
  role pointer; Consulted/Informed = collaborator sub-types — RACI lives in the
  object precisely because it targets roles, not names.)
- **Delegation** — time-bounded grant: `from_user`, `to_user`, scope (role or
  specific items), `valid_from`/`valid_to`, reason. Delegate **does not** become
  owner; delegation **does not** cascade.
- **Audit Event** — append-only, immutable: `{item, event_type, old_value,
  new_value, actor, effective_at, recorded_at}`. Types: RoleReassigned,
  OwnerChanged, Delegated, DelegationEnded, Completed, …

**How they relate.** A Work Item never stores a person for responsibility — it
stores a **Role**. "Who is responsible right now" is **derived**: Responsible Role
→ active Role-Assignment(s) → User(s). Current Owner is the only place a person is
pinned to an item, and it's optional/operational.

**Role Replacement (person leaves).** Do **not** touch work items. Close the
departing user's Role-Assignment (`valid_to = today`) and open one for the
successor. Every open item on that Role instantly resolves to the new person.
Operational ownership that transfers = items whose **Current Owner = departing
user AND Responsible Role ∈ successor's active roles AND item still open**.
Completed items are frozen history. Write a RoleReassigned audit event so
point-in-time reconstruction stays exact.

**Temporary Delegation (leave cover).** Create a Delegation for the role/period;
the Role-Assignment is **not** changed (absent person still substantively owns; the
delegate only *acts*). "Who can act now" = active assignment holders **plus** active
delegates. When `valid_to` passes, authority reverts automatically — no cleanup, no
history rewrite. Non-owning, non-cascading (mirrors ServiceNow).

**Keeping role→person mapping near-zero-effort (the key risk).** If mapping goes
stale, a role label is worse than a name. Countermeasures:
1. **Single source of truth** — Role-Assignment is the *only* place the mapping
   lives; every "who" in the UI is derived, so nothing can drift.
2. **Replacement is one action** — O(1) per staffing change, not O(items).
3. **Make gaps loud** — an item whose Responsible Role has no active assignment
   renders "UNFILLED — needs owner," never a stale name.
4. **Reuse lifecycle signals** — tie assignment end-dates to HR offboarding/leave
   where available, so mappings expire without manual action.

**Edge cases**
- **Unfilled role:** item stays valid; derived owner = "unfilled" → work-queue
  alert. Honest failure mode, better than a dangling name.
- **Multiple people in one role:** allowed; derived responsibility is a *set*;
  Current Owner disambiguates the executor.
- **One person in multiple roles:** allowed; replacement migrates *per role*.
- **Deleted users:** never hard-delete; soft-deactivate so audit rows and
  completed-item owners keep resolving. Only open Role-Assignments close.
- **Completed vs open:** ownership changes apply only to **open** items; completed
  items are immutable fact.

**Net:** Responsibility = *Role (durable) → time-bounded Role-Assignment
(indirection) → derived person*, with delegation as a non-owning overlay and an
append-only event log as the sole record of change. Staffing edits become
single-row operations; history is reconstructable to any date; stale mappings are
structurally impossible because the mapping lives in exactly one place.
