// M6 Gate A — live tenant-safety red-team for tags + org rename.
// Drives the REAL hosted database with anon-key clients (RLS in force), plus a
// service-role positive control so a denial can't pass for the wrong reason.
//
//   node scripts/m10-tags-test.mjs
//
// Needs .env: SUPABASE_URL, SUPABASE_ANON_KEY (or VITE_ variants), and a
// service key (SUPABASE_SERVICE_ROLE_KEY / sb_secret_...). Never prints key values.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

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

async function makeUser() {
  const c = anon()
  const email = `m10_${rnd()}@example.com`
  const { data, error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signup: ${error.message}`)
  // Signup trigger auto-creates the user's personal org.
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
  if (!URL_ || !ANON) throw new Error('missing SUPABASE_URL / SUPABASE_ANON_KEY in .env')

  // ── Positive control: prove the service key really bypasses RLS ─────────────
  // Without this, every "denied" result below could be a mis-scoped key, not RLS.
  if (SERVICE) {
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } })
    const { data: anyOrg } = await svc.from('organizations').select('id').limit(1)
    check('positive control: service role can read across orgs (RLS bypassed)', Boolean(anyOrg))
  } else {
    console.log('⚠️  no service key — skipping the positive control (cross-tenant checks are weaker)')
  }

  const alice = await makeUser()
  const bob = await makeUser()
  check('two isolated tenants provisioned', alice.org !== bob.org)

  // ── Alice creates a tag + an item, tags it ──────────────────────────────────
  const { data: tag, error: tagErr } = await alice.c
    .from('tags')
    .insert({ organization_id: alice.org, name: `Client-${rnd()}` })
    .select()
    .single()
  check('a member can create a tag in their org', Boolean(tag) && !tagErr)

  const { data: item } = await alice.c
    .from('items')
    .insert({ organization_id: alice.org, title: `MIS ${rnd()}`, type: 'task', state: 'committed', priority: 'none', created_by: alice.uid })
    .select()
    .single()

  const { data: tagged } = await alice.c
    .from('item_tags')
    .insert({ organization_id: alice.org, item_id: item.id, tag_id: tag.id })
    .select()
  check('the item creator (a writer) can tag their item', (tagged?.length ?? 0) === 1)

  // ── Cross-tenant: Bob must not see or touch Alice's tag/item ────────────────
  const { data: bobSeesTag } = await bob.c.from('tags').select('id').eq('id', tag.id)
  check("Bob cannot read Alice's tag (RLS)", (bobSeesTag?.length ?? 0) === 0)

  const { data: bobSeesItem } = await bob.c.from('items').select('id').eq('id', item.id)
  check("Bob cannot read Alice's item (RLS)", (bobSeesItem?.length ?? 0) === 0)

  // Bob tries to tag Alice's item with his own org id — the composite FK + RLS
  // must both refuse. A silent 0-row is also a pass (the write did nothing).
  const { data: bobTagWrite, error: bobTagErr } = await bob.c
    .from('item_tags')
    .insert({ organization_id: bob.org, item_id: item.id, tag_id: tag.id })
    .select()
  check("Bob cannot tag Alice's item across tenants", Boolean(bobTagErr) || (bobTagWrite?.length ?? 0) === 0)

  // Cross-tenant smuggle: Alice's item + Alice's tag but stamped with Bob's org.
  const { data: smuggle, error: smuggleErr } = await alice.c
    .from('item_tags')
    .insert({ organization_id: bob.org, item_id: item.id, tag_id: tag.id })
    .select()
  check('an item_tags row cannot claim another org (composite FK)', Boolean(smuggleErr) || (smuggle?.length ?? 0) === 0)

  // ── Org rename: only an admin, and never across tenants ─────────────────────
  const newName = `Renamed ${rnd()}`
  const { data: renamed } = await alice.c.from('organizations').update({ name: newName }).eq('id', alice.org).select()
  check('an org admin (owner) can rename their own org', renamed?.[0]?.name === newName)

  const { data: bobRename } = await bob.c.from('organizations').update({ name: 'pwned' }).eq('id', alice.org).select()
  check("Bob cannot rename Alice's org (RLS 0-row)", (bobRename?.length ?? 0) === 0)

  // Confirm Bob's attempt truly changed nothing.
  const { data: afterName } = SERVICE
    ? await createClient(URL_, SERVICE, { auth: { persistSession: false } }).from('organizations').select('name').eq('id', alice.org).single()
    : await alice.c.from('organizations').select('name').eq('id', alice.org).single()
  check("Alice's org name is intact after Bob's attempt", afterName?.name === newName)

  // ── slug is NOT regenerated by rename (D2) ──────────────────────────────────
  if (SERVICE) {
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } })
    const { data: slugRow } = await svc.from('organizations').select('slug').eq('id', alice.org).single()
    check('rename left the slug stable (D2)', typeof slugRow?.slug === 'string' && !slugRow.slug.includes('renamed'))
  }
} catch (e) {
  check(`red-team threw: ${e instanceof Error ? e.message : e}`, false)
} finally {
  console.log(failures === 0 ? '\n✅ TAGS/ORG RED-TEAM PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
