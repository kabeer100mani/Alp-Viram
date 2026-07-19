// M7 Gate A — browser walkthrough: Meeting type gone; member offboarding UI;
// password-reset request + reset page. Run with the dev server up:
//   npm run dev  then  node scripts/m11-lifecycle-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/\r/g, '')]),
)
const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m11-shots'
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
const rnd = () => Math.random().toString(36).slice(2, 8)
const email = `m11_${rnd()}@example.com`
const pw = 'Password123!'

const db = async () => {
  const c = new pg.Client({
    host: env.PGHOST, port: +env.PGPORT, user: env.PGUSER, password: env.PGPASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  })
  await c.connect()
  return c
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(pw)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  // ── Meeting is gone from capture (PDL-039) ─────────────────────────────────
  await page.getByRole('button', { name: 'Quick capture' }).click()
  await page.getByRole('dialog').getByPlaceholder(/capture in plain words/i).fill('Sync with the finance team about Q3')
  await page.getByRole('dialog').getByRole('button', { name: /^capture$/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  const typeSelect = page.getByLabel('Item type')
  const typeOptions = await typeSelect.locator('option').allInnerTexts()
  check('capture type options are Task/Note only — no Meeting (PDL-039)', !typeOptions.map((s) => s.toLowerCase()).includes('meeting'))
  // Even a meeting-ish capture is never classified as a Meeting.
  check('the AI proposal is not a Meeting', !/meeting/i.test(await typeSelect.innerText()))
  await page.getByRole('button', { name: /confirm/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ state: 'hidden', timeout: 20000 })

  // ── Member offboarding UI (needs a team) ───────────────────────────────────
  // Flip this solo org to a team and add a second member via admin pg, so People
  // & Roles is reachable and there's someone to offboard.
  const uid = await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    return (await getSupabaseClient().auth.getUser()).data.user.id
  })
  const orgId = await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    return (await getSupabaseClient().from('organizations').select('id').limit(1)).data[0].id
  })
  const c = await db()
  await c.query(`update organizations set team_enabled=true, is_personal=false where id=$1`, [orgId])
  // A second profile + membership to manage. Needs a real auth user for the FK.
  const teammateEmail = `mate_${rnd()}@example.com`
  // Create the auth user via admin API through PostgREST is not available here;
  // instead insert a profile row directly (profiles FK is to auth.users, so we
  // need a real auth id). Use the invitations path is heavy — simplest: create the
  // teammate through the anon signup in a second context, then add membership.
  await c.end()

  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.goto(BASE, { waitUntil: 'networkidle' })
  await page2.getByRole('button', { name: /no account\? sign up/i }).click()
  await page2.getByPlaceholder('Email').fill(teammateEmail)
  await page2.getByPlaceholder('Password').fill(pw)
  await page2.getByRole('button', { name: /create account/i }).click()
  await page2.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  const mateUid = await page2.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    return (await getSupabaseClient().auth.getUser()).data.user.id
  })
  await ctx2.close()

  const c2 = await db()
  await c2.query(
    `insert into organization_members (organization_id, user_id, role, is_active)
     values ($1,$2,'member',true) on conflict do nothing`,
    [orgId, mateUid],
  )
  await c2.end()

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Capture', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: /people & roles/i }).click()
  await page.waitForTimeout(1200)

  const mateName = teammateEmail.split('@')[0]
  // Scope to the Members list (the rail also renders <li>s). The member row is the
  // one that isn't "(you)" — a stable anchor even while the name is momentarily
  // hidden (deactivating a member ends the shared-active-org that lets the admin
  // read their profile, so the row reads "Member (Deactivated)" until reactivated).
  const membersList = page.getByRole('list', { name: 'Members' })
  const mateRow = () => membersList.getByRole('listitem').filter({ hasNotText: '(you)' }).first()
  await mateRow().waitFor({ timeout: 10000 })
  check('the teammate appears in the members list', (await mateRow().innerText()).includes(mateName))
  check('an admin sees a role control for the member', await mateRow().getByLabel(/^role for/i).isVisible())
  await page.screenshot({ path: `${OUT}/1-members.png` })

  // Deactivate → the control flips to Reactivate + a Deactivated badge appears.
  await mateRow().getByRole('button', { name: 'Deactivate', exact: true }).click()
  await mateRow().getByRole('button', { name: 'Reactivate', exact: true }).waitFor({ timeout: 10000 })
  check('deactivating a member flips the control to Reactivate', (await mateRow().innerText()).includes('Deactivated'))

  // Reactivate → the person is active again (and their name is readable once more).
  await mateRow().getByRole('button', { name: 'Reactivate', exact: true }).click()
  await mateRow().getByRole('button', { name: 'Deactivate', exact: true }).waitFor({ timeout: 10000 })
  check('reactivating restores the member (name visible again)', (await mateRow().innerText()).includes(mateName))

  // Remove (two-step confirm) → the members list is just you.
  await mateRow().getByRole('button', { name: 'Remove', exact: true }).click()
  await mateRow().getByRole('button', { name: 'Yes', exact: true }).click()
  await page.waitForTimeout(1500)
  check('removing a member drops them from the list', (await membersList.getByRole('listitem').count()) === 1)

  // Your own row offers no self-management controls.
  const selfRow = page.getByRole('listitem').filter({ hasText: '(you)' })
  check('your own row has no Remove control (no self-lockout)', !(await selfRow.getByRole('button', { name: 'Remove', exact: true }).count()))
  await page.screenshot({ path: `${OUT}/1-offboarding.png` })

  // ── Danger zone: delete-workspace confirm gate (owner-only) — NON-destructive ─
  // The delete MECHANISM (owner-only, cascade) is covered by the red-team; here we
  // only verify the type-to-confirm gate renders and gates, then CANCEL.
  check('owner sees a Danger zone', (await page.getByText('Danger zone').count()) > 0)
  await page.getByRole('button', { name: 'Delete workspace', exact: true }).click()
  const confirmBtn = page.getByRole('button', { name: 'Delete this workspace', exact: true })
  await confirmBtn.waitFor({ timeout: 5000 })
  check('the delete button is disabled before the name is typed', await confirmBtn.isDisabled())
  await page.getByLabel(/type the workspace name to confirm/i).fill('wrong name')
  check('the delete button stays disabled on a wrong name', await confirmBtn.isDisabled())
  await page.getByLabel(/type the workspace name to confirm/i).fill('My Workspace')
  check('the delete button enables only when the exact name matches', !(await confirmBtn.isDisabled()))
  await page.getByRole('button', { name: 'Cancel', exact: true }).click() // do NOT delete

  // ── Password reset — request shows a generic message (no enumeration) ───────
  await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    await getSupabaseClient().auth.signOut()
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /forgot password/i }).click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByRole('button', { name: /send reset link/i }).click()
  await page.waitForTimeout(1000)
  const resetMsg = (await page.locator('body').innerText()).toLowerCase()
  check('reset request shows a generic "if an account exists" message', resetMsg.includes('if an account exists'))
  check('reset request does NOT confirm the email is registered', !/we have sent|account found|email sent to your/i.test(resetMsg))
  await page.screenshot({ path: `${OUT}/2-reset-request.png` })

  // ── Reset page with no recovery session → invalid/expired ──────────────────
  await page.goto(`${BASE}/reset-password`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  check('reset page with no session shows invalid/expired', /invalid or has expired/i.test(await page.locator('body').innerText()))

  // ── Reset page WITH a session → set new password, then sign in with it ──────
  // Any session (not just recovery) authorises updateUser; sign in to get one, then
  // drive the reset page exactly as the emailed link would after establishing one.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(pw)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  const newPw = 'NewPassword456!'
  await page.goto(`${BASE}/reset-password`, { waitUntil: 'networkidle' })
  await page.getByLabel('New password').waitFor({ timeout: 10000 })
  await page.getByLabel('New password').fill(newPw)
  await page.getByRole('button', { name: /update password/i }).click()
  await page.waitForTimeout(2000)

  await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    await getSupabaseClient().auth.signOut()
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(newPw)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  check('the new password works — signed in after reset', await page.getByRole('heading', { name: /welcome/i }).isVisible())

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(`\nScreenshots: ${OUT}`)
console.log(failures === 0 ? '\n✅ LIFECYCLE WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
