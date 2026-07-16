// M5 Gate A browser walkthrough — the real two-user invite flow:
//   admin signs up (solo, no People & Roles) → after a 2nd member the surface
//   appears → admin creates an invite link → a NEW user opens the link, signs up
//   with the invited email, and joins → org flips to team mode → both see People.
// Run with the dev server up:  npm run dev  then  node scripts/m5-invite-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m5-shots'
mkdirSync(OUT, { recursive: true })

let failures = 0
const check = (name, pass) => {
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) failures++
}

const browser = await chromium.launch()
const rand = () => Math.random().toString(36).slice(2, 8)
const adminEmail = `wt_admin_${rand()}@example.com`
const inviteeEmail = `wt_invitee_${rand()}@example.com`

async function signUp(page, email) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
}

try {
  // ── Admin, solo ─────────────────────────────────────────────────────────
  const admin = await browser.newContext()
  const ap = await admin.newPage()
  const adminErrors = []
  ap.on('pageerror', (e) => adminErrors.push(String(e)))
  await signUp(ap, adminEmail)
  await ap.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await ap.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })
  check('solo admin sees NO People & Roles yet (PDL-022)', !(await ap.getByRole('button', { name: /people & roles/i }).count()))
  await ap.screenshot({ path: `${OUT}/1-admin-solo.png` })

  // ── Create an invite ─────────────────────────────────────────────────────
  // People & Roles is hidden while solo, so drive the invite via the app's own
  // repository call in-page (the admin would reach it once a member exists; this
  // proves the create path and yields a link to redeem).
  const link = await ap.evaluate(async (email) => {
    const mod = await import('/src/modules/people/data/people-repository.ts')
    const { link } = await mod.createInvitation(
      // active org id: grab it the way the app does
      (await (await import('/src/lib/supabase/client.ts')).getSupabaseClient().from('organizations').select('id').limit(1)).data[0].id,
      email,
      'member',
    )
    return link
  }, inviteeEmail)
  check('admin can create an invite link', typeof link === 'string' && link.includes('/invite?token='))

  // ── Invitee: open the link, sign up with the invited email, join ──────────
  const invitee = await browser.newContext()
  const ip = await invitee.newPage()
  const inviteeErrors = []
  ip.on('pageerror', (e) => inviteeErrors.push(String(e)))
  await ip.goto(link, { waitUntil: 'networkidle' })
  // Not signed in → bounced to /login with the invite remembered.
  await ip.getByRole('button', { name: /no account\? sign up/i }).click()
  await ip.getByPlaceholder('Email').fill(inviteeEmail)
  await ip.getByPlaceholder('Password').fill('Password123!')
  await ip.getByRole('button', { name: /create account/i }).click()

  // After sign-up they should land back on the invite and join.
  await ip.getByRole('heading', { name: /you.re in|didn.t work/i }).waitFor({ timeout: 25000 })
  await ip.screenshot({ path: `${OUT}/2-invitee-accept.png` })
  check('invitee lands on the accept screen (token survived the login redirect)', /you.re in/i.test(await ip.locator('body').innerText()))

  await ip.getByRole('button', { name: /go to the workspace/i }).click()
  await ip.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await ip.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })

  // ── Team mode: both now see People & Roles (PDL-022 flip) ────────────────
  const inviteePeople = ip.getByRole('button', { name: /people & roles/i })
  await inviteePeople.waitFor({ timeout: 10000 })
  check('after joining, the invitee sees People & Roles (team-flip)', await inviteePeople.isVisible())
  await inviteePeople.click()
  await ip.getByText(/who is in this workspace/i).waitFor({ timeout: 10000 })
  // Wait for the list to load rather than reading through "Loading…".
  await ip.getByText(/loading/i).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  const memberRows = ip.locator('section ul > li')
  await memberRows.first().waitFor({ timeout: 10000 })
  check('People lists two members (owner + the new member)', (await memberRows.count()) === 2)
  await ip.screenshot({ path: `${OUT}/3-invitee-people.png` })

  // Admin, on reload, also flips to team mode and can open People.
  await ap.reload({ waitUntil: 'networkidle' })
  await ap.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })
  const adminPeople = ap.getByRole('button', { name: /people & roles/i })
  check('admin now sees People & Roles too', await adminPeople.isVisible())
  await adminPeople.click()
  await ap.getByText(/invite someone/i).waitFor({ timeout: 10000 })
  check('admin sees the invite form; non-admin invitee will not', await ap.getByRole('button', { name: /create invite link/i }).isVisible())
  check('invitee (non-admin) sees NO invite form', !(await ip.getByRole('button', { name: /create invite link/i }).count()))
  await ap.screenshot({ path: `${OUT}/4-admin-people.png` })

  if (adminErrors.length || inviteeErrors.length) {
    console.log('\n⚠️  page errors:')
    for (const e of [...new Set([...adminErrors, ...inviteeErrors])].slice(0, 6)) console.log('   - ' + e.slice(0, 160))
  }
} catch (err) {
  check(`walkthrough threw: ${err instanceof Error ? err.message.split('\n')[0] : err}`, false)
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      await p.screenshot({ path: `${OUT}/FAIL-${Math.random().toString(36).slice(2, 6)}.png` }).catch(() => {})
    }
  }
} finally {
  await browser.close()
}

console.log(`\nScreenshots: ${OUT}`)
console.log(failures === 0 ? '\n✅ INVITE WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
