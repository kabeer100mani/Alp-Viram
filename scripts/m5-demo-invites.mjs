// Sets up a hands-on demo: one admin org + two invite links for two emails.
// Prints everything you need to try the invite flow in two browsers.
//   node scripts/m5-demo-invites.mjs
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
const ORIGIN = process.env.M3_BASE ?? 'http://localhost:5173'
const supa = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const tag = Math.random().toString(36).slice(2, 6)

const adminEmail = `demo_admin_${tag}@example.com`
const password = 'Password123!'
const invitee1 = `demo_teammate1_${tag}@example.com`
const invitee2 = `demo_teammate2_${tag}@example.com`

// Admin signs up (auto-gets a personal org) and mints two invites for that org.
const admin = supa()
const { error: signErr } = await admin.auth.signUp({ email: adminEmail, password })
if (signErr) throw new Error('admin signup failed: ' + signErr.message)
const orgId = (await admin.from('organizations').select('id').limit(1)).data[0].id

async function invite(email, role) {
  const { data, error } = await admin.functions.invoke('invitations', {
    body: { action: 'create', organizationId: orgId, email, role },
  })
  if (error || !data?.token) throw new Error(`invite for ${email} failed: ${error?.message ?? 'no token'}`)
  return `${ORIGIN}/invite?token=${data.token}`
}

const link1 = await invite(invitee1, 'member')
const link2 = await invite(invitee2, 'admin')

console.log(`
════════════════════════════════════════════════════════════════════
  Alp-Viram — invite demo   (app: ${ORIGIN})
════════════════════════════════════════════════════════════════════

ADMIN (optional — to watch the team form and send your own invites):
  URL:      ${ORIGIN}
  email:    ${adminEmail}
  password: ${password}
  (People & Roles appears once the first teammate below joins.)

────────────────────────────────────────────────────────────────────
BROWSER 1  — join as a MEMBER
  1. Open this link:
     ${link1}
  2. It sends you to sign-in; click "No account? Sign up".
  3. Sign up with EXACTLY this email (must match the invite):
     ${invitee1}
     password: ${password}
  4. You'll see "You're in." → Go to the workspace.

BROWSER 2  — join as an ADMIN  (use a different browser / incognito)
  1. Open this link:
     ${link2}
  2. Sign up with EXACTLY this email:
     ${invitee2}
     password: ${password}

Each invite is single-use and tied to its email. Signing up with a
different email will (correctly) refuse to join.
════════════════════════════════════════════════════════════════════
`)
