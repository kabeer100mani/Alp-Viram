// Supabase Edge Function (Deno) — AI Inbox classifier.
//
// The ONLY place the Anthropic API key lives (PDL-004 / TDL-011). The request
// and response contracts are provider-neutral: swapping Anthropic for another
// provider is a change inside this file, not in the app. Supabase enforces a
// valid user JWT by default (verify_jwt), so this is not an open AI endpoint.
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-4-8'
// `gemini-flash-latest` is the Flash alias available on this key's free tier
// (gemini-2.0-flash returns free-tier limit:0 here). Override via GEMINI_MODEL.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'

// Provider selection. The contract is provider-neutral, so swapping providers
// is a change *here*, not in the app. `mock` returns a deterministic,
// structurally-valid classification WITHOUT any external API call — used to
// exercise the pipeline end-to-end with zero spend. It is NOT an accuracy path.
const PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'anthropic').toLowerCase()

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
      due_at: {
        type: ['string', 'null'],
        description: "Timezone-qualified ISO 8601 datetime the work is due (must include a UTC offset or 'Z'), or null.",
      },
      remind_at: {
        type: ['string', 'null'],
        description: "Timezone-qualified ISO 8601 datetime to remind (must include a UTC offset or 'Z'), or null.",
      },
      priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'urgent'] },
      confidence: { type: 'number', description: 'Confidence 0..1 in the classification.' },
      needs_clarification: { type: 'boolean' },
      clarifying_question: {
        type: ['string', 'null'],
        description: 'A single minimal question, only if genuinely needed; else null.',
      },
      clarify: {
        type: ['string', 'null'],
        enum: ['list', null],
        description:
          "Set to 'list' when the capture clearly belongs to a specific project/list but which one is genuinely unclear — the app will offer the user's real lists to tap. Otherwise null. NEVER guess or name a list yourself.",
      },
    },
    required: [
      'type', 'title', 'body', 'is_reminder', 'due_at', 'remind_at',
      'priority', 'confidence', 'needs_clarification', 'clarifying_question', 'clarify',
    ],
  },
}

// ── Timezone handling (TD-002) ─────────────────────────────────────────────
// A naive wall time ("2026-07-20T16:00:00") is read as UTC by `timestamptz`,
// shifting a user's due/remind time by their whole offset. So: resolve dates in
// the USER's timezone, and always emit an absolute, timezone-qualified instant.

/** Today's date (YYYY-MM-DD) as it is *for the user*, not on the server. */
function localToday(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Minutes that `tz` is offset from UTC at a given instant (DST-aware). */
function offsetMinutesAt(tz: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/**
 * Interpret a naive wall time as being in `tz`, returning the absolute instant
 * as UTC ISO. Two passes so a DST transition resolves correctly.
 */
function naiveToInstantIso(naive: string, tz: string): string {
  const wallAsUtc = Date.parse(`${naive}Z`)
  if (Number.isNaN(wallAsUtc)) return naive
  let offset = offsetMinutesAt(tz, new Date(wallAsUtc))
  let instant = wallAsUtc - offset * 60000
  const corrected = offsetMinutesAt(tz, new Date(instant))
  if (corrected !== offset) {
    offset = corrected
    instant = wallAsUtc - offset * 60000
  }
  return new Date(instant).toISOString()
}

const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/

/**
 * Repair timezone-less datetimes the model may still emit. This does not invent
 * data — it makes the instant the user meant explicit. Anything else is left
 * alone so the Zod gate can reject it visibly rather than corrupt it silently.
 */
function normaliseDates(classification: unknown, tz: string): unknown {
  if (!classification || typeof classification !== 'object') return classification
  const c = classification as Record<string, unknown>
  for (const key of ['due_at', 'remind_at']) {
    const value = c[key]
    if (typeof value === 'string' && NAIVE_DATETIME.test(value.trim())) {
      c[key] = naiveToInstantIso(value.trim().replace(' ', 'T'), tz)
    }
  }
  return c
}

function systemPrompt(today: string, tz: string): string {
  return `You classify a person's natural-language capture into a work item for a project-management app.

Today's date is ${today} in the user's timezone (${tz}). Resolve relative dates ("tomorrow", "before the 8th", "next week") against the user's LOCAL time.
Every datetime you return MUST be timezone-qualified ISO 8601 — include an explicit UTC offset or 'Z' (e.g. 2026-07-20T16:00:00+05:30). NEVER return a datetime without an offset.
Time of day: only include a clock time when the user actually gave one ("4pm", "at 15:30", "9 in the morning"). When the user gives a day or relative date with NO clock time ("tomorrow", "by Friday"), set the time to 00:00 (midnight) in the user's timezone — do NOT invent a time like 9am or noon.

Item types (choose exactly one):
- task: something actionable with a done-state ("Prepare July MIS", "Follow up with TCS").
- note: information to keep, no action ("Client prefers email over calls").
- meeting: a scheduled event with people/time ("Meeting with Finance tomorrow").

Rules:
- Set is_reminder=true when the user explicitly asks to be reminded ("Remind me to..."). Reminders are tasks with a remind_at.
- Reduce interaction. If the input is obvious ("Buy milk"), classify it immediately with needs_clarification=false and no question.
- Only set needs_clarification=true and provide clarifying_question when a genuinely important detail is missing and would materially improve the item. Never ask more than one question.
- Set clarify='list' when the capture clearly belongs to a specific project/list but which one is genuinely unclear (e.g. "prep the deck for the client meeting") — the app will offer the user's real lists to pick. Do NOT name or guess a list yourself. Otherwise set clarify=null. This is independent of clarifying_question.
- Keep the title short and faithful to the user's words.

Return ONLY the structured classification, with every field present (use null where a value does not apply).`
}

// ── Mock provider ─────────────────────────────────────────────────────────
// Deterministic heuristics that emit a structurally-valid Classification. The
// LABELS ARE NOT MEANINGFUL — this proves the plumbing (shape + pipeline), not
// model accuracy. Requires no API key and makes no network calls.
function isoPlusDays(today: string, days: number): string {
  const d = new Date(`${today}T09:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function mockClassify(input: string, today: string) {
  const text = input.toLowerCase().trim()
  const isReminder = /\bremind me\b/.test(text)
  let type: 'task' | 'note' | 'meeting' = 'task'
  if (
    !isReminder &&
    /\b(meeting|sync|standup|lunch|appointment|session|offsite|1:1|catch ?up|call with|review with|with the board|board on|with finance|with client|with the)\b/.test(
      text,
    )
  ) {
    type = 'meeting'
  } else if (/^(note:|idea:|remember\b)/.test(text) || /\bprefers\b/.test(text)) {
    type = 'note'
  }
  const mentionsTime = /\b(tomorrow|today|next week|next month|monday|tuesday|wednesday|thursday|friday|by |before |th\b|\d+(st|nd|rd|th))\b/.test(text)
  const priority = /\b(urgent|asap|immediately)\b/.test(text) ? 'high' : 'none'
  const title = input.length > 80 ? `${input.slice(0, 77)}…` : input
  return {
    type,
    title,
    body: null as string | null,
    is_reminder: type === 'task' ? isReminder : false,
    due_at: type === 'task' && mentionsTime ? isoPlusDays(today, 1) : null,
    remind_at: isReminder ? isoPlusDays(today, 1) : null,
    priority,
    confidence: 0.42, // deliberately mid — a mock, not a real confidence
    needs_clarification: false,
    clarifying_question: null as string | null,
    clarify: null as 'list' | null,
  }
}

// ── Gemini provider (Google Generative Language API — Flash, free tier) ─────
// Uses structured output (responseSchema) to return the provider-neutral
// classification shape. The raw model JSON is still validated by Zod in the
// app before anything is trusted — this branch does not pre-trust it.
const geminiSchema = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['task', 'note', 'meeting'] },
    title: { type: 'STRING' },
    body: { type: 'STRING', nullable: true },
    is_reminder: { type: 'BOOLEAN' },
    due_at: { type: 'STRING', nullable: true },
    remind_at: { type: 'STRING', nullable: true },
    priority: { type: 'STRING', enum: ['none', 'low', 'medium', 'high', 'urgent'] },
    confidence: { type: 'NUMBER' },
    needs_clarification: { type: 'BOOLEAN' },
    clarifying_question: { type: 'STRING', nullable: true },
    clarify: { type: 'STRING', enum: ['list'], nullable: true },
  },
  required: [
    'type', 'title', 'body', 'is_reminder', 'due_at', 'remind_at',
    'priority', 'confidence', 'needs_clarification', 'clarifying_question', 'clarify',
  ],
  propertyOrdering: [
    'type', 'title', 'body', 'is_reminder', 'due_at', 'remind_at',
    'priority', 'confidence', 'needs_clarification', 'clarifying_question', 'clarify',
  ],
}

async function geminiClassify(
  input: string,
  today: string,
  tz: string,
  apiKey: string,
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(today, tz) }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0,
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('Gemini returned no content')
  return JSON.parse(text) // raw output — the app's Zod gate validates it
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { input, timezone } = await req.json()
    if (typeof input !== 'string' || input.trim().length === 0) {
      return json({ error: 'Missing "input" text.' }, 400)
    }

    // Fall back to UTC if the client sent no/invalid IANA zone.
    let tz = typeof timezone === 'string' && timezone ? timezone : 'UTC'
    try {
      localToday(tz)
    } catch {
      tz = 'UTC'
    }
    const today = localToday(tz)

    // Mock provider: no key, no external call — same response contract.
    if (PROVIDER === 'mock') {
      return json(
        { classification: mockClassify(input, today), provider: 'mock', model: 'mock-v1' },
        200,
      )
    }

    // Gemini provider (Google Generative Language API).
    if (PROVIDER === 'gemini') {
      const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
      if (!apiKey) return json({ error: 'AI provider is not configured.' }, 500)
      const raw = await geminiClassify(input, today, tz, apiKey)
      return json(
        { classification: normaliseDates(raw, tz), provider: 'gemini', model: GEMINI_MODEL },
        200,
      )
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
    if (!apiKey) return json({ error: 'AI provider is not configured.' }, 500)

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(today, tz),
      tools: [classificationTool],
      tool_choice: { type: 'tool', name: 'classify_capture' },
      messages: [{ role: 'user', content: input }],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'Classification failed.' }, 502)
    }

    return json(
      { classification: normaliseDates(toolUse.input, tz), provider: 'anthropic', model: MODEL },
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
