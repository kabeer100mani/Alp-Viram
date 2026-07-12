// M1 tenant-isolation test.
// Run AFTER the migration is applied AND "Confirm email" is disabled in the
// Supabase Auth settings (dev). Creates two users in two auto-provisioned orgs
// and asserts that neither can read or write the other's data under RLS.
//
//   node scripts/m1-isolation-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envText = readFileSync(join(root, '.env'), 'utf8')
const envVars = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL = envVars.VITE_SUPABASE_URL
const KEY = envVars.VITE_SUPABASE_ANON_KEY
if (!URL || !KEY) throw new Error('Missing Supabase env vars in .env')

const rand = () => Math.random().toString(36).slice(2, 10)
const mkClient = () => createClient(URL, KEY, { auth: { persistSession: false } })

async function signUp(client, label) {
  const email = `iso_${label}_${rand()}@example.com`
  const password = 'Password123!'
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp(${label}) failed: ${error.message}`)
  if (!data.session) {
    const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password })
    if (e2 || !s.session) {
      throw new Error(
        `No session for ${label}. Disable "Confirm email" in Supabase Auth settings (dev).`,
      )
    }
  }
  return { email }
}

let failures = 0
const check = (name, pass) => {
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) failures++
}

const A = mkClient()
const B = mkClient()

const a = await signUp(A, 'a')
const b = await signUp(B, 'b')
console.log(`Created users:\n  A = ${a.email}\n  B = ${b.email}\n`)

const { data: aOrgs } = await A.from('organizations').select('id,name')
const { data: bOrgs } = await B.from('organizations').select('id,name')
check('A sees exactly 1 org (its own)', (aOrgs?.length ?? 0) === 1)
check('B sees exactly 1 org (its own)', (bOrgs?.length ?? 0) === 1)

const aOrgId = aOrgs?.[0]?.id
const bOrgId = bOrgs?.[0]?.id
check('A and B have different orgs', Boolean(aOrgId && bOrgId && aOrgId !== bOrgId))

const { data: aSeesB } = await A.from('organizations').select('id').eq('id', bOrgId)
check("A cannot read B's org row", (aSeesB?.length ?? 0) === 0)

const { data: aSeesBMembers } = await A.from('organization_members')
  .select('id')
  .eq('organization_id', bOrgId)
check("A cannot read B's memberships", (aSeesBMembers?.length ?? 0) === 0)

const aUserId = (await A.auth.getUser()).data.user?.id
const { error: insErr } = await A.from('organization_members').insert({
  organization_id: bOrgId,
  user_id: aUserId,
  role: 'member',
})
check("A cannot insert a membership into B's org (RLS blocks)", Boolean(insErr))

const { data: updData, error: updErr } = await A.from('organizations')
  .update({ name: 'hacked' })
  .eq('id', bOrgId)
  .select()
check("A cannot update B's org", (updData?.length ?? 0) === 0 || Boolean(updErr))

// ── Items isolation (M2 core domain) ─────────────────────────────────
const aUser = (await A.auth.getUser()).data.user?.id
const { data: created, error: cErr } = await A.from('items')
  .insert({ organization_id: aOrgId, title: 'A private item', type: 'task', created_by: aUser })
  .select()
  .single()
check('A can create an item in its own org', Boolean(created) && !cErr)

const { data: aItems } = await A.from('items').select('id')
check('A sees its own item(s)', (aItems?.length ?? 0) >= 1)

const { data: bSeesAItems } = await B.from('items').select('id').eq('organization_id', aOrgId)
check("B cannot read A's items", (bSeesAItems?.length ?? 0) === 0)

const { error: bInsErr } = await B.from('items').insert({
  organization_id: aOrgId,
  title: 'hack',
  type: 'task',
})
check("B cannot insert into A's org items (RLS blocks)", Boolean(bInsErr))

// ── Hardening checks (migration 0003) ────────────────────────────────
const bUser = (await B.auth.getUser()).data.user?.id
const { data: bCreated } = await B.from('items')
  .insert({ organization_id: bOrgId, title: 'B private item', type: 'task', created_by: bUser })
  .select()
  .single()
const bItemId = bCreated?.id
check('B can create an item in its own org', Boolean(bItemId))

// A tries to smuggle a child row onto B's item under A's org → composite FK blocks
const { error: smuggleErr } = await A.from('item_assigned_users').insert({
  organization_id: aOrgId,
  item_id: bItemId,
  user_id: aUser,
})
check("A cannot smuggle a child row onto B's item (composite FK blocks)", Boolean(smuggleErr))

// A tries to forge an audit event directly → client INSERT policy removed
const someAItem = aItems?.[0]?.id
const { error: forgeErr } = await A.from('activity_events').insert({
  organization_id: aOrgId,
  item_id: someAItem,
  actor_id: bUser,
  event_type: 'completed',
  payload: {},
})
check('A cannot forge activity_events directly (audit forgery blocked)', Boolean(forgeErr))

console.log(
  failures === 0
    ? '\n✅ ALL ISOLATION CHECKS PASSED'
    : `\n❌ ${failures} CHECK(S) FAILED`,
)
process.exit(failures === 0 ? 0 : 1)
