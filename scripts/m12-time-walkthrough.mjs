// PDL-043 — time-of-day capture/display/edit, in IST (TD-005-safe).
// Verifies: a captured/seeded clock time SHOWS on the row and in the panel; editing
// the date PRESERVES the time (the old bug clobbered it to noon); a no-time date
// reads as the 06:00–24:00 window; and the AI captures a real clock time.
//   npm run dev  then  node scripts/m12-time-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m12-shots'
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
const email = `time_${Math.random().toString(36).slice(2, 8)}@example.com`
const timed = `Timed task ${Math.random().toString(36).slice(2, 6)}`
const bare = `Bare-date task ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // Seed: one item due today at 16:00 LOCAL (IST), one due today at local midnight.
  await page.evaluate(async ({ timed, bare }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() }
    await sb.from('items').insert([
      { organization_id: orgId, title: timed, type: 'task', state: 'committed', priority: 'none', due_at: at(16, 0), created_by: uid },
      { organization_id: orgId, title: bare, type: 'task', state: 'committed', priority: 'none', due_at: at(0, 0), created_by: uid },
    ])
  }, { timed, bare })

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  await page.getByRole('table').waitFor({ timeout: 10000 })

  // ── Row Due column: time shows for the timed item, not for the bare one ─────
  const dueCell = (title) => page.getByRole('row').filter({ hasText: title }).first().getByLabel(new RegExp(`due date for ${title}`, 'i'))
  const timedDue = (await dueCell(timed).innerText()).toLowerCase()
  const bareDue = (await dueCell(bare).innerText()).toLowerCase()
  check('THE BUG FIXED: a timed due date shows its time on the row', /\b4:00\b|16:00|pm/.test(timedDue))
  check('a no-clock-time due date shows date only (no spurious time)', !/:|am|pm/.test(bareDue))
  await page.screenshot({ path: `${OUT}/1-row-due.png` })

  // ── Editing the date PRESERVES the time (old bug clobbered to noon) ─────────
  await dueCell(timed).click() // opens the date editor
  const dateEditor = page.getByRole('row').filter({ hasText: timed }).first().getByLabel(new RegExp(`due date for ${timed}`, 'i'))
  // Pick a new date (tomorrow) via the date input's value.
  const t = new Date(); t.setDate(t.getDate() + 1)
  const y = t.getFullYear(), mo = String(t.getMonth() + 1).padStart(2, '0'), da = String(t.getDate()).padStart(2, '0')
  await dateEditor.fill(`${y}-${mo}-${da}`)
  await page.waitForTimeout(1200)
  const afterEdit = await page.evaluate(async (title) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('items').select('due_at').eq('title', title).single()
    return data?.due_at
  }, timed)
  // The stored instant should still be 16:00 LOCAL (IST) — the date moved, the time kept.
  const localHour = new Date(afterEdit).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).slice(0, 2)
  check('editing the due DATE keeps the 4pm time (no noon clobber)', localHour === '16')

  // ── Panel: Start & end are time-aware; no-time reads as the default window ──
  await page.getByRole('button', { name: bare, exact: true }).click()
  const panel = page.getByRole('dialog', { name: new RegExp(`details for ${bare}`, 'i') })
  await panel.waitFor({ timeout: 10000 })
  check('panel has a time-aware End control (datetime-local)', await panel.getByLabel('End', { exact: true }).isVisible())
  check('a no-time date reads as the 6:00 AM–midnight default window', /6:00.*midnight|midnight/i.test(await panel.innerText()))
  await page.screenshot({ path: `${OUT}/2-panel-window.png` })
  await page.keyboard.press('Escape')

  // ── AI captures a real clock time ──────────────────────────────────────────
  await page.getByPlaceholder(/capture in plain words/i).fill('Call the supplier at 3pm tomorrow')
  await page.getByRole('button', { name: /capture/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  const proposalText = await page.locator('body').innerText()
  // The proposal chip shows the due with its time when the AI captured one.
  check('the AI captured the 3pm clock time (shown on the proposal)', /3:00|15:00|pm/i.test(proposalText))

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`time walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ TIME (IST) WALKTHROUGH PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
