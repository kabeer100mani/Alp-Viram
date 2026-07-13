// Supabase Edge Function (Deno) — AI Inbox classifier.
//
// The ONLY place the Anthropic API key lives (PDL-004 / TDL-011). The request
// and response contracts are provider-neutral: swapping Anthropic for another
// provider is a change inside this file, not in the app. Supabase enforces a
// valid user JWT by default (verify_jwt), so this is not an open AI endpoint.
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-4-8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Provider-neutral structured-output schema. `strict: true` guarantees the
// model returns exactly this shape; every field is required (nullable where
// optional) as strict mode requires.
const classificationTool = {
  name: 'classify_capture',
  description: "Return the structured classification of the user's captured text.",
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['task', 'note', 'meeting'] },
      title: { type: 'string', description: 'A concise title for the item.' },
      body: { type: ['string', 'null'], description: 'Optional extra detail, or null.' },
      is_reminder: { type: 'boolean', description: 'True if the user is asking to be reminded.' },
      due_at: { type: ['string', 'null'], description: 'ISO 8601 datetime the work is due, or null.' },
      remind_at: { type: ['string', 'null'], description: 'ISO 8601 datetime to remind, or null.' },
      priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'urgent'] },
      confidence: { type: 'number', description: 'Confidence 0..1 in the classification.' },
      needs_clarification: { type: 'boolean' },
      clarifying_question: {
        type: ['string', 'null'],
        description: 'A single minimal question, only if genuinely needed; else null.',
      },
    },
    required: [
      'type', 'title', 'body', 'is_reminder', 'due_at', 'remind_at',
      'priority', 'confidence', 'needs_clarification', 'clarifying_question',
    ],
  },
}

function systemPrompt(today: string): string {
  return `You classify a person's natural-language capture into a work item for a project-management app.

Today's date is ${today}. Resolve relative dates ("tomorrow", "before the 8th", "next week") to absolute ISO 8601 datetimes.

Item types (choose exactly one):
- task: something actionable with a done-state ("Prepare July MIS", "Follow up with TCS").
- note: information to keep, no action ("Client prefers email over calls").
- meeting: a scheduled event with people/time ("Meeting with Finance tomorrow").

Rules:
- Set is_reminder=true when the user explicitly asks to be reminded ("Remind me to..."). Reminders are tasks with a remind_at.
- Reduce interaction. If the input is obvious ("Buy milk"), classify it immediately with needs_clarification=false and no question.
- Only set needs_clarification=true and provide clarifying_question when a genuinely important detail is missing and would materially improve the item. Never ask more than one question.
- Keep the title short and faithful to the user's words.

Respond ONLY by calling the classify_capture tool.`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { input } = await req.json()
    if (typeof input !== 'string' || input.trim().length === 0) {
      return json({ error: 'Missing "input" text.' }, 400)
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
    if (!apiKey) return json({ error: 'AI provider is not configured.' }, 500)

    const client = new Anthropic({ apiKey })
    const today = new Date().toISOString().slice(0, 10)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(today),
      tools: [classificationTool],
      tool_choice: { type: 'tool', name: 'classify_capture' },
      messages: [{ role: 'user', content: input }],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'Classification failed.' }, 502)
    }

    return json(
      { classification: toolUse.input, provider: 'anthropic', model: MODEL },
      200,
    )
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
