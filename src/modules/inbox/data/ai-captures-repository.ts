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
