// PDL-042 "+ Create new list" — live check that createListInGeneralProject creates
// a "General" project once and REUSES it (no duplicates), and files lists under it.
// The AiCaptureBox flow is unit-tested; this pins the repo behaviour against the real
// DB (RLS in force).  npm run dev  then  node scripts/m12-create-list-test.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const email = `clist_${Math.random().toString(36).slice(2, 8)}@example.com`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  const result = await page.evaluate(async () => {
    const repo = await import('/src/modules/lists/data/lists-repository.ts')
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id

    // Zero projects to start.
    const before = (await sb.from('projects').select('id').eq('organization_id', orgId)).data?.length ?? 0

    const l1 = await repo.createListInGeneralProject(orgId, 'Ledger', uid)
    const l2 = await repo.createListInGeneralProject(orgId, 'Payroll', uid)

    const generals = (await sb.from('projects').select('id, name').eq('organization_id', orgId).ilike('name', 'General')).data ?? []
    const lists = (await sb.from('lists').select('id, name, project_id').in('id', [l1.id, l2.id])).data ?? []
    return { before, generalCount: generals.length, generalId: generals[0]?.id, lists }
  })

  check('started with zero projects', result.before === 0)
  check('exactly ONE "General" project after two creates (reused, not duplicated)', result.generalCount === 1)
  check('both new lists were created', result.lists.length === 2)
  check('both lists sit under the "General" project', result.lists.every((l) => l.project_id === result.generalId))
} catch (e) {
  check(`create-list test threw: ${e instanceof Error ? e.message : e}`, false)
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ CREATE-LIST (General) TEST PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
