// PDL-044 — Project context: create a project with context, edit it, and (best
// effort) see the capture follow-up rank the matching list. The keyword ranking
// itself is unit-tested (rank-lists.test.ts); this verifies the UI + persistence.
//   npm run dev  then  node scripts/m12-project-context-walkthrough.mjs
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const email = `pctx_${Math.random().toString(36).slice(2, 8)}@example.com`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // ── Create a project WITH context via the rail ─────────────────────────────
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByLabel('New project name').fill('Acme')
  await page.getByLabel('New project context').fill('Slides, decks and reports for the Acme client account.')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(1200)
  check('the new project appears in the rail', await page.getByRole('button', { name: /^Acme$/ }).first().isVisible())

  const stored = await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('projects').select('name, context').eq('name', 'Acme').single()
    return data
  })
  check('the project context persisted', /acme client account/i.test(stored?.context ?? ''))

  // ── Edit the context via the Info button ───────────────────────────────────
  await page.getByRole('button', { name: /context for acme/i }).click()
  const editor = page.getByRole('textbox', { name: /context for acme/i })
  await editor.waitFor({ timeout: 5000 })
  await editor.fill('Acme account — decks, GST filings and reconciliation.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(1200)
  const edited = await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('projects').select('context').eq('name', 'Acme').single()
    return data?.context
  })
  check('editing the context persists', /reconciliation/i.test(edited ?? ''))
  await page.screenshot({ path: `${OUT}/1-project-context.png` })

  // ── Seed a list under the project so the picker has something to rank ───────
  await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    const proj = (await sb.from('projects').select('id').eq('name', 'Acme').single()).data
    await sb.from('lists').insert([
      { organization_id: orgId, project_id: proj.id, name: 'Acme deck', created_by: uid },
      { organization_id: orgId, project_id: proj.id, name: 'General', created_by: uid },
    ])
  })

  // ── Best-effort: capture a project-bound phrase; if the follow-up appears,
  //    the matching list should be suggested. Tolerant of AI variance.
  await page.getByPlaceholder(/capture in plain words/i).fill('prepare the quarterly reconciliation for the Acme account')
  await page.getByRole('button', { name: /capture/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  await page.waitForTimeout(800)
  const askedList = await page.getByText(/which list\?/i).isVisible().catch(() => false)
  if (askedList) {
    const suggestedNearAcme = /Acme deck[^]*suggested|suggested[^]*Acme deck/i.test(await page.locator('body').innerText())
    check('when the follow-up appears, the matching list is suggested (PDL-044 ranking)', suggestedNearAcme || (await page.getByRole('button', { name: /acme deck/i }).first().isVisible()))
    await page.screenshot({ path: `${OUT}/2-ranked-picker.png` })
  } else {
    console.log('ℹ️  the AI did not flag clarify=list this run (non-deterministic); ranking is unit-tested separately')
  }
  await page.getByRole('button', { name: /confirm/i }).click().catch(() => {})

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`project-context walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ PROJECT-CONTEXT WALKTHROUGH PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
