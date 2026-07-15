// Permission Model red-team test (migration 0005).
// Proves access control is keyed to the hybrid responsibility model, that
// history-bearing rows cannot be hard-deleted, and that responsibility is
// TIME-BOUNDED (closing a role assignment revokes access).
//
// Run AFTER 0005 is applied, with "Confirm email" disabled (dev):
//   node scripts/m5-permission-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } })
const rand = () => Math.random().toString(36).slice(2, 10)

let failures = 0
const check = (name, pass) => {
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) failures++
}

async function signUp(client, label) {
  const email = `perm_${label}_${rand()}@example.com`
  const { error } = await client.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  return (await client.auth.getUser()).data.user.id
}

// An UPDATE blocked by RLS is not an error — it silently affects 0 rows.
const updatedRows = async (client, id, patch) => {
  const { data, error } = await client.from('items').update(patch).eq('id', id).select()
  return error ? 0 : (data?.length ?? 0)
}

const A = mk()
const B = mk()
const aId = await signUp(A, 'a')
const bId = await signUp(B, 'b')

const { data: aOrgs } = await A.from('organizations').select('id')
const org = aOrgs[0].id

// A (owner/admin of its personal org) admits B as a plain member.
const { error: memErr } = await A.from('organization_members').insert({
  organization_id: org,
  user_id: bId,
  role: 'member',
})
if (memErr) throw new Error(`could not add B to A's org: ${memErr.message}`)
console.log(`org=${org}\n  A=${aId} (owner)\n  B=${bId} (member)\n`)

// A captures an item. Per PDL-021 it has NO responsible role and no assignee.
const { data: item, error: itemErr } = await A.from('items')
  .insert({ organization_id: org, title: 'A private capture', type: 'task', created_by: aId })
  .select()
  .single()
if (itemErr) throw new Error(`A could not create item: ${itemErr.message}`)
const I = item.id

console.log('── Baseline: unassigned item (0 responsible roles — PDL-021) ──')
check('A (creator) can update its own capture', (await updatedRows(A, I, { title: 'edited by A' })) === 1)
check('B (plain member) CANNOT update A\'s capture', (await updatedRows(B, I, { title: 'hacked by B' })) === 0)

console.log('\n── Escalation attempts ──')
const { error: selfAssignErr } = await B.from('item_assigned_users').insert({
  organization_id: org, item_id: I, user_id: bId,
})
check('B CANNOT self-assign to gain write (would bypass the whole model)', Boolean(selfAssignErr))

const { error: selfRoleErr } = await B.from('item_responsible_roles').insert({
  organization_id: org, item_id: I, role_id: '00000000-0000-0000-0000-000000000000',
})
check('B CANNOT attach a responsible role to gain write', Boolean(selfRoleErr))

const { error: cbErr } = await A.from('items').update({ created_by: bId }).eq('id', I).select()
check('created_by is immutable (no laundering attribution)', Boolean(cbErr))

console.log('\n── Execution axis: assigned user ──')
const { error: assignErr } = await A.from('item_assigned_users').insert({
  organization_id: org, item_id: I, user_id: bId, is_primary: true,
})
check('A (creator) can assign B', !assignErr)
check('B (now assigned) CAN update', (await updatedRows(B, I, { title: 'edited by assignee B' })) === 1)

await A.from('item_assigned_users').delete().eq('item_id', I).eq('user_id', bId)
check('B (unassigned again) CANNOT update', (await updatedRows(B, I, { title: 'B again' })) === 0)

console.log('\n── Responsibility axis: derived via role (TDL-012) ──')
const { data: role, error: roleErr } = await A.from('roles')
  .insert({ organization_id: org, name: `Finance ${rand()}`, created_by: aId })
  .select()
  .single()
check('A (admin) can create a role', !roleErr && Boolean(role))

const { data: ra } = await A.from('role_assignments')
  .insert({ organization_id: org, role_id: role.id, user_id: bId, created_by: aId })
  .select()
  .single()
check('A (admin) can assign B to the role', Boolean(ra))

const { error: irrErr } = await A.from('item_responsible_roles').insert({
  organization_id: org, item_id: I, role_id: role.id, is_primary: true, created_by: aId,
})
check('A can make the role responsible for the item', !irrErr)
check('B CAN update — responsibility DERIVED through the role', (await updatedRows(B, I, { title: 'edited via role' })) === 1)

// The whole point of the indirection: close the assignment, access ends. No
// item row changes.
await A.from('role_assignments').update({ valid_to: new Date().toISOString() }).eq('id', ra.id)
check('B CANNOT update after their role assignment is closed (time-bounded)', (await updatedRows(B, I, { title: 'after handover' })) === 0)

console.log('\n── TD-001: history-bearing rows cannot be hard-deleted ──')
await B.from('items').delete().eq('id', I)
const { data: stillThereB } = await A.from('items').select('id').eq('id', I)
check('B CANNOT hard-delete the item', (stillThereB?.length ?? 0) === 1)

await A.from('items').delete().eq('id', I)
const { data: stillThereA } = await A.from('items').select('id').eq('id', I)
check('even A (creator/admin) CANNOT hard-delete — soft-delete only', (stillThereA?.length ?? 0) === 1)

check('A CAN soft-delete (deleted_at)', (await updatedRows(A, I, { deleted_at: new Date().toISOString() })) === 1)

await A.from('roles').delete().eq('id', role.id)
const { data: roleStill } = await A.from('roles').select('id').eq('id', role.id)
check('roles CANNOT be hard-deleted (retire via is_active)', (roleStill?.length ?? 0) === 1)

await A.from('role_assignments').delete().eq('id', ra.id)
const { data: raStill } = await A.from('role_assignments').select('id').eq('id', ra.id)
check('role_assignments CANNOT be hard-deleted (close via valid_to)', (raStill?.length ?? 0) === 1)

console.log('\n── TD-002: activity_events append-only (client surface) ──')
const { data: events } = await A.from('activity_events').select('id').eq('organization_id', org).limit(1)
check('audit still logs (triggers unaffected by hardening)', (events?.length ?? 0) >= 1)
if (events?.length) {
  const { data: upd } = await A.from('activity_events').update({ event_type: 'completed' }).eq('id', events[0].id).select()
  check('client CANNOT update activity_events', (upd?.length ?? 0) === 0)
  await A.from('activity_events').delete().eq('id', events[0].id)
  const { data: evStill } = await A.from('activity_events').select('id').eq('id', events[0].id)
  check('client CANNOT delete activity_events', (evStill?.length ?? 0) === 1)
}
console.log('   (note: the service-role path is guarded by the trigger and is not exercised here —')
console.log('    no service key is available locally.)')

console.log(
  failures === 0
    ? '\n✅ ALL PERMISSION CHECKS PASSED'
    : `\n❌ ${failures} CHECK(S) FAILED`,
)
process.exitCode = failures === 0 ? 0 : 1
