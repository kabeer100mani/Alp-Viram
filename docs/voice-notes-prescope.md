# Voice notes — pre-scope decisions (NOT yet scoped or built)

> **Not a plan, not a spec, not on the build queue.** Voice capture is **Future
> scope** in the frozen package (PDL-019: "voice added via a clean extension point";
> Doc 4 / PRD §7 Future). These are answers Palash gave ahead of time (2026-07-18) so
> they aren't lost when voice notes is *properly* scoped later. Fold them in then.

## Decisions recorded

- **Consent / recording indicator — not a blocker.** This is a standard feature
  category (Otter, Fireflies, Zoom). *Optional:* a simple "recording" indicator during
  capture, matching common UX in this space — a nicety, **not a hard requirement**.

- **Audio storage — transient.** Keep the **raw audio only temporarily**, until the
  user has verified the transcript, then **delete it**. The **transcript is the
  permanent record**, not the audio. (Implication for later scoping: a short-lived
  audio store with a delete-after-verify step; the durable artifact is text.)

- **Speaker identification — manual, one-time, no auto name-matching.** After
  transcription, show the transcript with **generic labels (Speaker 1, 2, 3…)** and let
  the user **manually tag each one to a real person, once.** Deliberately simpler and
  more reliable than inferring names automatically.

## Notes for whoever scopes this next
- Voice notes naturally produces a **Note** (or a Meeting-style record) — but Meeting
  is currently dropped for MVP (PDL-039), so a transcript would land as a Note/Task.
- Transcription needs a provider (another AI/ASR dependency) — same provider-agnostic,
  Zod-validated discipline should apply to whatever it returns.
- Ties loosely to the compound-capture idea (a transcript may contain several action
  items) and the [Future Vision](FUTURE-VISION.md) (observing real work).
