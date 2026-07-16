// M5 Gate B — roles + time-bounded assignments security/behaviour test.
// Proves: only admins write roles/assignments; roles/assignments cannot be
// hard-deleted (retire/close only); and a HANDOVER moves the derived responsible
// person with ZERO item rows changed — the whole point of the indirection.
//   node scripts/m5-roles-test.mjs
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
  const email = `role_${label}_${rand()}@example.com`
  const { error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  return (await c.auth.getUser()).data.user.id
}
const nowIso = () => new Date().toISOString()

// A = owner/admin. M = a plain member (added to A's org via the service role,
// simulating a completed invite).
const A = mk(), M = mk()
const aId = await signUp(A, 'admin')
const mId = await signUp(M, 'member')
const orgId = (await A.from('organizations').select('id').limit(1)).data[0].id
await svc().from('organization_members').insert({ organization_id: orgId, user_id: mId, role: 'member' })
console.log(`org=${orgId}\n  A=${aId} (admin)  M=${mId} (member)\n`)

// ── role writes are admin-only ─────────────────────────────────────────────
const { data: mRole } = await M.from('roles').insert({ organization_id: orgId, name: `X ${rand()}`, created_by: mId }).select().maybeSingle()
check('a plain member CANNOT create a role (admin-only)', !mRole)

const { data: role, error: roleErr } = await A.from('roles').insert({ organization_id: orgId, name: `Finance ${rand()}`, created_by: aId }).select().single()
check('admin CAN create a role', Boolean(role) && !roleErr)

check('members can READ the role', (await M.from('roles').select('id').eq('id', role.id)).data?.length === 1)

// ── assignment writes are admin-only ───────────────────────────────────────
const { error: mAssignErr } = await M.from('role_assignments').insert({ organization_id: orgId, role_id: role.id, user_id: mId, created_by: mId })
check('a plain member CANNOT assign themselves to a role', Boolean(mAssignErr))

const { data: assignment, error: aErr } = await A.from('role_assignments').insert({ organization_id: orgId, role_id: role.id, user_id: mId, created_by: aId }).select().single()
check('admin CAN assign the member to the role', Boolean(assignment) && !aErr)

// ── derivation: M now currently holds the role ─────────────────────────────
const { data: holds } = await M.rpc('is_current_role_holder', { p_role_id: role.id })
check('is_current_role_holder is true for the assigned member', holds === true)

// ── handover moves responsibility with ZERO item changes ───────────────────
// Give the role a responsible item, then hand the role over and confirm the
// derived responsible person changes while the item row does not.
const { data: item } = await A.from('items').insert({ organization_id: orgId, title: 'Prepare MIS', type: 'task', created_by: aId }).select().single()
await A.from('item_responsible_roles').insert({ organization_id: orgId, item_id: item.id, role_id: role.id, is_primary: true, created_by: aId })
const itemBefore = (await A.from('items').select('updated_at').eq('id', item.id).single()).data

const respBefore = (await A.rpc('current_responsible_users', { p_item_id: item.id })).data ?? []
check('derived responsible person is the member, via the role', respBefore.some((r) => r.user_id === mId))

// Hand over: close M's assignment, open one for A.
await A.from('role_assignments').update({ valid_to: nowIso() }).eq('id', assignment.id)
await A.from('role_assignments').insert({ organization_id: orgId, role_id: role.id, user_id: aId, created_by: aId })

const respAfter = (await A.rpc('current_responsible_users', { p_item_id: item.id })).data ?? []
check('after handover, derived responsible person is now A', respAfter.some((r) => r.user_id === aId) && !respAfter.some((r) => r.user_id === mId))
const itemAfter = (await A.from('items').select('updated_at').eq('id', item.id).single()).data
check('the ITEM ROW did not change during the handover (indirection works)', itemBefore.updated_at === itemAfter.updated_at)

// ── retire / close, never delete ───────────────────────────────────────────
await A.from('roles').delete().eq('id', role.id)
check('roles CANNOT be hard-deleted (retire via is_active)', (await A.from('roles').select('id').eq('id', role.id)).data?.length === 1)
await A.from('role_assignments').delete().eq('id', assignment.id)
check('role_assignments CANNOT be hard-deleted (close via valid_to)', (await A.from('role_assignments').select('id').eq('id', assignment.id)).data?.length === 1)

check('admin can retire a role (is_active=false)', (await A.from('roles').update({ is_active: false }).eq('id', role.id).select()).data?.length === 1)

console.log(failures === 0 ? '\n✅ ALL ROLE CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
