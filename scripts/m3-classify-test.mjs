// M3 Definition-of-Done: run a batch of real captures through the live AI Inbox
// classifier (deployed Edge Function) and report accuracy, clarification rate,
// and interactions per capture.
//   node scripts/m3-classify-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

let correct = 0
let clarifications = 0
let interactions = 0
const rows = []

for (const [text, expected] of cases) {
  const { data, error } = await supabase.functions.invoke('classify-capture', {
    body: { input: text },
  })
  if (error) {
    console.error(`ERROR on "${text}": ${error.message}`)
    continue
  }
  const c = data.classification
  const ok = c.type === expected
  if (ok) correct++
  if (c.needs_clarification) clarifications++
  interactions += 1 + (c.needs_clarification ? 1 : 0) + 1 // type + (answer) + confirm
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
}

console.log('\n=== Per-capture ===')
for (const r of rows) {
  console.log(
    `${r.ok} ${r.text}\n     expected=${r.expected} got=${r.got} conf=${r.conf}${r.rem ? ' [reminder]' : ''}${r.due ? ' due=' + r.due : ''}${r.q ? '\n     ❓ ' + r.q : ''}`,
  )
}
const n = rows.length
console.log('\n=== Summary ===')
console.log(`Classified: ${n}/${cases.length}`)
console.log(`(a) Correct type: ${correct}/${n} = ${((correct / n) * 100).toFixed(0)}%`)
console.log(`(b) Needed a clarifying question: ${clarifications}/${n} = ${((clarifications / n) * 100).toFixed(0)}%`)
console.log(`(c) Avg interactions per capture: ${(interactions / n).toFixed(2)}`)
