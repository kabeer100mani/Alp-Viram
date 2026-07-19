// PDL-032/033 browser walkthrough — the audit-trigger regression broke EVERY item
// write, so this drives the real write path in a browser: capture → complete
// (proves item UPDATE works again), then checklist + DoD on a card.
//   npm run dev  then  node scripts/m6-structure-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m6-shots'
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
const email = `str_${Math.random().toString(36).slice(2, 8)}@example.com`
const title = `Prepare MIS ${Math.random().toString(36).slice(2, 6)}`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // Seed an item directly (avoids the AI quota) and open the Inbox view.
  await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    // Committed (not captured) so it stays put in By Role while we edit it —
    // a captured item would leave the Inbox the moment its state changes.
    await sb.from('items').insert({ organization_id: orgId, title: t, type: 'task', state: 'committed', created_by: uid })
  }, title)

  // Seeded directly (bypassing the query cache), so reload to fetch it fresh.
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  // By Role lists every active item with no date filter — a stable place to edit.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  const card = page.locator('li', { hasText: title })
  await card.waitFor({ timeout: 10000 })
  check('item renders', await card.isVisible())

  // The regression broke EVERY item UPDATE. Prove it works — Start moves
  // committed → in_progress (item stays in By Role, which is un-dated).
  await card.getByRole('button', { name: new RegExp(`start ${title}`, 'i') }).click()
  await page.waitForTimeout(1500)
  check('item UPDATE works again (Start succeeded — audit trigger fixed)', /in progress/i.test(await card.innerText()))

  // Checklist + DoD.
  await card.getByRole('button', { name: new RegExp(`checklist and definition of done for ${title}`, 'i') }).click()
  const stepInput = card.getByLabel(new RegExp(`add a checklist step to ${title}`, 'i'))
  await stepInput.waitFor({ timeout: 10000 })
  await stepInput.fill('Reconcile the numbers')
  await card.getByRole('button', { name: /^add$/i }).click()
  await page.getByText('Reconcile the numbers').waitFor({ timeout: 10000 })
  check('a checklist step can be added', await page.getByText('Reconcile the numbers').isVisible())

  // Controlled by server state (no optimistic flip), so click then poll — it goes
  // checked once the mutation round-trips.
  const box = page.getByRole('checkbox', { name: /reconcile the numbers/i })
  await box.click()
  let ticked = false
  for (let i = 0; i < 10 && !ticked; i++) {
    await page.waitForTimeout(500)
    ticked = await box.isChecked()
  }
  check('a checklist step can be ticked (persists to server)', ticked)

  const dodText = 'Numbers reconciled and signed off.'
  await card.getByRole('textbox', { name: new RegExp(`definition of done for ${title}`, 'i') }).fill(dodText)
  await card.getByRole('textbox', { name: new RegExp(`definition of done for ${title}`, 'i') }).blur()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/1-checklist-dod.png` })

  // Prove it reached the SERVER: full reload, reopen the panel, read the value
  // back. (A textarea's value is not in innerText, so read inputValue.)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  const card2 = page.locator('li', { hasText: title })
  await card2.waitFor({ timeout: 10000 })
  await card2.getByRole('button', { name: new RegExp(`checklist and definition of done for ${title}`, 'i') }).click()
  const dod2 = card2.getByRole('textbox', { name: new RegExp(`definition of done for ${title}`, 'i') })
  await dod2.waitFor({ timeout: 10000 })
  check('the DoD persisted to the server (survives a reload)', (await dod2.inputValue()) === dodText)
  check('the ticked checklist step also persisted', await card2.getByRole('checkbox', { name: /reconcile the numbers/i }).isChecked())

  // ── Folder → List tree (PDL-032) ──────────────────────────────────────────
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await page.waitForTimeout(600)
  const rail = page.getByRole('navigation', { name: /views/i })
  const folderName = `Clients ${Math.random().toString(36).slice(2, 5)}`
  const listName = `Acme ${Math.random().toString(36).slice(2, 5)}`

  await rail.getByRole('button', { name: /^new folder$/i }).click()
  await rail.getByLabel(/new folder name/i).fill(folderName)
  await rail.getByRole('button', { name: /^add$/i }).click()
  await rail.getByRole('button', { name: folderName, exact: true }).waitFor({ timeout: 10000 })
  check('a folder can be created in the rail', await rail.getByRole('button', { name: folderName, exact: true }).isVisible())

  // Add a list inside that folder.
  await rail.getByRole('button', { name: new RegExp(`new list in ${folderName}`, 'i') }).click()
  await rail.getByLabel(/new list name/i).fill(listName)
  await rail.getByRole('button', { name: /^add$/i }).click()
  const listNav = rail.getByRole('button', { name: new RegExp(`^${listName}`, 'i') })
  await listNav.waitFor({ timeout: 10000 })
  check('a list can be created inside a folder', await listNav.isVisible())

  // File the item into the list via the card's List picker.
  await card2.getByLabel(new RegExp(`list for ${title}`, 'i')).click()
  await page.getByRole('option', { name: listName, exact: true }).click()
  await page.waitForTimeout(1500)

  // Open the list — the item should be there.
  await listNav.click()
  await page.waitForTimeout(1200)
  check('the list view shows the item filed into it', (await page.locator('section').last().innerText()).includes(title))
  await page.screenshot({ path: `${OUT}/2-list.png` })

  // Complete it — the other item UPDATE path.
  await page.locator('li', { hasText: title }).getByRole('button', { name: new RegExp(`complete ${title}`, 'i') }).click()
  await page.waitForTimeout(1500)
  check('the item completes (leaves active views) — completion UPDATE works', !(await page.locator('section').last().innerText()).includes(title))
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
console.log(failures === 0 ? '\n✅ STRUCTURE WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
