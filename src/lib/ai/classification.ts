import { z } from 'zod'

/**
 * Provider-neutral contract for an AI Inbox classification. The Edge Function
 * returns this shape regardless of which AI provider produced it; the client
 * validates against this schema before trusting it (never trust raw AI output).
 */
export const classificationSchema = z.object({
  type: z.enum(['task', 'note', 'meeting']),
  title: z.string().min(1),
  body: z.string().nullable(),
  is_reminder: z.boolean(),
  due_at: z.string().nullable(),
  remind_at: z.string().nullable(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
  clarifying_question: z.string().nullable(),
})

export type Classification = z.infer<typeof classificationSchema>
