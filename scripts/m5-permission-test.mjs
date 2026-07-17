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

// A check for behaviour we KNOW is broken and have consciously deferred. It is
// reported loudly and never silently passed off as green — but it does not count
// as a regression, so the suite keeps its signal for things that genuinely break.
// If one starts passing, say so: the debt is fixed and the register is stale.
let knownFailures = 0
const expectKnownFailure = (name, pass, ref) => {
  if (pass) {
    console.log(`✅ ${name}\n     ↳ NOTE: logged as a known failure (${ref}) but PASSED — update the register.`)
  } else {
    knownFailures++
    console.log(`⚠️  ${name}\n     ↳ known failure (${ref}) — deferred, not a regression`)
  }
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

console.log('\n── UI affordance must match enforcement (writable_item_ids, M3) ──')
// The item card asks the database which items it may write, rather than
// re-implementing the rule in TypeScript where it could drift. If this ever
// disagrees with the RLS results above, the UI is lying to someone.
const { data: aCan } = await A.rpc('writable_item_ids', { p_ids: [I] })
check('A (creator) is told it CAN write — card offers actions', (aCan ?? []).includes(I))
const { data: bCan } = await B.rpc('writable_item_ids', { p_ids: [I] })
check('B (plain member) is told it CANNOT write — card offers none', (bCan ?? []).length === 0)

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
console.log('\n── TD-002: activity_events append-only (SERVICE ROLE path) ──')
// The service role holds BYPASSRLS, so RLS does not constrain it at all — this is
// the exact hole TD-002 described. Only the trigger can stop it.
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.log('   ⚠️  SKIPPED — SUPABASE_SERVICE_ROLE_KEY not in .env (trigger path unverified)')
} else {
  const S = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

  const { data: sEvents } = await S.from('activity_events')
    .select('id')
    .eq('organization_id', org)
    .limit(1)
  // Positive control: proves the key really does bypass RLS, so a blocked write
  // below is the TRIGGER doing the work — not RLS.
  //
  // This control is load-bearing: with a non-service key every check below would
  // "pass" for the wrong reason (RLS silently blocks → 0 rows / no error), which
  // is a false negative for a security test. So we abort rather than report it.
  const controlOk = (sEvents?.length ?? 0) >= 1
  check('service role bypasses RLS and can read activity_events (control)', controlOk)

  if (!controlOk) {
    console.log('   ⚠️  ABORTING the service-role checks: this key does not bypass RLS, so it')
    console.log('       is not a service_role key. Any result below would be meaningless.')
    console.log('       Get the key marked `service_role` (Dashboard → Settings → API).')
  } else {
    const evId = sEvents[0].id
    const { error: sUpd } = await S.from('activity_events')
      .update({ event_type: 'completed' })
      .eq('id', evId)
      .select()
    check('service role CANNOT update activity_events (trigger beats BYPASSRLS)', Boolean(sUpd))

    const { error: sDel } = await S.from('activity_events').delete().eq('id', evId).select()
    check('service role CANNOT delete activity_events (trigger beats BYPASSRLS)', Boolean(sDel))

    const { data: survived } = await S.from('activity_events').select('id').eq('id', evId)
    check('the audit row actually survived both attempts', (survived?.length ?? 0) === 1)

    // MUST BE LAST — destroys the test org.
    //
    // TD-007 RESOLVED (0018): org teardown now completes. 0006 fixed layer 1
    // (last-owner); 0018 fixed layer 2 (audit triggers skip logging on DELETE when
    // the org is gone) and layer 3 (the append-only guard allows the item_id SET
    // NULL — an UPDATE — when the org is gone). The live-org append-only invariant
    // is unchanged and still verified by the SERVICE-ROLE controls above.
    const { error: orgDelErr } = await S.from('organizations').delete().eq('id', org)
    check('organization delete cascades end-to-end (TD-007 fixed, 0018)', !orgDelErr)
    if (orgDelErr) console.log(`     ↳ blocked by: ${orgDelErr.message}`)
    const { data: orgGone } = await S.from('organizations').select('id').eq('id', org)
    check('the organization is actually gone', (orgGone?.length ?? 0) === 0)
    const { data: leftover } = await S.from('activity_events').select('id').eq('organization_id', org)
    check('activity_events cascaded away with the organization', (leftover?.length ?? 0) === 0)
  }
}

// Known failures do not fail the run — otherwise the suite is permanently red and
// stops signalling real regressions. They are never hidden, though: they are
// printed above and restated here.
console.log(
  failures === 0
    ? '\n✅ ALL PERMISSION CHECKS PASSED (no regressions)'
    : `\n❌ ${failures} CHECK(S) FAILED`,
)
if (knownFailures > 0) {
  console.log(`⚠️  plus ${knownFailures} KNOWN FAILURE(S) — deferred debt, see docs/technical/TECHNICAL_DEBT.md`)
  console.log('    This run is NOT fully green: organization deletion is incomplete (TD-007).')
}
process.exitCode = failures === 0 ? 0 : 1
