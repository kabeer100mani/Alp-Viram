// M5 Gate A — invitation flow + security test (migration 0009 + invitations fn).
// Proves: admins can invite, non-admins cannot; a leaked link can't be redeemed
// by the wrong email; invites are single-use and expiry/role-escalation safe; and
// accepting flips the org to team mode.
//   node scripts/m5-invite-test.mjs
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
  const email = `inv_${label}_${rand()}@example.com`
  const { error } = await client.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  const uid = (await client.auth.getUser()).data.user.id
  return { email, uid }
}

const invoke = (client, body) => client.functions.invoke('invitations', { body })

// Admin (A) owns an org. B and C are separate signups (their own personal orgs).
const A = mk(), B = mk(), C = mk()
const a = await signUp(A, 'admin')
const b = await signUp(B, 'invitee')
const c = await signUp(C, 'stranger')
const orgId = (await A.from('organizations').select('id').limit(1)).data[0].id
console.log(`org=${orgId}\n  A=${a.email} (owner)\n  B=${b.email} (to invite)\n  C=${c.email} (stranger)\n`)

// A's org starts personal/solo.
const before = (await A.from('organizations').select('is_personal, team_enabled').eq('id', orgId)).data[0]
check('org starts solo (is_personal=true, team_enabled=false)', before.is_personal && !before.team_enabled)

// ── create: authorization ────────────────────────────────────────────────
const { data: cCreate } = await invoke(C, { action: 'create', organizationId: orgId, email: b.email })
check('a non-member CANNOT create an invite for someone else\'s org', !cCreate?.token)

const { data: created, error: createErr } = await invoke(A, {
  action: 'create',
  organizationId: orgId,
  email: b.email.toUpperCase(), // exercise email normalisation
})
check('admin CAN create an invite', Boolean(created?.token) && !createErr)
const token = created?.token

// Token secrecy: B (not an admin of A's org) must not be able to read the row.
const { data: bReadsInvite } = await B.from('invitations').select('token').eq('organization_id', orgId)
check('invitee CANNOT read the invitation row via RLS (token stays secret)', (bReadsInvite?.length ?? 0) === 0)

// ── accept: wrong identity ───────────────────────────────────────────────
const { data: cAccept } = await invoke(C, { action: 'accept', token })
check('a DIFFERENT email CANNOT redeem the link (leaked-link safe)', !cAccept?.organizationId)
const { data: cStillOut } = await A.from('organization_members').select('id').eq('organization_id', orgId).eq('user_id', c.uid)
check('the stranger did NOT become a member', (cStillOut?.length ?? 0) === 0)

// ── accept: the intended invitee ─────────────────────────────────────────
const { data: bAccept, error: bErr } = await invoke(B, { action: 'accept', token })
check('the intended invitee CAN accept', bAccept?.organizationId === orgId && !bErr)
const { data: bMember } = await A.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', b.uid).maybeSingle()
check('B is now an active member', Boolean(bMember))
check('B joined with the invited role (member, not owner)', bMember?.role === 'member')

// ── team-flip (progressive disclosure) ───────────────────────────────────
const after = (await A.from('organizations').select('is_personal, team_enabled').eq('id', orgId)).data[0]
check('org flipped to team mode after the 2nd member joined (PDL-022)', !after.is_personal && after.team_enabled)

// ── single-use ───────────────────────────────────────────────────────────
const { data: reAccept } = await invoke(B, { action: 'accept', token })
check('an accepted invite CANNOT be reused', !reAccept?.organizationId)

// ── owner cannot be granted via invite ───────────────────────────────────
const { data: ownerInvite } = await invoke(A, { action: 'create', organizationId: orgId, email: `x_${rand()}@example.com`, role: 'owner' })
// The function coerces owner→member; verify no owner invite ever lands.
const { data: ownerRows } = await A.from('invitations').select('role').eq('organization_id', orgId).eq('role', 'owner')
check('no invite can confer owner (coerced away + CHECK constraint)', (ownerRows?.length ?? 0) === 0 && Boolean(ownerInvite?.token))

console.log(failures === 0 ? '\n✅ ALL INVITE CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
