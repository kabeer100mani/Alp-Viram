# M3 Milestone Report — AI Inbox

**Status:** ✅ **COMPLETE — accepted at gate by Palash (2026-07-15), validated on Gemini `flash-lite`.**
Pipeline and provider-agnosticism proven. **Explicitly NOT Anthropic-verified** — Anthropic re-test pending funding.
**Date:** 2026-07-15
**Providers implemented:** `anthropic` | `gemini` | `mock` (selected by the `AI_PROVIDER` secret)

---

## Headline

The AI Inbox pipeline is **proven end-to-end against a real model**, and the
provider-agnostic design is demonstrated (three providers, one contract, no app
changes). Accuracy on the tested model is **29/30 (97%)** with **30/30 responses
passing Zod**.

It is **not** being declared complete, for reasons in "Open questions" below —
most importantly that the provider this milestone was scoped around
(**Anthropic/Claude**) has still never had a successful real run.

---

## Results

### Run A — `gemini-flash-lite-latest` (full run, the accuracy number)
| Metric | Result |
| --- | --- |
| Classified | 30 / 30 |
| **Zod contract valid** | **30 / 30** ✅ |
| Items stored (real DB, under RLS) + read back | 30 / 30 ✅ |
| **Correct type** | **29 / 30 = 97%** |
| Needed a clarifying question | 7 / 30 = 23% |
| Avg interactions per capture | 2.23 |

**Task-vs-meeting disagreements: none.** Every genuinely ambiguous case matched
the expected label — including "Discuss invoice issue with Infosys" → task
(with the apt question *"Would you like to schedule a meeting for this discussion
or just add it as a task?"*), "Sync with design team" → meeting, "Follow up with
the vendor on delivery" → task, "Meeting notes: decided to postpone launch" → note.

**The single miss:**

| Capture | Expected | Got | Confidence |
| --- | --- | --- | --- |
| "Idea: add dark mode to the app" | note | **task** | 1.0 |

**Adjudicated by Palash (2026-07-15): a GENUINE MISS — not a defensible call.**
The `Idea:` prefix is an explicit intent signal that the user is capturing a
thought, not committing to work; classifying it as a task is wrong. Accuracy
therefore stands at a true **29/30**. Note the model reported **confidence 1.0**
on this miss — see TD-003.

### Run B — `gemini-flash-latest` (fuller Flash; partial)
16 / 30 before the free-tier **daily** request cap
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) stopped the run.
Of those 16: **16/16 correct type, 16/16 Zod-valid, 16/16 stored.**
Note `gemini-2.0-flash` is unusable on this key (free-tier `limit: 0`);
`gemini-flash-latest` is the working Flash alias.

### Run C — `mock` provider (plumbing only)
30/30 valid + stored. Proved the pipeline with zero spend. Labels meaningless by design.

---

## What is proven
1. **Full pipeline, real model:** `input → Edge Function → Zod validation → stored item (+ ai_capture) → read back`, 30/30.
2. **No AI output bypasses validation:** every response is `safeParse`d before any field is read or stored; only `parsed.data` persists. [`classify.test.ts`](../src/lib/ai/classify.test.ts) proves the gate *rejects* bad enums, out-of-range confidence, and missing fields.
3. **Inbox UI renders provider output faithfully** — [`AiCaptureBox.test.tsx`](../src/modules/inbox/components/AiCaptureBox.test.tsx).
4. **Provider-agnostic contract is real, not theoretical** — three providers now satisfy one Zod schema; swapping is an Edge Function + secret change, with zero app changes.

## Open questions / why this isn't "done"
1. ❌ **Anthropic/Claude never validated.** M3 was scoped as "AI Inbox with Anthropic/Claude as initial provider". Blocked on account credits. The Anthropic branch is written but has never returned a successful real classification.
2. ⚠️ **Tested model is `flash-lite`**, a smaller variant than the Flash originally requested. 97% is a flash-lite number.
3. ⚠️ **TD-003 — `confidence` is degenerate**: 1.0 on 28/30 including the miss. The UI shows "confidence 100%"; it carries no signal.
4. ⚠️ **TD-002 — naive/inconsistent datetimes**: some `due_at` lack a timezone; Zod only checks `string`, so they reach `timestamptz` and can shift.
5. ⚠️ **Clarification rate 23%** (vs 13% on flash-latest) against a product north star of *minimising user effort*. Some questions are good ("Which vendor?"); others are arguably over-asking ("Meeting with Finance tomorrow" → "What time?").

## Gate decision (2026-07-15)
**Accepted by Palash** as verified on **Gemini flash-lite** — pipeline and
provider-agnosticism proven — and explicitly **not** as Anthropic-verified.
Gemini is the **active** provider on cost grounds; **Anthropic/Claude remains the
intended long-term provider**, to be re-tested once funded.
**TD-002 (🔴 high) and TD-003 remain OPEN.**

## Reproducing
```
# provider/model are secrets; verify_jwt is pinned in supabase/config.toml
npx supabase secrets set AI_PROVIDER=gemini --project-ref jdngjwspqxhpkmqhcekc
npm run deploy:function          # deploy + JWT guard, chained
node scripts/m3-classify-test.mjs
```
