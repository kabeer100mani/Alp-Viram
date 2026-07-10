/**
 * The item types the Inbox can classify natural language into (Milestone 4).
 * Config-driven on purpose — adding a type later needs no code branching.
 * The authoritative domain model is finalized in Milestone 2.
 */
export const ITEM_TYPES = [
  'task',
  'reminder',
  'meeting',
  'follow_up',
  'note',
  'knowledge_discussion',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export interface AICompletionRequest {
  system?: string
  prompt: string
  /** Optional name of a JSON schema for structured output. */
  schema?: string
}

export interface AICompletionResponse {
  text: string
  raw?: unknown
}
