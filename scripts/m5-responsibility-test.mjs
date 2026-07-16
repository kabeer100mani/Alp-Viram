// M5 Gate C — responsibility-on-item security/behaviour test.
// Proves: setting an item's responsible role / assigned user follows can_write_item
// (the 0005 rule) — a member who cannot write the item cannot set its
// responsibility; and once a role is responsible, the derived current holder is
// what current_responsible_users returns (what the card shows).
//   node scripts/m5-responsibility-test.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const svc = () => createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const rand = () => Math.random().toString(36).slice(2, 10)

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
async function signUp(c, label) {
  const email = `resp_${label}_${rand()}@example.com`
  const { error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  return (await c.auth.getUser()).data.user.id
}

// A = admin/creator; M = plain member in the same org.
const A = mk(), M = mk()
const aId = await signUp(A, 'admin')
const mId = await signUp(M, 'member')
const orgId = (await A.from('organizations').select('id').limit(1)).data[0].id
await svc().from('organization_members').insert({ organization_id: orgId, user_id: mId, role: 'member' })

// A role, and A's item that M cannot write.
const role = (await A.from('roles').insert({ organization_id: orgId, name: `Finance ${rand()}`, created_by: aId }).select().single()).data
const item = (await A.from('items').insert({ organization_id: orgId, title: 'Prepare MIS', type: 'task', created_by: aId }).select().single()).data
console.log(`org=${orgId}  role=${role.id}  item=${item.id}\n`)

// ── writer-only: M cannot set responsibility on an item it can't write ──────
const { error: mRoleErr } = await M.from('item_responsible_roles').insert({ organization_id: orgId, item_id: item.id, role_id: role.id, is_primary: true, created_by: mId })
check('a member who cannot write the item CANNOT set its responsible role', Boolean(mRoleErr))
const { error: mAssignErr } = await M.from('item_assigned_users').insert({ organization_id: orgId, item_id: item.id, user_id: mId, created_by: mId })
check('a member who cannot write the item CANNOT assign a user to it', Boolean(mAssignErr))

// ── the creator can ─────────────────────────────────────────────────────────
const { error: aRoleErr } = await A.from('item_responsible_roles').insert({ organization_id: orgId, item_id: item.id, role_id: role.id, is_primary: true, created_by: aId })
check('the creator CAN set the responsible role', !aRoleErr)

// Nobody holds the role yet → derived responsible is empty → card shows UNFILLED.
const empty = (await A.rpc('current_responsible_users', { p_item_id: item.id })).data ?? []
check('with no assignment, derived responsible is empty (card shows UNFILLED)', empty.length === 0)

// Assign M to the role → now M is the derived current holder of A's item.
await A.from('role_assignments').insert({ organization_id: orgId, role_id: role.id, user_id: mId, created_by: aId })
const holders = (await A.rpc('current_responsible_users', { p_item_id: item.id })).data ?? []
check('assigning the role surfaces the holder as the item\'s derived responsible', holders.some((h) => h.user_id === mId))

// ── once responsible, M CAN write the item (the whole point) ─────────────────
const { data: mEdit } = await M.from('items').update({ title: 'Prepare MIS (edited)' }).eq('id', item.id).select()
check('the derived responsible member CAN now write the item', (mEdit?.length ?? 0) === 1)

// And the affordance RPC agrees the card should offer M actions.
const { data: mWritable } = await M.rpc('writable_item_ids', { p_ids: [item.id] })
check('writable_item_ids now includes the item for M (card offers actions)', (mWritable ?? []).includes(item.id))

console.log(failures === 0 ? '\n✅ ALL RESPONSIBILITY CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
