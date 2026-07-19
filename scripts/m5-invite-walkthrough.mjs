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
  await ap.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await ap.waitForTimeout(600)
  await ap.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })
  check('solo admin sees NO People & Roles yet (PDL-022)', !(await ap.getByRole('button', { name: /people & roles/i }).count()))
  // Gate C: the solo-invite escape hatch — the one team action a solo user needs.
  check('solo admin DOES see "Invite a teammate" (no deadlock)', await ap.getByRole('button', { name: /invite a teammate/i }).isVisible())
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
  await ip.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await ip.waitForTimeout(600)
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
  await ap.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await ap.waitForTimeout(600)
  await ap.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })
  const adminPeople = ap.getByRole('button', { name: /people & roles/i })
  check('admin now sees People & Roles too', await adminPeople.isVisible())
  await adminPeople.click()
  await ap.getByText(/invite someone/i).waitFor({ timeout: 10000 })
  check('admin sees the invite form; non-admin invitee will not', await ap.getByRole('button', { name: /create invite link/i }).isVisible())
  check('invitee (non-admin) sees NO invite form', !(await ip.getByRole('button', { name: /create invite link/i }).count()))
  await ap.screenshot({ path: `${OUT}/4-admin-people.png` })

  // ── Gate B: roles + assignment + handover ─────────────────────────────────
  const roleName = `Finance ${rand()}`
  await ap.getByLabel(/new role name/i).fill(roleName)
  await ap.getByRole('button', { name: /add role/i }).click()
  const roleRow = ap.locator('li', { hasText: roleName })
  await roleRow.waitFor({ timeout: 10000 })
  check('admin can create a role', await roleRow.isVisible())
  check('a new role shows "UNFILLED — needs owner"', /unfilled/i.test(await roleRow.innerText()))

  // Assign the invitee to the role.
  await roleRow.getByLabel(new RegExp(`assign someone to ${roleName}`, 'i')).click()
  await ap.getByRole('option').nth(1).click()
  await roleRow.getByRole('button', { name: /^assign$/i }).click()
  await ap.waitForTimeout(1500)
  check('after assigning, the role is no longer unfilled', !/unfilled/i.test(await roleRow.innerText()))
  await ap.screenshot({ path: `${OUT}/5-roles.png` })

  // Gate C: rename the role in place. Note: once editing, the name lives in an
  // input VALUE (not text), so the row's hasText locator no longer matches — use
  // page-level locators for the edit controls.
  await roleRow.getByRole('button', { name: new RegExp(`rename ${roleName}`, 'i') }).click()
  const renamed = `${roleName} renamed`
  await ap.getByLabel(new RegExp(`rename ${roleName}`, 'i')).fill(renamed)
  await ap.getByRole('button', { name: /^save$/i }).click()
  await ap.getByText(renamed).waitFor({ timeout: 10000 })
  check('admin can rename a role in place', await ap.getByText(renamed).isVisible())

  // The non-admin sees roles read-only: no Add-role, no Assign controls.
  await ip.getByRole('button', { name: /people & roles/i }).click()
  await ip.getByText(/durable responsibilities/i).waitFor({ timeout: 10000 })
  check('member sees roles read-only (no "Add role")', !(await ip.getByRole('button', { name: /add role/i }).count()))
  check('member cannot assign (no Assign control)', !(await ip.getByRole('button', { name: /^assign$/i }).count()))

  // ── Gate C: responsibility on an item + By Role populates ─────────────────
  // Create an item directly (avoids depending on live AI), then set its
  // responsible role from the card and confirm the By Role view groups it.
  const itemTitle = `MIS ${rand()}`
  await ap.evaluate(async ({ title }) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    await sb.from('items').insert({ organization_id: orgId, title, type: 'task', state: 'committed', created_by: uid })
  }, { title: itemTitle })

  await ap.getByRole('button', { name: 'Today' }).click().catch(() => {})
  // The item is committed with no due date → it shows in Upcoming/By Role; open By Role.
  await ap.getByRole('button', { name: 'By Role' }).click()
  await ap.getByText(itemTitle).first().waitFor({ timeout: 10000 })
  check('a new item starts under "Unassigned" in By Role', /unassigned/i.test(await ap.locator('section').last().innerText()))

  // Set its responsible role from the card.
  await ap.getByRole('button', { name: /responsibility for this item/i }).first().click()
  const roleSelect = ap.getByLabel('Responsible role').first()
  await roleSelect.waitFor({ timeout: 10000 })
  await roleSelect.click()
  await ap.getByRole('option', { name: renamed, exact: true }).click()
  await ap.waitForTimeout(1500)
  await ap.reload({ waitUntil: 'networkidle' })
  await ap.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await ap.waitForTimeout(600)
  await ap.getByRole('navigation', { name: /views/i }).waitFor({ timeout: 15000 })
  await ap.getByRole('button', { name: 'By Role' }).click()
  await ap.getByText(renamed).first().waitFor({ timeout: 10000 })
  check('after setting a responsible role, the item groups under that role in By Role', await ap.getByText(renamed).first().isVisible())
  await ap.screenshot({ path: `${OUT}/6-by-role.png` })

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
