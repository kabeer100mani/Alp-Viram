// Post-deploy safety check: the classify-capture Edge Function must reject
// UNAUTHENTICATED requests. Guards against a --no-verify-jwt deploy silently
// leaving it open (see CLAUDE.md → Deploy Safety Notes). Exits non-zero on fail.
//   node scripts/check-jwt-guard.mjs
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
const url = env.VITE_SUPABASE_URL
if (!url) throw new Error('VITE_SUPABASE_URL missing from .env')

// Every authed Edge Function must reject an unauthenticated request. Add new
// functions here as they ship, so none silently deploys open.
const FUNCTIONS = ['classify-capture', 'invitations']

let failed = false
for (const fn of FUNCTIONS) {
  // Deliberately send NO Authorization / apikey header — an authed endpoint must 401.
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probe: 'jwt guard' }),
  })
  await res.text() // drain the body so the socket closes cleanly
  if (res.status === 401) {
    console.log(`✅ ${fn}: unauthenticated request rejected (401).`)
  } else {
    failed = true
    console.error(
      `❌ ${fn}: unauthenticated request returned ${res.status}, expected 401.\n` +
        '   It may have been deployed with --no-verify-jwt. Redeploy with\n' +
        '   verify_jwt = true (see supabase/config.toml) before proceeding.',
    )
  }
}
if (failed) process.exitCode = 1 // let the event loop drain, then exit non-zero
