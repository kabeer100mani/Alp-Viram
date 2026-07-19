import { getSupabaseClient } from '@/lib/supabase/client'

export interface CreateAiCaptureInput {
  organizationId: string
  userId: string
  rawInput: string
  parsed: unknown
  provider?: string
  model?: string
  confidence?: number
  requiredClarification: boolean
  resultingItemId: string
}

/** Records a capture + its AI classification (powers the AI-quality metrics). */
export async function createAiCapture(input: CreateAiCaptureInput): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('ai_captures')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      raw_input: input.rawInput,
      parsed: input.parsed as never,
      provider: input.provider ?? null,
      model: input.model ?? null,
      confidence: input.confidence ?? null,
      required_clarification: input.requiredClarification,
      resulting_item_id: input.resultingItemId,
    })
  if (error) throw error
}

/** One row of the Capture history: the raw message and the task it became. */
export interface AiCaptureRow {
  id: string
  rawInput: string
  createdAt: string
  resultingItemId: string | null
  /** Title/type of the task it became — read from the stored classification. */
  itemTitle: string | null
  itemType: string | null
}

/**
 * The Capture history feed (M9 Gate B): recent captures for the org, newest last
 * (chat-thread order), each with the task it produced so the user can open it. The
 * title/type come from the stored `parsed` classification (no FK embed needed); the
 * live item is fetched lazily only when the user opens it.
 */
export async function listAiCaptures(organizationId: string, limit = 50): Promise<AiCaptureRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('ai_captures')
    .select('id, raw_input, created_at, resulting_item_id, parsed')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = (data ?? []).map((r) => {
    const parsed = (r.parsed ?? {}) as { title?: string; type?: string }
    return {
      id: r.id as string,
      rawInput: r.raw_input as string,
      createdAt: r.created_at as string,
      resultingItemId: r.resulting_item_id as string | null,
      itemTitle: parsed.title ?? null,
      itemType: parsed.type ?? null,
    }
  })
  // Fetched newest-first for the limit; present oldest-first (a chat thread reads down).
  return rows.reverse()
}
