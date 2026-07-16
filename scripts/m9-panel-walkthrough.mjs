// PDL-036 task detail panel walkthrough — drives the real panel in a browser:
// row click opens it, every quick field persists, the Fields section shows checklist
// + DoD, the Activity feed reads the real audit trail, and Escape/close work.
// Run with the dev server up:
//   npm run dev  then  node scripts/m9-panel-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m9-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const email = `pnl_${Math.random().toString(36).slice(2, 8)}@example.com`
const title = `Prepare MIS ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // Seed one task through the real client (so the DB triggers write real activity).
  await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    await sb.from('items').insert([
      { organization_id: orgId, title: t, type: 'task', state: 'committed', created_by: uid },
    ])
  }, title)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  await page.getByRole('table').waitFor({ timeout: 10000 })

  // ── The table, per the new column spec ─────────────────────────────────────
  const head = (await page.getByRole('table').innerText()).toLowerCase()
  check('column "name" present', head.includes('name'))
  check('column "priority" present', head.includes('priority'))
  check('column "due date" present', head.includes('due date'))
  check('column "status" present', head.includes('status'))
  check('Start column is GONE from the row (moved to the panel)', !head.includes('start'))

  // ── Open the panel ─────────────────────────────────────────────────────────
  check('no panel before clicking', !(await page.getByRole('dialog').isVisible().catch(() => false)))
  await page.getByRole('button', { name: title }).click()
  const panel = page.getByRole('dialog', { name: new RegExp(`details for ${title}`, 'i') })
  await panel.waitFor({ timeout: 10000 })
  check('clicking the task name opens the detail panel', await panel.isVisible())
  // It must not navigate away — the list is still mounted behind the panel.
  check('the list stays mounted behind the panel (no navigation)', await page.getByRole('table').isVisible())
  await page.screenshot({ path: `${OUT}/01-panel-open.png` })

  // ── Quick fields persist ───────────────────────────────────────────────────
  await panel.getByLabel('Priority').selectOption('high')
  await panel.getByLabel('Due date').fill('2026-08-20')
  await panel.getByLabel('Start date').fill('2026-08-10')
  await panel.getByLabel('Time estimate').fill('2h 30m')
  await panel.getByLabel('Description').fill('Pull the numbers from the ledger first.')
  await panel.getByLabel('Title').click() // blur the description → saves
  await page.waitForTimeout(1500)

  // Title edit last (it renames the thing we locate by).
  const newTitle = `${title} v2`
  await panel.getByLabel('Title').fill(newTitle)
  await panel.getByLabel('Description').click() // blur → saves
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/02-panel-edited.png` })

  // Layout: quick fields must not be clipped by the panel edge. The first cut of
  // this panel rendered the Due input half outside it, and every value-level
  // assertion still passed — so check geometry, not just persistence.
  const fits = async (label) => {
    const el = await panel.getByLabel(label, { exact: true }).boundingBox()
    const box = await panel.boundingBox()
    return el && box && el.x >= box.x && el.x + el.width <= box.x + box.width + 1
  }
  check('Start date input is not clipped by the panel edge', await fits('Start date'))
  check('Due date input is not clipped by the panel edge', await fits('Due date'))
  check('Time estimate input is not clipped by the panel edge', await fits('Time estimate'))

  // Read the truth back from the DB, not from the DOM.
  const row = await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const { data } = await sb
      .from('items')
      .select('title, priority, start_at, due_at, time_estimate_minutes, body')
      .eq('title', t)
      .single()
    return data
  }, newTitle)

  check('title edit persisted', row?.title === newTitle)
  check('priority persisted', row?.priority === 'high')
  check('due date persisted', (row?.due_at ?? '').startsWith('2026-08-20'))
  check('start date persisted (panel-only field)', (row?.start_at ?? '').startsWith('2026-08-10'))
  check('time estimate persisted as 150 minutes', row?.time_estimate_minutes === 150)
  check('description persisted to items.body', row?.body === 'Pull the numbers from the ledger first.')

  // ── Fields section: checklist + DoD, both visible without a second click ────
  const panelText = await panel.innerText()
  check('Fields section shows "Checklist"', panelText.includes('Checklist'))
  check('Fields section shows "Definition of Done" (not buried)', panelText.includes('Definition of Done'))

  await panel.getByLabel(/add a checklist step/i).fill('Reconcile the ledger')
  await panel.getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(1200)
  check('a checklist step adds from the panel', (await panel.innerText()).includes('Reconcile the ledger'))

  await panel.getByLabel(/definition of done/i).fill('Numbers tie to the ledger.')
  await panel.getByLabel('Title').click() // blur → saves
  await page.waitForTimeout(1200)
  const dod = await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('items').select('definition_of_done').eq('title', t).single()
    return data?.definition_of_done
  }, newTitle)
  check('definition of done persisted', dod === 'Numbers tie to the ledger.')

  // ── Activity feed — the real append-only audit trail, read-only ─────────────
  const activityText = await panel.innerText()
  check('Activity feed renders', activityText.includes('Activity'))
  check('Activity shows the creation event in human words', /created this item/i.test(activityText))
  check('Activity leaks no raw enum (e.g. "state_changed")', !/state_changed|moved_list/i.test(activityText))
  // Comment-writing is deferred — the panel must not offer it yet.
  check('no comment box (deferred, not silently added)', !/add a comment/i.test(activityText))
  await page.screenshot({ path: `${OUT}/03-panel-activity.png` })

  // ── Close ──────────────────────────────────────────────────────────────────
  // Before completing: a done task leaves this view, so the table would be
  // legitimately empty afterwards and these checks would misread that as a bug.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  check('Escape closes the panel', !(await panel.isVisible().catch(() => false)))
  check('the list is still there after closing', await page.getByRole('table').isVisible())

  await page.getByRole('button', { name: newTitle }).click()
  await panel.waitFor({ timeout: 5000 })
  await panel.getByRole('button', { name: 'Close', exact: true }).click()
  await page.waitForTimeout(500)
  check('the close button closes the panel', !(await panel.isVisible().catch(() => false)))

  // ── Complete from the panel (last — it removes the task from this view) ─────
  await page.getByRole('button', { name: newTitle }).click()
  await panel.waitFor({ timeout: 5000 })
  await panel.getByRole('button', { name: new RegExp(`complete ${newTitle}`, 'i') }).click()
  await page.waitForTimeout(1500)
  const doneState = await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('items').select('state').eq('title', t).single()
    return data?.state
  }, newTitle)
  check('the complete checkmark completes the task', doneState === 'done')

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors)
} finally {
  await browser.close()
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
