// M7 Gate B — the snooze-wake regression (TD-011), in a non-UTC zone (IST).
//
// The bug: snoozed_until was written but read by nothing, so a snoozed item
// vanished from every view and never returned. Fixed by wake_due_snoozes() (0020),
// called on app load, which flips DUE snoozes back to 'committed'; plus a "Snoozed"
// system view so deferred items stay findable.
//   npm run dev  then  node scripts/m11-snooze-test.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m11-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Kolkata' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const email = `snz_${Math.random().toString(36).slice(2, 8)}@example.com`
const dueTitle = `Due-snooze ${Math.random().toString(36).slice(2, 6)}`
const futureTitle = `Future-snooze ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // Seed two snoozed items: one whose wake time has PASSED, one in the FUTURE.
  const seed = await page.evaluate(async ({ dueTitle, futureTitle }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    const past = new Date(Date.now() - 3600_000).toISOString() // 1h ago
    const future = new Date(Date.now() + 3 * 864e5).toISOString() // +3 days
    const { error } = await sb.from('items').insert([
      { organization_id: orgId, title: dueTitle, type: 'task', state: 'snoozed', priority: 'none', snoozed_until: past, created_by: uid },
      { organization_id: orgId, title: futureTitle, type: 'task', state: 'snoozed', priority: 'none', snoozed_until: future, created_by: uid },
    ])
    return { error: error?.message ?? null }
  }, { dueTitle, futureTitle })
  check('seed inserted two snoozed items', seed.error === null)

  // Reload → HomeScreen mounts → useWakeDueSnoozes fires wake_due_snoozes().
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(2500)

  // ── The truth, from the DB ─────────────────────────────────────────────────
  const rows = await page.evaluate(async ({ dueTitle, futureTitle }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const { data } = await sb.from('items').select('title, state, snoozed_until').in('title', [dueTitle, futureTitle])
    return data
  }, { dueTitle, futureTitle })
  const due = rows?.find((r) => r.title === dueTitle)
  const fut = rows?.find((r) => r.title === futureTitle)
  check('THE BUG: a due snooze woke to committed (was hidden forever before)', due?.state === 'committed')
  check('the woken item cleared its snoozed_until', due?.snoozed_until === null)
  check('a future snooze stays snoozed (not woken early)', fut?.state === 'snoozed')

  // ── The Snoozed system view shows the future one, not the woken one ─────────
  const rail = page.getByRole('navigation', { name: /views/i })
  await rail.getByRole('button', { name: 'Snoozed', exact: true }).click()
  await page.waitForTimeout(1200)
  const snoozedText = await page.locator('main').innerText()
  check('the Snoozed view exists and lists the future-snoozed item', snoozedText.includes(futureTitle))
  check('the woken item is NOT in the Snoozed view', !snoozedText.includes(dueTitle))
  await page.screenshot({ path: `${OUT}/3-snoozed-view.png` })

  // ── The woken item is back in active work (By Role shows all non-done) ──────
  await rail.getByRole('button', { name: 'By Role', exact: true }).click()
  await page.waitForTimeout(1200)
  const byRoleText = await page.locator('main').innerText()
  check('the woken item is back in an active view (By Role)', byRoleText.includes(dueTitle))

  // ── Snooze is no longer a hand-set status (D-c) ────────────────────────────
  // Open the woken (committed) item; its status dropdown must not offer "Snoozed".
  await page.getByRole('button', { name: dueTitle, exact: true }).click()
  const panel = page.getByRole('dialog', { name: new RegExp(`details for ${dueTitle}`, 'i') })
  await panel.waitFor({ timeout: 10000 })
  const statusOpts = await panel.getByLabel('Status').locator('option').allInnerTexts()
  check('the status dropdown no longer offers "Snoozed" as a manual option (D-c)', !statusOpts.includes('Snoozed'))

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`snooze test threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL-snooze.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ SNOOZE-WAKE (IST) TEST PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
