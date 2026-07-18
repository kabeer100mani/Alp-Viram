# Future Vision — Alp-Viram

> **Not a spec. Not buildable yet. Not on any milestone.** This file exists so a
> long-term ambition isn't lost. Nothing here is scoped, estimated, or committed;
> it is deliberately *beyond* the frozen product package and the current roadmap.
> Treat it as direction, not requirements.

---

## Zero-effort status: infer done-vs-pending from real work, not manual updates

**Palash's ultimate goal** (recorded 2026-07-18): the system should eventually
**monitor a user's actual work — across whatever tools they use — and automatically
infer what's done vs. pending**, rather than requiring people to manually mark items
complete or update status.

This is the natural end-point of the product's founding thesis ("minimize user
effort above all else"): today the app minimizes *capture* effort (type one
sentence, AI structures it); the long-term ambition is to also minimize *status*
effort (the app observes that the work happened and updates itself).

**Why it's explicitly future, not near-term:**
- It requires **integrations** into external tools (email, calendars, docs, ledgers,
  accounting/ERP, code hosts, chat) — a large connector/ingestion surface the MVP
  deliberately has none of.
- It requires **reliable inference** that "this observed activity means that item is
  done" — a much harder AI problem than classifying a captured sentence, with real
  false-positive risk (marking something done that isn't).
- It touches **privacy and trust** deeply (continuous monitoring of a user's work),
  which needs its own careful product + consent design.
- It presumes a **trusted AI foundation**, which the current package (PDL-031) says
  must be earned first — the app is still proving capture/triage.

**How it relates to what exists:** the **activity/audit log** (append-only,
responsibility-aware) and the **responsibility model** (who owns what) are the
honest groundwork — a system that one day infers status will still record *what
changed and who was responsible* the same way. Nothing here changes current
priorities; it's the horizon these pieces point toward.

*Revisit only after the MVP is real, trusted, and in daily use — and as its own
scoping effort, not folded into a milestone.*
