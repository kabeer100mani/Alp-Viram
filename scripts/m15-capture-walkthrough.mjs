// M9 Gate B — Capture page + clarifying pop-up. Drives the REAL app in a browser:
//   sign up → Capture tab → chat box → send a message → the paged clarifying pop-up
//   (Type → List → Due, each with a "Recommended" tag) → commit → history thread shows
//   the message + the task → open the task → "Skip for now" commits with defaults.
//   npm run dev   then   M3_BASE=http://localhost:5174 node scripts/m15-capture-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { signUp, goToSection } from './lib/shell.mjs'

const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m15-shots'
mkdirSync(OUT, { recursive: true })

let fail = 0
const check = (n, p) => { console.log(`${p ? '✅' : '❌'} ${n}`); if (!p) fail++ }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await signUp(page, process.env.M3_BASE ?? 'http://localhost:5173')
  await goToSection(page, 'Capture')
  await page.waitForTimeout(500)

  check('Capture page shows the chat composer', await page.getByLabel('Capture a message').isVisible())
  check('composer has an attachment button (coming soon)', await page.getByLabel(/attach a file/i).count() > 0)
  check('composer has a voice button (coming soon)', await page.getByLabel(/record a voice note/i).count() > 0)
  check('empty history state shown', /no captures yet/i.test(await page.locator('main').innerText()))

  // ── Send a message → paged clarifying pop-up ────────────────────────────
  await page.getByLabel('Capture a message').fill('Prepare the Apollo board deck by next Tuesday')
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  await page.getByText(/is this a task or a note/i).waitFor({ timeout: 45000 })
  check('Q1 Type asks task-or-note, paged "1 of 3"', /1 of 3/.test(await page.locator('main').innerText()))
  check('the AI pick carries a "Recommended" tag', await page.getByText('Recommended').first().isVisible())
  check('per-question Skip + "Skip for now" both offered', /skip this question/i.test(await page.locator('main').innerText()) && /answer later/i.test(await page.locator('main').innerText()))
  await page.screenshot({ path: `${OUT}/1-type.png` })

  // Enter accepts the recommended option each step (Type → List → Due).
  await page.keyboard.press('Enter')
  await page.getByText(/which list/i).waitFor({ timeout: 8000 })
  check('Q2 List asks which list, paged "2 of 3"', /2 of 3/.test(await page.locator('main').innerText()))

  await page.keyboard.press('Enter')
  await page.getByText(/when is it due/i).waitFor({ timeout: 8000 })
  check('Q3 Due asks when, paged "3 of 3"', /3 of 3/.test(await page.locator('main').innerText()))
  check('due surfaces the AI-extracted date "From your message"', /from your message/i.test(await page.locator('main').innerText()))
  await page.screenshot({ path: `${OUT}/2-due.png` })

  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)

  // ── History thread ──────────────────────────────────────────────────────
  const main = await page.locator('main').innerText()
  check('history shows the captured message', /apollo board deck by next tuesday/i.test(main))
  check('history shows the resulting Task card', /task\s*prepare the apollo board deck/i.test(main.replace(/\n/g, ' ')))
  await page.screenshot({ path: `${OUT}/3-history.png` })

  // ── Open the task from history → TaskPanel ──────────────────────────────
  await page.getByRole('button', { name: /prepare the apollo board deck/i }).first().click()
  await page.waitForTimeout(800)
  check('opening the task shows the TaskPanel', /checklist|definition of done|add description/i.test(await page.locator('body').innerText()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // ── "Skip for now — answer later" commits with defaults ─────────────────
  await page.getByLabel('Capture a message').fill('Call the auditor about the GST filing')
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  await page.getByText(/is this a task or a note/i).waitFor({ timeout: 45000 })
  await page.getByRole('button', { name: /skip for now/i }).click()
  await page.waitForTimeout(2500)
  check('"Skip for now" commits the capture (2nd item in history)', /call the auditor about the gst filing/i.test(await page.locator('main').innerText()))
  await page.screenshot({ path: `${OUT}/4-skip-for-now.png` })

  // ── "Or reply directly" re-runs the AI (elaborate) ──────────────────────
  await page.getByLabel('Capture a message').fill('Sync up')
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  await page.getByText(/is this a task or a note/i).waitFor({ timeout: 45000 })
  const reply = page.getByLabel(/reply to add detail/i)
  check('the pop-up offers an "Or reply directly" elaborate box', await reply.isVisible())
  await reply.fill('with the finance team about Q2 numbers')
  await reply.press('Enter')
  await page.getByText(/is this a task or a note/i).waitFor({ timeout: 45000 })
  check('elaborating re-runs the AI (pop-up still active)', await page.getByText('Recommended').first().isVisible())
} catch (e) {
  check(`walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  if (errors.length) {
    console.log('\n⚠️  console/page errors:')
    for (const e of [...new Set(errors)].slice(0, 6)) console.log('   - ' + e.slice(0, 160))
  }
  await browser.close()
}
console.log(`\nScreenshots: ${OUT}`)
console.log(fail === 0 ? '\n✅ CAPTURE WALKTHROUGH (Gate B) PASSED' : `\n❌ ${fail} CHECK(S) FAILED`)
process.exit(fail === 0 ? 0 : 1)
