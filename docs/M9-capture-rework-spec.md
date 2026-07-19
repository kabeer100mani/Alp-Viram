# M9 — Capture rework: Home vs Capture, clarifying pop-up, voice notes

> Corrects the M8 structure (PDL-051). Home = the task view; Capture = a dedicated
> capture surface. Approved by Palash 2026-07-19. Gated A → B → C, stop at each gate.

## Why
The M8 shell put the task views under a "Capture" tab and a greeting/overview on Home
— backwards. And quick-capture became a whole-page dialog; only the AI's *clarifying
questions* should be a pop-up. Capture should be its own surface with a history of
messages/voice notes and the tasks they became.

## Sections (5)
Home · Capture · Projects · People · **Settings (Statuses folded in)**. Desktop: a
collapsible sidebar (icon-only ⇄ icon+label). Mobile: bottom tab bar. Global "+"
quick-capture stays, reachable from any tab.

| Section | Contents |
| --- | --- |
| **Home** (default `/`) | The task views (Inbox/Today/Upcoming/Aging/Waiting/Done/By Role) + table + Daily Review + Search + an at-a-glance counts strip (To triage / Due today / Waiting). Was the "Capture" tab. |
| **Capture** | Message/voice input + a history/log of past captures → tasks (with optional "open task"); AI clarifying questions via a pop-up. |
| **Projects · People** | As today. |
| **Settings** | Workspace + Appearance + Account + **Statuses & priorities** (the Gate C editor, folded in). |

## The clarifying pop-up (VS-Code style)
On submit, the AI's proposal drives a **paged approval pop-up** (Palash's reference, the
Claude-Code prompt UI): one question at a time, a **"1 of N" pager**, **numbered options**
(↑↓ to navigate, Enter to select), the AI's pick marked **· suggested**, a **"Something
else…"** row (elaborate) and **Skip**, plus an **"Or reply directly…"** input at the bottom
that **re-runs the AI with the added context**. It sits ABOVE the chat box on the Capture
page — only the questions are the pop-up.

**Decisions (Palash, 2026-07-19):**
- **Always ask a short paged set**, even when the AI is sure — a Task walks **Type → List →
  Due** (a Note is just **Type**; list/due don't apply). The pop-up matches the style of
  Claude Code's own question card (Palash's reference screenshot).
- **The AI's pick carries a "Recommended" tag** (like that card), pre-selected so Enter/tap
  accepts it. "Always" = always *shown with a smart default*, not always friction.
- **Two kinds of skip:** (1) **per-question Skip** keeps that question's Recommended default
  and advances; (2) a prominent **"Skip for now — answer later"** commits the capture
  immediately with all Recommended defaults and drops it into the **Inbox (To triage)**, so
  the questions are answered later in Daily Review or by re-opening the capture from history
  ("Finish setup"). Nothing ever blocks the capture.
- **Chat box + record now; attachments later.** The Capture input is a **chat box** with a
  **mic** (real recording = Gate C) and a **"+" attachment button shown but "coming soon"**
  (no storage/DB work yet — TD-004 stays deferred).
- **Drop the model selector** from the reference (Sonnet 5 / High) — end users don't pick an
  AI model.

## Voice notes (in scope)
Browser mic (MediaRecorder) → a `transcribe` Edge Function (provider-agnostic, Gemini)
→ transcript feeds the existing `classify-capture` pipeline → into the Capture history.
Audio stored in Supabase Storage for playback. `ai_captures` already logs raw input +
parsed + resulting item — the history surfaces it.

## Conflicts with locked docs / prior PDLs
- **Reverses PDL-050** (Home is the task view, not an overview landing).
- **Amends PDL-048** (Capture ≠ the views; views → Home).
- Doc 5 §5 intent (views are the navigation) is preserved — the views are simply on
  Home now. No new conflict with the frozen package.

## Gates
- **Gate A — Nav restructure:** Home = the task views (+ counts strip); Capture = a
  placeholder shell; Statuses → Settings; collapsible desktop sidebar + 5-tab mobile
  bar; keep the "+". Reverses PDL-050 / amends PDL-048.
- **Gate B — Capture page + clarifying pop-up:** message input, the history feed (from
  `ai_captures`) with an optional "open task", and the reframed clarifying pop-up with
  the "elaborate → re-run" field.
- **Gate C — Voice notes:** mic recording → `transcribe` Edge Function → classify → into
  the history, with audio playback.

## Out of scope
- Real-time collaboration on the capture thread; multi-user comments (Future).
- Non-Gemini transcription providers (the path is provider-agnostic; only Gemini wired).
