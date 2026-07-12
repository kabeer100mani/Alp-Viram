import { getSupabaseClient } from '@/lib/supabase/client'
import { classificationSchema, type Classification } from '@/lib/ai/classification'

/**
 * Calls the server-side classifier (Supabase Edge Function). The provider and
 * API key live there; the client only ever sees the validated result.
 */
export async function classifyCapture(input: string): Promise<Classification> {
  const { data, error } = await getSupabaseClient().functions.invoke('classify-capture', {
    body: { input },
  })
  if (error) throw error

  const parsed = classificationSchema.safeParse((data as { classification?: unknown })?.classification)
  if (!parsed.success) {
    throw new Error('AI returned an unexpected shape.')
  }
  return parsed.data
}
