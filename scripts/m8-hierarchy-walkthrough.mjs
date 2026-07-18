// PDL-035 browser walkthrough — build Project → Folder → List in the rail, file a
// task, navigate to the list. Also confirms the fixed row-expand (DoD visible;
// List clearly separate from Checklist).
//   npm run dev  then  node scripts/m8-hierarchy-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m8-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
const email = `hier_${Math.random().toString(36).slice(2, 8)}@example.com`
const title = `Prepare MIS ${Math.random().toString(36).slice(2, 6)}`
const pj = `Client Work ${Math.random().toString(36).slice(2, 4)}`
const fd = `Acme ${Math.random().toString(36).slice(2, 4)}`
const ls = `Q3 ${Math.random().toString(36).slice(2, 4)}`

async function addVia(rail, iconLabel, fieldLabel, value) {
  await rail.getByRole('button', { name: iconLabel }).first().click()
  await rail.getByLabel(fieldLabel).fill(value)
  await rail.getByRole('button', { name: /^add$/i }).click()
  await page.waitForTimeout(800)
}

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
    await sb.from('items').insert({ organization_id: orgId, title: t, type: 'task', state: 'committed', created_by: uid })
  }, title)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  const rail = page.getByRole('navigation', { name: /views/i })

  // Project → Folder → List
  await addVia(rail, /^new project$/i, /new project name/i, pj)
  check('a Project can be created', await rail.getByRole('button', { name: pj, exact: true }).isVisible())

  await addVia(rail, new RegExp(`^new folder in ${pj}$`, 'i'), /new folder name/i, fd)
  check('a Folder can be created in a Project', await rail.getByRole('button', { name: new RegExp(fd, 'i') }).first().isVisible())

  await addVia(rail, new RegExp(`^new list in ${fd}$`, 'i'), /new list name/i, ls)
  const listNav = rail.getByRole('button', { name: new RegExp(`^${ls}$`, 'i') })
  await listNav.waitFor({ timeout: 10000 })
  check('a List can be created inside a Folder', await listNav.isVisible())
  await page.screenshot({ path: `${OUT}/1-tree.png` })

  // Reload so the just-created list is in the picker's options, then file the task.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  const row = page.getByRole('row').filter({ hasText: title }).first()
  await row.waitFor({ timeout: 10000 })
  // Wait for writable_item_ids to resolve (inline editors only render when
  // canWrite is known); otherwise the List picker is briefly a read-only span.
  await row.getByLabel(new RegExp(`priority for ${title}$`, 'i')).waitFor({ timeout: 15000 })
  await row.getByRole('button', { name: new RegExp(`details for ${title}$`, 'i') }).click()
  await page.waitForTimeout(400)

  // The fixes: DoD is visible directly, and "List" is a clearly separate section.
  const expandText = await page.locator('section').last().innerText()
  check('row-expand shows a "Definition of Done" field directly (no longer buried)', /definition of done/i.test(expandText))
  check('row-expand labels the List section as where the task lives', /list \(where this task lives\)/i.test(expandText))

  // The expand is a SIBLING role="row", not a child of the main row, so the List
  // picker is page-scoped (its aria-label carries the title, so it's unique).
  await page.getByLabel(new RegExp(`list for ${title}$`, 'i')).click()
  await page.getByRole('option', { name: ls, exact: true }).click()
  await page.waitForTimeout(1200)

  // The reload collapsed the tree — expand Project → Folder to reach the list.
  await rail.getByRole('button', { name: pj, exact: true }).click()
  await rail.getByRole('button', { name: new RegExp(`^${fd}$`, 'i') }).click()
  await listNav.waitFor({ timeout: 10000 })
  await listNav.click()
  await page.waitForTimeout(1200)
  check('opening the List shows the task filed into it', (await page.locator('section').last().innerText()).includes(title))
  await page.screenshot({ path: `${OUT}/2-list.png` })
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
console.log(failures === 0 ? '\n✅ HIERARCHY WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
