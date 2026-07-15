import { z } from 'zod'

/**
 * Provider-neutral contract for an AI Inbox classification. The Edge Function
 * returns this shape regardless of which AI provider produced it; the client
 * validates against this schema before trusting it (never trust raw AI output).
 */
/**
 * Datetimes must be timezone-qualified ISO 8601 ('Z' or an explicit ±HH:MM
 * offset). A naive wall time (e.g. "2026-07-20T16:00:00") is silently read as
 * UTC when stored in `timestamptz`, shifting a user's due/remind time by their
 * whole UTC offset (TD-002). Reject it here rather than corrupt it downstream.
 */
const zonedDateTime = z.iso.datetime({ offset: true })

export const classificationSchema = z.object({
  type: z.enum(['task', 'note', 'meeting']),
  title: z.string().min(1),
  body: z.string().nullable(),
  is_reminder: z.boolean(),
  due_at: zonedDateTime.nullable(),
  remind_at: zonedDateTime.nullable(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
  clarifying_question: z.string().nullable(),
})

export type Classification = z.infer<typeof classificationSchema>
