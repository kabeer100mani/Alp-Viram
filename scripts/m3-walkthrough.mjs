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

  // ── 5. Complete it — one action from the card ───────────────────────────
  const done = page.getByRole('button', { name: /^Complete /i }).first()
  await done.waitFor({ timeout: 15000 })
  check('card offers Done (creator may write)', await done.isVisible())
  await done.click()

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
  check('Done card offers Reopen (Done is recoverable)', await page.getByRole('button', { name: /^Reopen /i }).first().isVisible())
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
