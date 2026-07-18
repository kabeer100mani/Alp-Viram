// PDL-045 self-service workspace creation — live check against the real DB (RLS in
// force). Proves: create_organization() makes a fully-bootstrapped personal org the
// caller owns, the switcher lists them all, AND the RLS gap the routine bridges is
// real (a raw client membership insert into a self-made org is refused — which is
// exactly why the create path must be a SECURITY DEFINER routine, not two inserts).
//   npm run dev   then   node scripts/m13-create-org-test.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const email = `corg_${Math.random().toString(36).slice(2, 8)}@example.com`

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  const r = await page.evaluate(async () => {
   try {
    const repo = await import('/src/modules/organizations/data/organizations-repository.ts')
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const uid = (await sb.auth.getUser()).data.user.id

    const before = await repo.listMyOrgs(uid) // just the auto-created personal org

    // Create two workspaces on demand.
    const id1 = await repo.createOrganization('Job 1')
    const id2 = await repo.createOrganization('  Job 2  ') // trims

    const after = await repo.listMyOrgs(uid)
    const job1 = after.find((o) => o.id === id1)
    const job2 = after.find((o) => o.id === id2)

    // The new org is fully bootstrapped: owner membership + is_personal + system views.
    const orgRow = (await sb.from('organizations').select('is_personal, created_by').eq('id', id1).single()).data
    const views = (await sb.from('saved_views').select('id').eq('organization_id', id1).eq('is_system', true)).data ?? []
    const items = (await sb.from('items').select('id').eq('organization_id', id1)).data ?? []

    // Why the routine must be SECURITY DEFINER: a raw client can create the org row
    // (orgs_insert allows created_by = self) but CANNOT then add its own owner
    // membership — members_insert requires is_org_admin, and you're not a member yet.
    // Client-generated id so we don't need to read the row back — orgs_select would
    // deny that read (we're not a member of it yet), which is unrelated to the insert.
    const rawOrgId = crypto.randomUUID()
    const rawSlug = 'raw-' + Math.random().toString(36).slice(2, 8)
    const rawOrg = await sb.from('organizations').insert({ id: rawOrgId, name: 'Raw', slug: rawSlug, is_personal: true, created_by: uid })
    const rawOrgOk = !rawOrg.error
    const memAttempt = await sb.from('organization_members').insert({ organization_id: rawOrgId, user_id: uid, role: 'owner', is_active: true }).select()
    const membershipBlocked = Boolean(memAttempt.error) || (memAttempt.data?.length ?? 0) === 0

    return {
      beforeCount: before.length,
      afterCount: after.length,
      job1Name: job1?.name, job1Role: job1?.role, job1Personal: job1?.isPersonal,
      job2Name: job2?.name,
      orgPersonal: orgRow?.is_personal, orgCreatedByMe: orgRow?.created_by === uid,
      viewCount: views.length, itemCount: items.length,
      rawOrgOk, membershipBlocked,
    }
   } catch (e) {
     return { threw: e instanceof Error ? e.message : JSON.stringify(e) }
   }
  })

  if (r.threw) throw new Error(r.threw)
  check('started with exactly one (auto-created) org', r.beforeCount === 1)
  check('two on-demand workspaces created → three total', r.afterCount === 3)
  check('new workspace carries the given name ("Job 1")', r.job1Name === 'Job 1')
  check('whitespace in the name is trimmed ("Job 2")', r.job2Name === 'Job 2')
  check('caller is the OWNER of the new workspace', r.job1Role === 'owner')
  check('new workspace is personal (stays hidden from team surfaces)', r.job1Personal === true && r.orgPersonal === true)
  check('new workspace is created_by the caller', r.orgCreatedByMe === true)
  check('new workspace seeded all 8 system views', r.viewCount === 8)
  check('new workspace starts empty (no items)', r.itemCount === 0)
  check('positive control: a raw org row CAN be inserted (orgs_insert)', r.rawOrgOk === true)
  check('RLS refuses a raw owner-membership insert — the gap the routine bridges', r.membershipBlocked === true)
} catch (e) {
  check(`create-org test threw: ${e instanceof Error ? e.message : e}`, false)
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\n✅ CREATE-ORG (PDL-045) TEST PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
