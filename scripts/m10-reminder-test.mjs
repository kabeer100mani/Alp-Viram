// M6 Gate B — the reminder-surfacing regression, in a NON-UTC zone (IST).
//
// The bug this guards: items.remind_at was written by the AI Inbox but read by
// nothing, so a reminder-only item ("remind me tomorrow", no due date) surfaced in
// NO view once triaged (PDL-011). Fixed by nudge_at = least(due_at, remind_at)
// (migration 0017) with Today/Upcoming resolving against it.
//
// Run in IST so a timezone regression (TD-005) fails loudly — startOfLocalDay runs
// client-side, and the reminder instant round-trip must survive a +05:30 offset.
//   npm run dev  then  node scripts/m10-reminder-test.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m10-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
// The whole point: a +05:30 zone, so a UTC-only code path shows up.
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Kolkata' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const email = `rem_${Math.random().toString(36).slice(2, 8)}@example.com`
const reminderTitle = `Reminder-only ${Math.random().toString(36).slice(2, 6)}`
const plainTitle = `No-date ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // Seed two committed items: one with a reminder LATER TODAY (IST) and no due
  // date; one with neither. The reminder-only one must reach Today; the bare one
  // must not. Both committed so the Today filter (committed/in_progress) applies.
  const seed = await page.evaluate(async ({ reminderTitle, plainTitle }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    // Later today, local time → an absolute instant (the browser is in IST).
    const d = new Date()
    d.setHours(23, 0, 0, 0)
    const remindAt = d.toISOString()
    const { error } = await sb.from('items').insert([
      { organization_id: orgId, title: reminderTitle, type: 'task', state: 'committed', priority: 'none', due_at: null, remind_at: remindAt, created_by: uid },
      { organization_id: orgId, title: plainTitle, type: 'task', state: 'committed', priority: 'none', due_at: null, remind_at: null, created_by: uid },
    ])
    // Read nudge_at back to prove the generated column computed from remind_at.
    const { data: rows } = await sb.from('items').select('title, remind_at, nudge_at, due_at').in('title', [reminderTitle, plainTitle])
    return { error: error?.message ?? null, remindAt, rows }
  }, { reminderTitle, plainTitle })

  check('seed inserted without error', seed.error === null)
  const remRow = seed.rows?.find((r) => r.title === reminderTitle)
  // Compare instants, not strings — the DB returns timestamptz as "…+00:00" while
  // JS toISOString gives "…Z"; same moment, different text.
  const sameInstant = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime()
  check('nudge_at was generated from remind_at when due_at is null', sameInstant(remRow?.nudge_at, seed.remindAt))
  check('nudge_at equals remind_at exactly (least ignores the null due_at)', sameInstant(remRow?.nudge_at, remRow?.remind_at))

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // ── Today view must include the reminder-only item ─────────────────────────
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'Today' }).click()
  await page.waitForTimeout(1500)
  const todayText = await page.locator('main').innerText()
  check('THE BUG: a reminder-only item now appears in Today (PDL-011)', todayText.includes(reminderTitle))
  check('an item with neither due nor reminder does NOT appear in Today', !todayText.includes(plainTitle))
  await page.screenshot({ path: `${OUT}/4-reminder-today.png` })

  // The bell indicator shows on the row.
  const row = page.getByRole('row').filter({ hasText: reminderTitle }).first()
  check('the row shows a reminder (bell) indicator', await row.getByLabel('Has a reminder').isVisible())

  // ── Edit remind_at via the panel — TD-005 timezone round trip ──────────────
  await page.getByRole('button', { name: reminderTitle, exact: true }).click()
  const panel = page.getByRole('dialog', { name: new RegExp(`details for ${reminderTitle}`, 'i') })
  await panel.waitFor({ timeout: 10000 })
  // Set the reminder to 09:00 tomorrow, IST. The stored instant must be 03:30Z —
  // NOT 09:00Z. This is the exact TD-005 failure (a 4pm IST reminder firing at
  // 21:30 IST) the contract was hardened against.
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const y = tomorrow.getFullYear()
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  const localValue = `${y}-${m}-${day}T09:00`
  // Target the input element itself — getByLabel matches a datetime-local's inner
  // spin fields (month/day/hour/…) too, which is ambiguous.
  await panel.locator('input[aria-label="Reminder"]').fill(localValue)
  await page.waitForTimeout(1500)

  const stored = await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('items').select('remind_at').eq('title', t).single()
    return data?.remind_at
  }, reminderTitle)
  // 09:00 IST == 03:30 UTC. Assert the UTC instant, not the wall-clock digits.
  const storedUtc = new Date(stored)
  const expectedUtc = new Date(`${y}-${m}-${day}T03:30:00.000Z`)
  check('reminder set as 09:00 IST is stored as 03:30 UTC (TD-005), not 09:00 UTC', storedUtc.getTime() === expectedUtc.getTime())

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`reminder test threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL-reminder.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ REMINDER (IST) TEST PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
