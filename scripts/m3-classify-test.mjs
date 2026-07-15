// M3 batch test: run a batch of captures through the live AI Inbox classifier
// (deployed Edge Function) and exercise the full pipeline end-to-end:
//   input -> Edge Function -> Zod validation -> stored item (+ ai_capture) -> read back.
// Reports contract validity, storage, and (when the real provider is live)
// accuracy/clarification/interaction metrics.
//
// If the function's AI_PROVIDER secret is set to `mock`, this is a PLUMBING test
// with a mock provider — structurally valid, NOT an accuracy measurement.
//   node scripts/m3-classify-test.mjs
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Mirror of the provider-neutral contract in src/lib/ai/classification.ts.
// Every live response is validated against this before we trust any field —
// this is the same Zod gate the client applies (never trust raw AI output).
// Datetimes must be timezone-qualified (TD-002): a naive wall time would be
// silently read as UTC by `timestamptz` and shift the user's due/remind time.
const zonedDateTime = z.iso.datetime({ offset: true })

const classificationSchema = z.object({
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// 30 captures: PRD examples + real ones. `expected` is my best single label;
// some (discuss/sync/"with X") are genuinely ambiguous task-vs-meeting.
const cases = [
  ['Prepare July MIS before 8th.', 'task'],
  ['Follow up with TCS.', 'task'],
  ['Meeting with Finance tomorrow.', 'meeting'],
  ['Remind me to review July MIS.', 'task'],
  ['Aman will complete hosting reconciliation.', 'task'],
  ['Schedule meeting with client next week.', 'meeting'],
  ['Remind me tomorrow to review GST.', 'task'],
  ['Buy milk', 'task'],
  ['Client prefers email over phone calls', 'note'],
  ['Pay electricity bill by 15th', 'task'],
  ['Standup every day at 9am', 'meeting'],
  ['Note: server migration went smoothly', 'note'],
  ['Call plumber about the leak', 'task'],
  ['Quarterly review with the board on Friday', 'meeting'],
  ['Remind me to renew the domain next month', 'task'],
  ['Draft the Q3 marketing plan', 'task'],
  ['Lunch with Priya on Thursday', 'meeting'],
  ['Idea: add dark mode to the app', 'note'],
  ['Submit GST return before 20th', 'task'],
  ['Sync with design team about the new logo', 'meeting'],
  ['Remember that the API key rotates every 90 days', 'note'],
  ['Send invoice to Acme Corp', 'task'],
  ['Team offsite planning session next Wednesday', 'meeting'],
  ['Review pull request #42', 'task'],
  ['Fix the login bug', 'task'],
  ['Meeting notes: decided to postpone launch', 'note'],
  ['Follow up with the vendor on delivery', 'task'],
  ['Discuss invoice issue with Infosys', 'task'],
  ['Dentist appointment next Monday at 4pm', 'meeting'],
  ['Water the plants', 'task'],
]

const email = `m3_${Math.random().toString(36).slice(2, 8)}@example.com`
const { error: signErr } = await supabase.auth.signUp({ email, password: 'Password123!' })
if (signErr) throw new Error('signup failed: ' + signErr.message)

// A fresh sign-up is auto-provisioned a personal org + owner membership (M1).
// We store each classified item into that org under RLS — the real write path.
const userId = (await supabase.auth.getUser()).data.user?.id
const { data: orgs, error: orgErr } = await supabase.from('organizations').select('id').limit(1)
if (orgErr) throw new Error('org lookup failed: ' + orgErr.message)
const orgId = orgs?.[0]?.id
if (!orgId) throw new Error('no org auto-provisioned for the new user')

// Free-tier providers (e.g. Gemini Flash) are rate-limited. Pace requests and
// retry the transient 429s (which surface here as a non-2xx invoke error).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const THROTTLE_MS = Number(env.M3_THROTTLE_MS ?? 6000)
// A real, non-UTC zone so the TD-002 offset handling is genuinely exercised.
const TZ = env.M3_TZ ?? 'Asia/Kolkata'

async function invokeWithRetry(text, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    const res = await supabase.functions.invoke('classify-capture', {
      body: { input: text, timezone: TZ },
    })
    if (!res.error) return res
    last = res
    if (i < tries - 1) await sleep(10000 * (i + 1))
  }
  return last
}

let correct = 0
let clarifications = 0
let interactions = 0
let contractValid = 0
let stored = 0
const providers = new Set()
const storeErrors = []
const invalidShapes = []
const errors = []
const rows = []

for (const [text, expected] of cases) {
  const { data, error } = await invokeWithRetry(text)
  if (error) {
    console.error(`ERROR on "${text}": ${error.message}`)
    errors.push({ text, message: error.message })
    await sleep(THROTTLE_MS)
    continue
  }
  // Validate against the Zod contract BEFORE trusting any field.
  const parsed = classificationSchema.safeParse(data?.classification)
  if (!parsed.success) {
    console.error(`CONTRACT VIOLATION on "${text}": ${parsed.error.message}`)
    invalidShapes.push({ text, issues: parsed.error.issues })
    continue
  }
  contractValid++
  providers.add(data?.provider ?? 'unknown')
  const c = parsed.data
  const ok = c.type === expected
  if (ok) correct++
  if (c.needs_clarification) clarifications++
  interactions += 1 + (c.needs_clarification ? 1 : 0) + 1 // type + (answer) + confirm

  // Store the VALIDATED classification (never the raw response) — same shape the
  // Inbox UI persists on confirm: an item plus its ai_capture audit row.
  const { data: item, error: itemErr } = await supabase
    .from('items')
    .insert({
      organization_id: orgId,
      title: c.title,
      type: c.type,
      body: c.body,
      created_by: userId,
      due_at: c.due_at,
      remind_at: c.remind_at,
      is_reminder: c.type === 'task' ? c.is_reminder : false,
      priority: c.priority,
      source: 'inbox',
    })
    .select('id')
    .single()
  if (itemErr) {
    storeErrors.push({ text, message: itemErr.message })
  } else {
    stored++
    await supabase.from('ai_captures').insert({
      organization_id: orgId,
      user_id: userId,
      raw_input: text,
      parsed: c,
      provider: data?.provider ?? null,
      model: data?.model ?? null,
      confidence: c.confidence,
      required_clarification: c.needs_clarification,
      resulting_item_id: item.id,
    })
  }

  rows.push({
    text,
    expected,
    got: c.type,
    ok: ok ? '✅' : '❌',
    conf: c.confidence,
    q: c.needs_clarification ? c.clarifying_question : '',
    due: c.due_at ?? '',
    rem: c.is_reminder ? 'R' : '',
  })
  await sleep(THROTTLE_MS)
}

console.log('\n=== Per-capture ===')
for (const r of rows) {
  console.log(
    `${r.ok} ${r.text}\n     expected=${r.expected} got=${r.got} conf=${r.conf}${r.rem ? ' [reminder]' : ''}${r.due ? ' due=' + r.due : ''}${r.q ? '\n     ❓ ' + r.q : ''}`,
  )
}
// Read back what we stored, to prove the write path landed under RLS.
const { data: dbItems } = await supabase
  .from('items')
  .select('id')
  .eq('organization_id', orgId)
  .eq('source', 'inbox')
const { data: dbCaps } = await supabase.from('ai_captures').select('id').eq('organization_id', orgId)

const n = rows.length
const isMock = providers.has('mock')
console.log('\n=== Summary ===')
console.log(`Provider(s): ${[...providers].join(', ') || 'none'}`)
if (isMock) {
  console.log('⚠️  MOCK PROVIDER — plumbing test only. Type labels are NOT an accuracy measure.')
}
console.log(`Classified: ${n}/${cases.length}`)
console.log(`Zod contract valid: ${contractValid}/${cases.length - errors.length} responses`)
console.log(`Stored items: ${stored}/${contractValid}  |  read back: items=${dbItems?.length ?? 0} ai_captures=${dbCaps?.length ?? 0}`)
if (invalidShapes.length) {
  console.log(`  ⚠️  ${invalidShapes.length} response(s) violated the contract:`)
  for (const v of invalidShapes) console.log(`     - "${v.text}"`)
}
if (storeErrors.length) {
  console.log(`  ⚠️  ${storeErrors.length} item(s) failed to store:`)
  for (const e of storeErrors) console.log(`     - "${e.text}": ${e.message}`)
}
if (errors.length) {
  console.log(`  ⚠️  ${errors.length} request(s) errored before a response:`)
  for (const e of errors) console.log(`     - "${e.text}": ${e.message}`)
}
if (n === 0) {
  console.log('No valid classifications — nothing to score. See errors above.')
} else {
  const accLabel = isMock ? '(a) Type == expected (NOT meaningful for mock)' : '(a) Correct type'
  console.log(`${accLabel}: ${correct}/${n} = ${((correct / n) * 100).toFixed(0)}%`)
  console.log(`(b) Needed a clarifying question: ${clarifications}/${n} = ${((clarifications / n) * 100).toFixed(0)}%`)
  console.log(`(c) Avg interactions per capture: ${(interactions / n).toFixed(2)}`)
}
