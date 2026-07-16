// M3 Gate A walkthrough — drives the REAL app in a browser:
//   sign up → capture → AI proposal → confirm → item appears in Inbox view
//   → complete → leaves Inbox → appears in Done.
// Screenshots each step. Run with the dev server up:
//   npm run dev    (in another terminal)
//   node scripts/m3-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m3-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (name, pass) => {
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) failures++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })

// Surface anything the app logs — a silent runtime error would otherwise look
// like a rendering problem.
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

const email = `wt_${Math.random().toString(36).slice(2, 8)}@example.com`

try {
  // ── 1. Sign up ──────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()

  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/1-workspace.png` })
  check('workspace renders after sign-up', true)

  // ── 2. The rail (IA §5) ─────────────────────────────────────────────────
  const rail = page.getByRole('navigation', { name: /views/i })
  await rail.waitFor({ timeout: 15000 })
  for (const name of ['Inbox', 'Today', 'Upcoming', 'Aging', 'Waiting', 'Done', 'By Role']) {
    check(`rail shows "${name}"`, await rail.getByRole('button', { name }).isVisible())
  }

  // PDL-022: a brand-new user is solo — org/role concepts must not appear.
  const body = await page.locator('body').innerText()
  check('solo user is NOT shown People & Roles (PDL-022)', !/People\s*&\s*Roles/i.test(body))
  check('solo user is NOT shown "Mode: Personal" / "Your role" (PDL-022)', !/Your role|Mode:/i.test(body))
  check('no raw item_state enum leaks on screen (PDL-027)', !/\b(captured|in_progress)\b/.test(body))

  // ── 3. Capture → AI proposal → confirm ──────────────────────────────────
  await page.getByPlaceholder(/capture in plain words/i).fill('Prepare July MIS before 8th')
  await page.getByRole('button', { name: /capture/i }).click()

  const proposal = page.getByText(/AI proposal/i)
  await proposal.waitFor({ timeout: 45000 })
  await page.screenshot({ path: `${OUT}/2-proposal.png` })
  check('AI proposal appears for the capture', true)

  // The AI writes a concise title ("Prepare July MIS"), not an echo of the raw
  // capture — so assert against what the app actually proposed, not our input.
  const proposedTitle = await page.locator('select[aria-label="Item type"] + input').inputValue()
  console.log(`   ↳ AI proposed title: "${proposedTitle}"`)
  check('AI proposed a non-empty title', proposedTitle.trim().length > 0)

  await page.getByRole('button', { name: /confirm/i }).click()
  await proposal.waitFor({ state: 'hidden', timeout: 20000 })

  // ── 4. The item lands in the Inbox view ─────────────────────────────────
  const item = page.getByText(proposedTitle, { exact: false }).first()
  await item.waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${OUT}/3-inbox.png` })
  check('captured item appears in the Inbox view', await item.isVisible())
  check('card shows a human state ("Inbox"), not "captured"', await page.getByText('Inbox').first().isVisible())

  // ── 5. Complete it — one action from the row ────────────────────────────
  // PDL-034 replaced the card (and its Done button) with a dense table whose
  // Status select completes in one action; PDL-036 removed the row-expand. This
  // step drove the old card and had been stale since PDL-034.
  const status = page.getByLabel(/^Status for /i).first()
  await status.waitFor({ timeout: 15000 })
  check('row offers an inline Status control (creator may write)', await status.isVisible())
  await status.selectOption('done')

  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/4-after-done.png` })
  const inboxNow = await page.locator('body').innerText()
  check('completed item leaves the Inbox view', !inboxNow.includes(proposedTitle))

  // ── 6. It is archived, not deleted — the Done view still has it ─────────
  await rail.getByRole('button', { name: 'Done' }).click()
  const inDone = page.getByText(proposedTitle, { exact: false }).first()
  await inDone.waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${OUT}/5-done-view.png` })
  check('completed item appears in the Done view (archived, not deleted)', await inDone.isVisible())
  check('Done row offers Reopen (Done is recoverable)', await page.getByRole('button', { name: /^Reopen /i }).first().isVisible())

  // ══ GATE B ═════════════════════════════════════════════════════════════
  // ── 7. Daily Review — the only way items leave the Inbox (PDL-016) ──────
  await page.getByPlaceholder(/capture in plain words/i).fill('Follow up with TCS')
  await page.getByRole('button', { name: /capture/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  const triageTitle = await page.locator('select[aria-label="Item type"] + input').inputValue()
  await page.getByRole('button', { name: /confirm/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ state: 'hidden', timeout: 20000 })

  await page.getByRole('button', { name: /daily review/i }).click()
  const review = page.getByRole('region', { name: /daily review/i })
  await review.waitFor({ timeout: 15000 })

  // The panel renders immediately and fetches its queue after; asserting on the
  // text straight away raced the "Loading…" state. Wait for the queue itself.
  const confirmOne = review.getByRole('button', { name: new RegExp(`^Confirm ${triageTitle}`, 'i') })
  await confirmOne.waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/6-daily-review.png` })

  const reviewText = await review.innerText()
  check('Daily Review opens and counts "N to triage"', /to triage/i.test(reviewText))
  // A bare <input type="date"> prints the browser's literal "dd-mm-yyyy" placeholder
  // when empty — and on a triage card empty is the COMMON case, so it showed on
  // nearly every card. The due chip now shows a date or a quiet "Due date" hint.
  check('triage card shows no literal "dd-mm-yyyy" placeholder', !/dd-mm/i.test(reviewText))
  check('Daily Review states the 5–10 minute target (PDL-016)', /5–10 minutes/i.test(reviewText))
  check('Daily Review never says "overdue" (FR-12b)', !/overdue/i.test(reviewText))
  check('triage groups the queue by type', /Task · \d/.test(reviewText))
  check('triage card shows the Type chip', await review.getByLabel(/type for/i).first().isVisible())
  check('triage card shows the Due chip', await review.getByLabel(/due date for/i).first().isVisible())
  check('solo user sees no Role chip (PDL-022)', !(await review.getByLabel(/role for/i).count()))

  // Confirm it out of the Inbox — the Inbox's only exit.
  await confirmOne.click()
  await review.getByText(/inbox clear/i).waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/7-inbox-clear.png` })
  check('triage reaches "Inbox clear"', /inbox clear/i.test(await review.innerText()))

  // Confirmed items land in Today/committed — they left the Inbox for real.
  await rail.getByRole('button', { name: 'Inbox' }).click()
  await page.waitForTimeout(1200)
  check('confirmed item is gone from the Inbox view', !(await page.locator('body').innerText()).includes(triageTitle))

  // ── 8. Search ──────────────────────────────────────────────────────────
  await rail.getByRole('button', { name: /search/i }).click()
  await page.getByLabel(/search your items/i).fill(triageTitle.slice(0, 6))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/8-search.png` })
  check('search finds the item by full text', (await page.locator('body').innerText()).includes(triageTitle))

  // ── 9. Dark/light persists across reload (FR-19) ────────────────────────
  await page.getByRole('button', { name: /theme|dark|light/i }).first().click()
  await page.waitForTimeout(500)
  const darkAfterToggle = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.screenshot({ path: `${OUT}/9-theme.png` })
  check('theme choice survives a reload (FR-19)', darkAfterToggle === darkAfterReload)
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
