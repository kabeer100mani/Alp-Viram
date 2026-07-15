import { getSupabaseClient } from '@/lib/supabase/client'
import { classificationSchema, type Classification } from '@/lib/ai/classification'

/**
 * Calls the server-side classifier (Supabase Edge Function). The provider and
 * API key live there; the client only ever sees the validated result.
 */
export async function classifyCapture(input: string): Promise<Classification> {
  // The user's IANA timezone: relative dates ("tomorrow 4pm") are only
  // resolvable against their local time, and the answer must come back as an
  // absolute instant, not a naive wall time (TD-002).
  let timezone: string | undefined
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timezone = undefined
  }

  const { data, error } = await getSupabaseClient().functions.invoke('classify-capture', {
    body: { input, timezone },
  })
  if (error) throw error

  const parsed = classificationSchema.safeParse((data as { classification?: unknown })?.classification)
  if (!parsed.success) {
    throw new Error('AI returned an unexpected shape.')
  }
  return parsed.data
}
