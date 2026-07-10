import type { AICompletionRequest, AICompletionResponse } from './types'

/**
 * Provider-agnostic AI boundary. Business logic depends ONLY on this interface,
 * never on a concrete SDK. Adapters (OpenAI, Anthropic, Gemini, …) are added in
 * Milestone 4 and always run server-side (Supabase Edge Functions) so provider
 * API keys never reach the browser.
 */
export interface AIProvider {
  readonly name: string
  complete(request: AICompletionRequest): Promise<AICompletionResponse>
}
