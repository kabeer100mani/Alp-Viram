// M3 core walkthrough — refreshed for the M9 shell (PDL-051: Home = the task views,
// Capture is its own surface, Quick-capture dialog). Drives the REAL app in a browser:
//   sign up → land on Home (task views + counts) → capture via the Quick-capture dialog →
//   item in the Inbox view → complete → Done → Daily Review → Search → dark-only.
//   npm run dev    then    node scripts/m3-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { signUp, goToSection, goToView, quickCapture } from './lib/shell.mjs'

const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m3-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (name, pass) => {
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) failures++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

try {
  // ── 1. Sign up → the Home landing = the task views (PDL-051) ─────────────
  await signUp(page)
  await page.screenshot({ path: `${OUT}/1-home.png` })
  check('lands on Home', new URL(page.url()).pathname === '/')
  check('Home shows the at-a-glance counts', /to triage/i.test(await page.locator('main').innerText()))

  // ── 2. The intent views live on Home now (no separate section) ──────────
  const rail = page.getByRole('navigation', { name: /views/i })
  await rail.waitFor({ timeout: 15000 })
  for (const name of ['Inbox', 'Today', 'Upcoming', 'Aging', 'Waiting', 'Done', 'By Role']) {
    check(`Home rail shows "${name}"`, await rail.getByRole('button', { name }).isVisible())
  }
  check('no raw item_state enum leaks on screen (PDL-027)', !/\b(captured|in_progress)\b/.test(await page.locator('body').innerText()))

  // ── 3. Quick capture → AI proposal (in the dialog) → confirm ────────────
  const dialog = await quickCapture(page, 'Prepare July MIS before 8th', { confirm: false })
  await page.screenshot({ path: `${OUT}/2-proposal.png` })
  const proposedTitle = await dialog.getByLabel('Proposed title').inputValue()
  console.log(`   ↳ AI proposed title: "${proposedTitle}"`)
  check('AI proposal appears in a dialog with a non-empty title', proposedTitle.trim().length > 0)
  await dialog.getByRole('button', { name: /confirm/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 })

  // ── 4. The item lands in the Capture Inbox view ─────────────────────────
  const item = page.getByText(proposedTitle, { exact: false }).first()
  await item.waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${OUT}/3-inbox.png` })
  check('captured item appears in the Inbox view', await item.isVisible())
  const statusCell = page.getByLabel(/^Status for /i).first()
  await statusCell.waitFor({ timeout: 15000 })
  check('row shows a human state ("To Do"), not "captured"', (await statusCell.innerText()).includes('To Do'))
  check('the raw "captured" enum never reaches the screen (PDL-027)', !(await page.locator('body').innerText()).includes('captured'))

  // ── 5. Complete it — one action from the row's Status pill ──────────────
  await statusCell.click()
  await page.getByRole('menuitem', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/4-after-done.png` })
  check('completed item leaves the Inbox view', !(await page.locator('body').innerText()).includes(proposedTitle))

  // ── 6. Archived, not deleted — the Done view still has it ───────────────
  await goToView(page, 'Done')
  const inDone = page.getByText(proposedTitle, { exact: false }).first()
  await inDone.waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${OUT}/5-done-view.png` })
  check('completed item appears in the Done view (archived)', await inDone.isVisible())
  check('Done row offers Reopen', await page.getByRole('button', { name: /^Reopen /i }).first().isVisible())

  // ── 7. Daily Review — the only way items leave the Inbox (PDL-016) ──────
  const triageDialog = await quickCapture(page, 'Follow up with TCS', { confirm: false })
  const triageTitle = await triageDialog.getByLabel('Proposed title').inputValue()
  await triageDialog.getByRole('button', { name: /confirm/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 })

  await goToSection(page, 'Home')
  await page.getByRole('button', { name: /daily review/i }).click()
  const review = page.getByRole('region', { name: /daily review/i })
  await review.waitFor({ timeout: 15000 })
  const confirmOne = review.getByRole('button', { name: new RegExp(`^Confirm ${triageTitle}`, 'i') })
  await confirmOne.waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/6-daily-review.png` })
  const reviewText = await review.innerText()
  check('Daily Review opens and counts "N to triage"', /to triage/i.test(reviewText))
  check('triage card shows no literal "dd-mm-yyyy" placeholder', !/dd-mm/i.test(reviewText))
  check('Daily Review states the 5–10 minute target (PDL-016)', /5–10 minutes/i.test(reviewText))
  check('Daily Review never says "overdue" (FR-12b)', !/overdue/i.test(reviewText))

  await confirmOne.click()
  await review.getByText(/inbox clear/i).waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/7-inbox-clear.png` })
  check('triage reaches "Inbox clear"', /inbox clear/i.test(await review.innerText()))

  await rail.getByRole('button', { name: 'Inbox' }).click()
  await page.waitForTimeout(1200)
  check('confirmed item is gone from the Inbox view', !(await page.locator('body').innerText()).includes(triageTitle))

  // ── 8. Search (in the Home rail) ────────────────────────────────────────
  await rail.getByRole('button', { name: /search/i }).click()
  await page.getByLabel(/search your items/i).fill(triageTitle.slice(0, 6))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/8-search.png` })
  check('search finds the item by full text', (await page.locator('body').innerText()).includes(triageTitle))

  // ── 8b. Collapsible sidebar (PDL-051) — labels hide, then return ────────
  await page.getByRole('button', { name: /collapse sidebar/i }).click()
  await page.waitForTimeout(300)
  const collapsedNav = page.getByRole('navigation', { name: 'Sections' }).first()
  check('collapsing hides the section labels', !(await collapsedNav.innerText()).match(/projects/i))
  check('collapse persists across a reload', await page.evaluate(() => localStorage.getItem('nav-collapsed') === '1'))
  await page.getByRole('button', { name: /expand sidebar/i }).click()
  await page.waitForTimeout(300)
  check('expanding brings the labels back', Boolean((await collapsedNav.innerText()).match(/projects/i)))

  // ── 9. Dark-only (temporary): dark, and stays dark across a reload ──────
  const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: 'Sections' }).first().waitFor({ timeout: 20000 })
  const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  check('app is dark and stays dark across reload', darkBefore && darkAfterReload)
} catch (err) {
  check(`walkthrough threw: ${err instanceof Error ? err.message.split('\n')[0] : err}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  if (consoleErrors.length) {
    console.log('\n⚠️  console/page errors:')
    for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log('   - ' + e.slice(0, 160))
  }
  await browser.close()
}

console.log(`\nScreenshots: ${OUT}`)
console.log(failures === 0 ? '\n✅ WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
