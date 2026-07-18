// PDL-034 dense table walkthrough — drives the real table in a browser:
// grouped rows, inline Priority/Start/Due/Status editing, row-expand, solo hides
// Assignee. Run with the dev server up:
//   npm run dev  then  node scripts/m7-table-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m7-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const email = `tbl_${Math.random().toString(36).slice(2, 8)}@example.com`
const title = `Prepare MIS ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    await sb.from('items').insert([
      { organization_id: orgId, title: t, type: 'task', state: 'committed', created_by: uid },
      { organization_id: orgId, title: 'Unrelated second item', type: 'task', state: 'committed', created_by: uid },
    ])
  }, title)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()

  // Table structure
  const table = page.getByRole('table')
  await table.waitFor({ timeout: 10000 })
  check('a real table renders (role=table)', await table.isVisible())
  // Headers are CSS-uppercased, so innerText returns e.g. "PRIORITY" — compare lower.
  const head = (await table.innerText()).toLowerCase()
  // PDL-036 narrowed the row to Name | Assignee | Priority | Due date | Status —
  // Start moved into the task panel, so it is deliberately absent here.
  for (const col of ['name', 'priority', 'due date', 'status']) {
    check(`column header "${col}" present`, head.includes(col))
  }
  check('Start column absent (moved to the task panel, PDL-036)', !head.includes('start'))
  // Solo user → no Assignee column (PDL-022).
  check('solo user sees NO Assignee column (PDL-022)', !head.includes('assignee'))

  // Grouped collapsible section with a count ("Unassigned 2").
  const groupHeader = page.getByRole('button', { name: /unassigned\s*\d/i })
  await groupHeader.waitFor({ timeout: 10000 })
  check('grouped section shows a count ("Unassigned N")', await groupHeader.isVisible())
  await page.screenshot({ path: `${OUT}/1-table.png` })

  const row = page.getByRole('row').filter({ hasText: title }).first()
  await row.waitFor({ timeout: 10000 })

  // Inline Priority edit. Now a styled custom dropdown (not a native <select>):
  // click the trigger, then the "High" option.
  const prio = () => row.getByLabel(new RegExp(`priority for ${title}$`, 'i'))
  await prio().click()
  // The menu is portaled to <body> (escapes the table's overflow clip) — query the page.
  await page.getByRole('option', { name: /High/ }).click()
  await page.waitForTimeout(1200)
  check('Priority is editable inline', (await prio().innerText()).includes('High'))

  // Inline Due edit. The cell shows a *date*, not a form control: it renders the
  // formatted date (or a "Set date" hint) and swaps in the input only while editing,
  // because a bare date input printed a literal "dd-mm-yyyy" placeholder in the cell.
  const dueCell = () => row.getByLabel(new RegExp(`due date for ${title}$`, 'i'))
  check('empty Due cell shows no "dd-mm-yyyy" placeholder text', !(await dueCell().innerText()).toLowerCase().includes('dd-mm'))
  await dueCell().click()
  await dueCell().fill('2026-08-08')
  await page.waitForTimeout(1200)
  check('Due date is editable inline', (await dueCell().innerText()).includes('8 Aug'))

  // Inline Status edit (shadcn Select: click the trigger, then the portaled option).
  const statusCtl = row.getByLabel(new RegExp(`status for ${title}$`, 'i'))
  await statusCtl.click()
  await page.getByRole('option', { name: 'In progress', exact: true }).click()
  await page.waitForTimeout(1200)
  check('Status is editable inline', /in progress/i.test(await statusCtl.innerText()))

  // Persist across reload.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  const row2 = page.getByRole('row').filter({ hasText: title }).first()
  await row2.waitFor({ timeout: 10000 })
  check('the inline edits persisted (priority=high after reload)', (await row2.getByLabel(new RegExp(`priority for ${title}$`, 'i')).innerText()).includes('High'))

  // The row-expand is gone (PDL-036): the heavier editors moved to the task detail
  // panel, which scripts/m9-panel-walkthrough.mjs covers end to end.
  check('row no longer expands in place', !(await row2.getByRole('button', { name: new RegExp(`details for ${title}$`, 'i') }).count()))
  await page.screenshot({ path: `${OUT}/2-row.png` })

  // Collapse a group hides its rows.
  await page.getByRole('button', { name: /unassigned\s*\d/i }).click()
  await page.waitForTimeout(400)
  check('collapsing a group hides its rows', !(await page.getByRole('row').filter({ hasText: title }).count()))
} catch (err) {
  check(`walkthrough threw: ${err instanceof Error ? err.message.split('\n')[0] : err}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  if (errors.length) {
    console.log('\n⚠️  page errors:')
    for (const e of [...new Set(errors)].slice(0, 6)) console.log('   - ' + e.slice(0, 160))
  }
  await browser.close()
}
console.log(`\nScreenshots: ${OUT}`)
console.log(failures === 0 ? '\n✅ TABLE WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
