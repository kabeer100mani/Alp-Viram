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
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})
const email = `dbg_${Math.random().toString(36).slice(2, 8)}@example.com`
const { data: s, error } = await sb.auth.signUp({ email, password: 'Password123!' })
if (error) throw error
const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/classify-capture`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${s.session.access_token}`,
    apikey: env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ input: 'Buy milk' }),
})
console.log('status', res.status)
console.log('body', await res.text())
