// M8 Gate B — mobile content reflow, driven at real phone width (390px).
// Verifies: bottom-bar nav, quick-capture FAB dialog, the item table collapses to a
// single-column CARD list (no horizontal scroll, nothing clipped), and tapping a card
// opens the full-screen TaskPanel.
//   npm run dev   then   node scripts/m13b-mobile-walkthrough.mjs
import { chromium } from '@playwright/test'
import { signUp, goToSection } from './lib/shell.mjs'

const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m13b-shots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

let fail = 0
const check = (n, p) => { console.log(`${p ? '✅' : '❌'} ${n}`); if (!p) fail++ }
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })

try {
  await signUp(page)
  check('lands on the Overview (greeting), no horizontal overflow', (await noOverflow(page)))

  // Bottom tab bar is the mobile nav.
  const bar = page.getByRole('navigation', { name: 'Sections' })
  for (const s of ['Capture', 'Projects', 'People', 'Settings', 'Statuses']) {
    check(`bottom bar has "${s}"`, await bar.getByRole('link', { name: s }).count() > 0)
  }

  // Quick capture via the floating "+" FAB → modal dialog.
  await page.getByRole('button', { name: 'Quick capture' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ timeout: 10000 })
  check('the FAB opens the quick-capture dialog', /quick capture/i.test(await dialog.innerText()))
  await dialog.getByPlaceholder(/capture in plain words/i).fill('Reconcile the March ledger with the bank statement')
  await dialog.getByRole('button', { name: /^capture$/i }).click()
  await dialog.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  check('dialog fits the phone (no horizontal overflow)', await noOverflow(page))
  await page.screenshot({ path: `${OUT}/1-capture-dialog.png` })
  await dialog.getByRole('button', { name: /confirm/i }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})

  // Seed a couple more items directly so there is a populated list to reflow.
  await page.evaluate(async () => {
    const repo = await import('/src/modules/items/data/items-repository.ts')
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    for (const t of ['Call the auditor about the pending filings', 'Draft the quarterly board deck'])
      await repo.createItem({ organizationId: orgId, title: t, priority: 'high', createdBy: uid })
  })

  await goToSection(page, 'Capture')
  await page.reload({ waitUntil: 'networkidle' })
  await goToSection(page, 'Capture')
  await page.waitForTimeout(1000)

  // The rail is a compact horizontal chip row, not a full vertical sidebar.
  check('mobile view switcher is a compact chip row (Inbox chip)', await page.getByRole('button', { name: /^Inbox/ }).count() > 0)
  // The dense desktop table is hidden; a card list shows instead.
  check('the desktop table is hidden on mobile', !(await page.getByRole('table').isVisible().catch(() => false)))
  const bodyText = await page.locator('main').innerText()
  check('captured items render as cards', /reconcile the march ledger/i.test(bodyText))
  check('no horizontal page overflow with a populated list', await noOverflow(page))
  await page.screenshot({ path: `${OUT}/2-card-list.png` })

  // Tapping a card name opens the full-screen TaskPanel.
  await page.getByRole('button', { name: /reconcile the march ledger/i }).first().click()
  await page.waitForTimeout(800)
  check('tapping a card opens the TaskPanel', /checklist|definition of done|add description/i.test(await page.locator('body').innerText()))
  check('the TaskPanel fits the phone (no horizontal overflow)', await noOverflow(page))
  await page.screenshot({ path: `${OUT}/3-task-panel.png` })
  await page.keyboard.press('Escape')

  // Section navigation via the bottom bar.
  await goToSection(page, 'People')
  check('bottom-bar navigates to People', new URL(page.url()).pathname === '/people')
  check('People has no horizontal overflow', await noOverflow(page))
  await goToSection(page, 'Statuses')
  check('bottom-bar navigates to Statuses', new URL(page.url()).pathname === '/statuses')
} catch (e) {
  check(`mobile walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(fail === 0 ? '\n✅ MOBILE WALKTHROUGH (Gate B) PASSED' : `\n❌ ${fail} CHECK(S) FAILED`)
process.exit(fail === 0 ? 0 : 1)
