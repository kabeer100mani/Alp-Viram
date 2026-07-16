// PDL-032/033 — structure + checklist security test (migrations 0010-0012).
// Proves: checklist writes follow can_write_item; TD-008 is actually fixed (an
// item cannot reference another tenant's list); folders/lists are tenant-scoped.
//   node scripts/m6-structure-test.mjs
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
  const email = `str_${label}_${rand()}@example.com`
  const { error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  return (await c.auth.getUser()).data.user.id
}

// A = admin/creator in org A. B = a separate user with their OWN org (a stranger).
// M = a plain member of A's org.
const A = mk(), B = mk(), M = mk()
const aId = await signUp(A, 'a')
const bId = await signUp(B, 'b')
const mId = await signUp(M, 'm')
const orgA = (await A.from('organizations').select('id').limit(1)).data[0].id
const orgB = (await B.from('organizations').select('id').limit(1)).data[0].id
await svc().from('organization_members').insert({ organization_id: orgA, user_id: mId, role: 'member' })
console.log(`orgA=${orgA}  orgB=${orgB}\n`)

// ── folders / lists ────────────────────────────────────────────────────────
const { data: folder, error: fErr } = await A.from('folders')
  .insert({ organization_id: orgA, name: `Clients ${rand()}`, created_by: aId }).select().single()
check('a member can create a folder', Boolean(folder) && !fErr)

const { data: listA, error: lErr } = await A.from('lists')
  .insert({ organization_id: orgA, name: `Acme ${rand()}`, folder_id: folder.id, created_by: aId }).select().single()
check('a list can live inside a folder', Boolean(listA) && !lErr)

const { data: rootList } = await A.from('lists')
  .insert({ organization_id: orgA, name: `Root ${rand()}`, created_by: aId }).select().single()
check('a list may also sit at the org root (folder_id null, PDL-032)', Boolean(rootList) && rootList.folder_id === null)

check("a stranger cannot read another org's lists", ((await B.from('lists').select('id').eq('organization_id', orgA)).data ?? []).length === 0)

// A folder from org B must not accept a list from org A (composite FK).
const { data: folderB } = await B.from('folders')
  .insert({ organization_id: orgB, name: `BFolder ${rand()}`, created_by: bId }).select().single()
const { error: crossFolderErr } = await A.from('lists')
  .update({ folder_id: folderB.id }).eq('id', listA.id).select()
check("a list CANNOT be moved into another tenant's folder (composite FK)", Boolean(crossFolderErr))

// ── TD-008: an item cannot point at another tenant's list ─────────────────
const { data: item } = await A.from('items')
  .insert({ organization_id: orgA, title: 'Prepare MIS', type: 'task', created_by: aId }).select().single()
const { data: listB } = await B.from('lists')
  .insert({ organization_id: orgB, name: `BList ${rand()}`, created_by: bId }).select().single()

const { error: td008Err } = await A.from('items').update({ list_id: listB.id }).eq('id', item.id).select()
check('TD-008 FIXED: an item CANNOT reference another tenant\'s list', Boolean(td008Err))

const { data: okAssign } = await A.from('items').update({ list_id: listA.id }).eq('id', item.id).select()
check('an item CAN reference a list in its own org', (okAssign?.length ?? 0) === 1)

const { data: unfiled } = await A.from('items')
  .insert({ organization_id: orgA, title: 'Quick capture', type: 'task', created_by: aId, list_id: null }).select().single()
check('list_id stays OPTIONAL — capture with no list still works (PDL-032)', Boolean(unfiled) && unfiled.list_id === null)

// ── checklists follow can_write_item ──────────────────────────────────────
const { error: mChkErr } = await M.from('checklist_items')
  .insert({ organization_id: orgA, item_id: item.id, text: 'sneaky', created_by: mId })
check('a member who cannot write the item CANNOT add a checklist step', Boolean(mChkErr))

const { data: step, error: aChkErr } = await A.from('checklist_items')
  .insert({ organization_id: orgA, item_id: item.id, text: 'Draft the numbers', created_by: aId }).select().single()
check('the creator CAN add a checklist step', Boolean(step) && !aChkErr)
check('members can READ the checklist', ((await M.from('checklist_items').select('id').eq('item_id', item.id)).data ?? []).length === 1)

// A checklist row must not be smuggled onto another tenant's item.
const { data: itemB } = await B.from('items')
  .insert({ organization_id: orgB, title: 'B item', type: 'task', created_by: bId }).select().single()
const { error: smuggleErr } = await A.from('checklist_items')
  .insert({ organization_id: orgA, item_id: itemB.id, text: 'smuggled', created_by: aId })
check("a checklist step CANNOT be smuggled onto another tenant's item", Boolean(smuggleErr))

// ── DoD ───────────────────────────────────────────────────────────────────
const { data: dod } = await A.from('items').update({ definition_of_done: 'Numbers reconciled and signed off.' }).eq('id', item.id).select()
check('the Definition of Done can be set on a task', (dod?.length ?? 0) === 1)

const { data: doneAnyway } = await A.from('items').update({ state: 'done', completed_at: new Date().toISOString() }).eq('id', item.id).select()
check('DoD is NOT enforced — the item completes regardless (PDL-033)', (doneAnyway?.length ?? 0) === 1)

const { data: note } = await A.from('items')
  .insert({ organization_id: orgA, title: 'A note', type: 'note', created_by: aId }).select().single()
const { error: noteDodErr } = await A.from('items').update({ definition_of_done: 'x' }).eq('id', note.id).select()
check('a Note CANNOT have a Definition of Done (no done-state; CHECK)', Boolean(noteDodErr))

console.log(failures === 0 ? '\n✅ ALL STRUCTURE CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
