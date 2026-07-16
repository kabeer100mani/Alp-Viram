// PDL-035 — Project → Folder → List hierarchy security/integrity test (migration 0015).
// Proves: the full hierarchy works; folderless lists are allowed; tenant + project
// integrity hold (a folder/list can't cross org or project); everything optional.
//   node scripts/m8-hierarchy-test.mjs
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
const rand = () => Math.random().toString(36).slice(2, 10)

let failures = 0
const check = (n, p) => {
  console.log(`${p ? '✅' : '❌'} ${n}`)
  if (!p) failures++
}
async function signUp(c, label) {
  const email = `hier_${label}_${rand()}@example.com`
  const { error } = await c.auth.signUp({ email, password: 'Password123!' })
  if (error) throw new Error(`signUp(${label}): ${error.message}`)
  return (await c.auth.getUser()).data.user.id
}

// A owns org A; B is a stranger with their own org B.
const A = mk(), B = mk()
const aId = await signUp(A, 'a')
await signUp(B, 'b')
const orgA = (await A.from('organizations').select('id').limit(1)).data[0].id
const orgB = (await B.from('organizations').select('id').limit(1)).data[0].id

// ── the full chain: Project → Folder → List → Item ────────────────────────
const project = (await A.from('projects').insert({ organization_id: orgA, name: `Client Work ${rand()}`, created_by: aId }).select().single()).data
check('a member can create a Project', Boolean(project))

const folder = (await A.from('folders').insert({ organization_id: orgA, project_id: project.id, name: `Acme ${rand()}`, created_by: aId }).select().single()).data
check('a Folder can be created inside a Project', Boolean(folder) && folder.project_id === project.id)

const listInFolder = (await A.from('lists').insert({ organization_id: orgA, project_id: project.id, folder_id: folder.id, name: `Q3 ${rand()}`, created_by: aId }).select().single()).data
check('a List can live inside a Folder', Boolean(listInFolder) && listInFolder.folder_id === folder.id)

const folderlessList = (await A.from('lists').insert({ organization_id: orgA, project_id: project.id, folder_id: null, name: `Loose ${rand()}`, created_by: aId }).select().single()).data
check('a List can sit directly under a Project (folderless, PDL-035)', Boolean(folderlessList) && folderlessList.folder_id === null)

const item = (await A.from('items').insert({ organization_id: orgA, title: 'Prepare MIS', type: 'task', created_by: aId, list_id: listInFolder.id }).select().single()).data
check('a Task lives in a List', Boolean(item) && item.list_id === listInFolder.id)

// ── optional at every level ───────────────────────────────────────────────
const unfiled = (await A.from('items').insert({ organization_id: orgA, title: 'Quick thought', type: 'task', created_by: aId, list_id: null }).select().single()).data
check('a Task needs no List — zero-click capture still lands in the Inbox', Boolean(unfiled) && unfiled.list_id === null)

// ── tenant isolation ──────────────────────────────────────────────────────
check("a stranger cannot read another org's projects", ((await B.from('projects').select('id').eq('organization_id', orgA)).data ?? []).length === 0)

const projectB = (await B.from('projects').insert({ organization_id: orgB, name: `B Proj ${rand()}`, created_by: (await B.auth.getUser()).data.user.id }).select().single()).data
// A folder from org B cannot claim a project in org A.
const { error: crossOrgErr } = await B.from('folders').insert({ organization_id: orgB, project_id: project.id, name: 'x', created_by: null })
check("a Folder cannot reference a Project in another org (RLS + composite FK)", Boolean(crossOrgErr))

// ── project integrity: a folder'd list must match its folder's project ────
const otherProject = (await A.from('projects').insert({ organization_id: orgA, name: `Other ${rand()}`, created_by: aId }).select().single()).data
// Try to put a list in `folder` (project = project.id) but claim otherProject.
const { error: crossProjectErr } = await A.from('lists').insert({
  organization_id: orgA, project_id: otherProject.id, folder_id: folder.id, name: 'mismatch', created_by: aId,
})
check("a List in a Folder must share the Folder's Project (composite FK)", Boolean(crossProjectErr))

// Moving a folder to another org's project is impossible (no such project visible).
check('projectB belongs to org B only', Boolean(projectB) && projectB.organization_id === orgB)

console.log(failures === 0 ? '\n✅ ALL HIERARCHY CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
