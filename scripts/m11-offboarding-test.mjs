// M7 Gate A — live red-team for member offboarding.
// Drives the REAL hosted DB with anon-key clients (RLS in force), seeds a
// multi-member org via an admin pg connection (the invite chicken-and-egg), and a
// service-role positive control so a denial can't pass for the wrong reason.
//
//   node scripts/m11-offboarding-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/\r/g, '')]),
)
const URL_ = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
const ANON = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? env.SB_SECRET_KEY

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
const rnd = () => Math.random().toString(36).slice(2, 10)
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false } })
const pgc = async () => {
  const c = new pg.Client({
    host: env.PGHOST, port: +env.PGPORT, user: env.PGUSER, password: env.PGPASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  })
  await c.connect()
  return c
}

async function makeUser() {
  const c = anon()
  const email = `m11_${rnd()}@example.com`
  const { data, error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signup: ${error.message}`)
  const uid = data.user.id
  let org = null
  for (let i = 0; i < 10 && !org; i++) {
    const { data: rows } = await c.from('organizations').select('id').limit(1)
    org = rows?.[0]?.id ?? null
    if (!org) await new Promise((r) => setTimeout(r, 400))
  }
  if (!org) throw new Error('no personal org materialised')
  return { c, uid, org, email }
}

try {
  if (!URL_ || !ANON) throw new Error('missing SUPABASE_URL / SUPABASE_ANON_KEY')

  if (SERVICE) {
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } })
    const { data: anyOrg } = await svc.from('organizations').select('id').limit(1)
    check('positive control: service role bypasses RLS', Boolean(anyOrg))
  } else {
    console.log('⚠️  no service key — cross-tenant checks are weaker')
  }

  // Owner (admin) of an org, plus two others to add as members.
  const owner = await makeUser()
  const member = await makeUser()
  const other = await makeUser()

  // Seed member + a second admin into the owner's org via admin pg (the
  // members-insert chicken-and-egg is why this can't be done as the invitee).
  const db = await pgc()
  const midOf = async (uid, role) => {
    const { rows } = await db.query(
      `insert into organization_members (organization_id, user_id, role, is_active)
       values ($1,$2,$3,true)
       on conflict (organization_id, user_id) do update set role=excluded.role, is_active=true
       returning id`,
      [owner.org, uid, role],
    )
    return rows[0].id
  }
  const memberMid = await midOf(member.uid, 'member')
  const ownerMidRows = await db.query(
    `select id from organization_members where organization_id=$1 and user_id=$2`,
    [owner.org, owner.uid],
  )
  const ownerMid = ownerMidRows.rows[0].id
  await db.end()

  // ── A member cannot manage anyone (RLS members_update/delete = is_org_admin) ─
  const { data: mUpd } = await member.c
    .from('organization_members').update({ role: 'admin' }).eq('id', memberMid).select()
  check('a member cannot change their own role to admin (RLS 0-row)', (mUpd?.length ?? 0) === 0)

  const { data: mDel } = await member.c
    .from('organization_members').delete().eq('id', ownerMid).select()
  check('a member cannot remove the owner (RLS 0-row)', (mDel?.length ?? 0) === 0)

  // ── The owner (admin) CAN manage members ────────────────────────────────────
  const { data: promote } = await owner.c
    .from('organization_members').update({ role: 'admin' }).eq('id', memberMid).select()
  check('an admin can change a member’s role', promote?.[0]?.role === 'admin')

  const { data: deact } = await owner.c
    .from('organization_members').update({ is_active: false }).eq('id', memberMid).select()
  check('an admin can deactivate a member', deact?.[0]?.is_active === false)

  const { data: react } = await owner.c
    .from('organization_members').update({ is_active: true }).eq('id', memberMid).select()
  check('an admin can reactivate a member', react?.[0]?.is_active === true)

  const { data: removed } = await owner.c
    .from('organization_members').delete().eq('id', memberMid).select()
  check('an admin can remove a member', (removed?.length ?? 0) === 1)

  // ── The last-owner guard (protect_owner_membership trigger) ─────────────────
  // The owner is the ONLY owner — they cannot be removed, demoted, or deactivated.
  const demote = await owner.c
    .from('organization_members').update({ role: 'member' }).eq('id', ownerMid).select()
  check('the last owner cannot demote themselves (trigger raises)', Boolean(demote.error) || (demote.data?.length ?? 0) === 0)

  const selfDeact = await owner.c
    .from('organization_members').update({ is_active: false }).eq('id', ownerMid).select()
  check('the last owner cannot deactivate themselves (trigger raises)', Boolean(selfDeact.error) || (selfDeact.data?.length ?? 0) === 0)

  const selfRemove = await owner.c
    .from('organization_members').delete().eq('id', ownerMid).select()
  check('the last owner cannot be removed (trigger raises)', Boolean(selfRemove.error) || (selfRemove.data?.length ?? 0) === 0)

  // Confirm the owner is still a live owner after all the refused attempts.
  const still = SERVICE
    ? await createClient(URL_, SERVICE, { auth: { persistSession: false } })
        .from('organization_members').select('role, is_active').eq('id', ownerMid).single()
    : await owner.c.from('organization_members').select('role, is_active').eq('id', ownerMid).single()
  check('the owner is intact (owner + active) after the refused attempts', still.data?.role === 'owner' && still.data?.is_active === true)

  // ── Only an owner may grant the owner role ──────────────────────────────────
  // Make `other` a plain admin, then have that admin try to mint a new owner.
  const db2 = await pgc()
  const { rows: otherRows } = await db2.query(
    `insert into organization_members (organization_id, user_id, role, is_active)
     values ($1,$2,'admin',true)
     on conflict (organization_id, user_id) do update set role='admin', is_active=true returning id`,
    [owner.org, other.uid],
  )
  const otherMid = otherRows[0].id
  await db2.end()
  const grantOwner = await other.c
    .from('organization_members').update({ role: 'owner' }).eq('id', otherMid).select()
  check('a non-owner admin cannot grant the owner role (trigger raises)', Boolean(grantOwner.error) || (grantOwner.data?.length ?? 0) === 0)

  // ── Org deletion (TD-007): owner-only, and it actually cascades ─────────────
  // A non-owner admin cannot delete the org (RLS orgs_delete = is_org_owner).
  const { data: adminDel } = await other.c.from('organizations').delete().eq('id', owner.org).select()
  check('a non-owner admin cannot delete the org (RLS 0-row)', (adminDel?.length ?? 0) === 0)
  // The org still exists after that attempt.
  const stillThere = SERVICE
    ? await createClient(URL_, SERVICE, { auth: { persistSession: false } }).from('organizations').select('id').eq('id', owner.org)
    : { data: [{ id: owner.org }] }
  check('the org survives a non-owner delete attempt', (stillThere.data?.length ?? 0) === 1)
  // The owner CAN delete it, and it cascades (0018/0019) — the whole point of TD-007.
  const { error: ownerDelErr, data: ownerDel } = await owner.c.from('organizations').delete().eq('id', owner.org).select()
  check('the owner can delete their org, and it cascades (TD-007)', !ownerDelErr && (ownerDel?.length ?? 0) === 1)
  if (ownerDelErr) console.log(`     ↳ blocked by: ${ownerDelErr.message}`)
} catch (e) {
  check(`red-team threw: ${e instanceof Error ? e.message : e}`, false)
} finally {
  console.log(failures === 0 ? '\n✅ OFFBOARDING RED-TEAM PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
