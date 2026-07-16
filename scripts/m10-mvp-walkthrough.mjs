// M6 Gate A — browser walkthrough: tag an item → filter by it; rename the org;
// switch org with no cross-org bleed; confirm the fake confidence chip is gone.
// Run with the dev server up:  npm run dev  then  node scripts/m10-mvp-walkthrough.mjs
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/\r/g, '')]),
)
// A second org is normally reached by accepting an invite (M5). Seeding one for a
// single-user walkthrough hits the members-insert chicken-and-egg (is_org_admin is
// false until you're already a member — the signup trigger solves it with SECURITY
// DEFINER). So seed the fixture through an admin DB connection, exactly as a real
// invite acceptance would leave the rows.
async function seedSecondOrg(uid) {
  const c = new pg.Client({
    host: env.PGHOST, port: +env.PGPORT, user: env.PGUSER, password: env.PGPASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  })
  await c.connect()
  const name = 'Second Workspace ' + Math.random().toString(36).slice(2, 5)
  const slug = 'second-' + Math.random().toString(36).slice(2, 8)
  const { rows } = await c.query(
    `insert into organizations (name, slug, is_personal, team_enabled, created_by)
     values ($1,$2,false,true,$3) returning id`,
    [name, slug, uid],
  )
  await c.query(
    `insert into organization_members (organization_id, user_id, role, is_active)
     values ($1,$2,'owner',true)`,
    [rows[0].id, uid],
  )
  await c.end()
  return name
}

const BASE = process.env.M3_BASE ?? 'http://localhost:5173'
const OUT = 'C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m10-shots'
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
const email = `m10_${Math.random().toString(36).slice(2, 8)}@example.com`
const title = `Prepare MIS ${Math.random().toString(36).slice(2, 6)}`
const tagName = `Client${Math.random().toString(36).slice(2, 5)}`

const signUp = async (mail) => {
  await page.getByPlaceholder('Email').fill(mail)
  await page.getByPlaceholder('Password').fill('Password123!')
  await page.getByRole('button', { name: /create account/i }).click()
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /no account\? sign up/i }).click()
  await signUp(email)

  await page.evaluate(async (t) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const sb = getSupabaseClient()
    const orgId = (await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid = (await sb.auth.getUser()).data.user.id
    await sb.from('items').insert([{ organization_id: orgId, title: t, type: 'task', state: 'committed', priority: 'none', created_by: uid }])
  }, title)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click()
  await page.getByRole('table').waitFor({ timeout: 10000 })

  // ── TD-006: no confidence chip on the AI proposal ──────────────────────────
  await page.getByPlaceholder(/capture in plain words/i).fill('Remind me to file GST return')
  await page.getByRole('button', { name: /capture/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ timeout: 45000 })
  check('AI proposal shows NO "confidence %" chip (TD-006)', !/confidence/i.test(await page.locator('body').innerText()))
  await page.getByRole('button', { name: /confirm/i }).click()
  await page.getByText(/AI proposal/i).waitFor({ state: 'hidden', timeout: 20000 })

  // ── Tag an item from the detail panel (create-inline) ──────────────────────
  await page.getByRole('button', { name: title, exact: true }).click()
  const panel = page.getByRole('dialog', { name: new RegExp(`details for ${title}`, 'i') })
  await panel.waitFor({ timeout: 10000 })
  check('panel shows a Tags field', (await panel.innerText()).includes('Tags'))

  await panel.getByRole('button', { name: 'Add a tag to this item' }).click()
  await panel.getByLabel('Tag name').fill(tagName)
  await panel.getByRole('button', { name: 'Add tag', exact: true }).click()
  await page.waitForTimeout(1500)
  check('a newly-created tag is attached (create-inline, no setup gate)', (await panel.innerText()).includes(tagName))

  // Persisted to the DB, not just the DOM.
  const tagRows = await page.evaluate(async (name) => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    const { data } = await getSupabaseClient().from('tags').select('id').eq('name', name)
    return data?.length ?? 0
  }, tagName)
  check('the tag exists in the database', tagRows === 1)

  await panel.getByRole('button', { name: 'Close', exact: true }).click()
  await page.waitForTimeout(400)

  // ── Tag chip on the row → click filters ────────────────────────────────────
  const row = page.getByRole('row').filter({ hasText: title }).first()
  const chip = row.getByRole('button', { name: new RegExp(`filter by tag ${tagName}`, 'i') })
  await chip.waitFor({ timeout: 10000 })
  check('the tag chip appears on the row', await chip.isVisible())
  await chip.click()
  await page.waitForTimeout(1200)
  check('clicking a tag opens the Tagged filter', (await page.locator('main').innerText()).includes('Tagged'))
  check('the tagged item is in the filtered result', await page.getByRole('button', { name: title, exact: true }).isVisible())
  await page.screenshot({ path: `${OUT}/1-tag-filter.png` })
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.waitForTimeout(500)

  // ── Org rename (solo admin) — the header updates ───────────────────────────
  // A solo user's OrgBar is silent until there's somewhere to switch, BUT rename
  // needs the bar visible; a solo org with team_enabled still shows the name only
  // when not solo. So flip this org to team mode via an invite first is heavy —
  // instead assert rename through the DB path already covered by the red-team, and
  // here assert the SWITCHER + name for a user who belongs to two orgs.

  // Make this user a member of a second org so the switcher must appear.
  const uid = await page.evaluate(async () => {
    const { getSupabaseClient } = await import('/src/lib/supabase/client.ts')
    return (await getSupabaseClient().auth.getUser()).data.user.id
  })
  const secondName = await seedSecondOrg(uid)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /welcome/i }).waitFor({ timeout: 20000 })

  const switcher = page.getByRole('button', { name: /switch workspace/i })
  await switcher.waitFor({ timeout: 10000 })
  check('the org switcher appears once the user has 2 orgs (PDL-009)', await switcher.isVisible())
  await switcher.click()
  check('the switcher lists the second workspace', await page.getByRole('menuitem', { name: new RegExp(secondName) }).isVisible())
  await page.screenshot({ path: `${OUT}/2-switcher.png` })

  // ── Switch org → NO cross-org bleed ────────────────────────────────────────
  await page.getByRole('menuitem', { name: new RegExp(secondName) }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('navigation', { name: /views/i }).getByRole('button', { name: 'By Role' }).click().catch(() => {})
  await page.waitForTimeout(1000)
  const afterSwitch = await page.locator('main').innerText()
  check('after switching, the first org\'s item is NOT shown (no cross-org bleed)', !afterSwitch.includes(title))
  await page.screenshot({ path: `${OUT}/3-after-switch.png` })

  // ── Rename the (team) second org — header reflects it ──────────────────────
  const renameBtn = page.getByRole('button', { name: /rename workspace/i })
  if (await renameBtn.isVisible().catch(() => false)) {
    await renameBtn.click()
    const renamed = secondName + ' Renamed'
    await page.getByLabel('Workspace name').fill(renamed)
    await page.getByLabel('Workspace name').press('Enter')
    await page.waitForTimeout(1500)
    check('org rename updates the header (admin)', (await page.locator('header, body').first().innerText()).includes('Renamed'))
  } else {
    check('org rename control present for admin', false)
  }

  check('no uncaught page errors', errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 4))
} catch (e) {
  check(`walkthrough threw: ${e instanceof Error ? e.message.split('\n')[0] : e}`, false)
  await page.screenshot({ path: `${OUT}/FAIL.png` }).catch(() => {})
} finally {
  await browser.close()
}
console.log(`\nScreenshots: ${OUT}`)
console.log(failures === 0 ? '\n✅ MVP GATE A WALKTHROUGH PASSED' : `\n❌ ${failures} STEP(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
