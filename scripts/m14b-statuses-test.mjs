// M8 Gate C — Statuses editor (PDL-049): custom status/priority labels+colors, live.
//   npm run dev   then   node scripts/m14b-statuses-test.mjs
import { chromium } from '@playwright/test'
import { signUp, goToSection } from './lib/shell.mjs'
const OUT='C:/Users/Kabir/AppData/Local/Temp/claude/c--Users-Kabir-Alp-Viram/a5d4c350-1237-4791-8ac3-1e72b7a4d6ae/scratchpad/m14b-shots'
import { mkdirSync } from 'node:fs'; mkdirSync(OUT,{recursive:true})
let fail=0; const check=(n,c)=>{console.log(`${c?'✅':'❌'} ${n}`); if(!c)fail++}
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}})
try{
  await signUp(p)
  // Seed an in_progress item so we can see the pill reflect the custom label.
  await p.evaluate(async ()=>{
    const repo=await import('/src/modules/items/data/items-repository.ts')
    const {getSupabaseClient}=await import('/src/lib/supabase/client.ts'); const sb=getSupabaseClient()
    const orgId=(await sb.from('organizations').select('id').limit(1)).data[0].id
    const uid=(await sb.auth.getUser()).data.user.id
    await repo.createItem({organizationId:orgId,title:'Board deck',createdBy:uid})
    // move it to in_progress
    const it=(await sb.from('items').select('id').eq('title','Board deck')).data[0]
    await sb.from('items').update({state:'in_progress'}).eq('id',it.id)
  })
  // Statuses editor: rename "In progress" → "Doing"
  await goToSection(p,'Statuses')
  check('Statuses editor renders', /statuses/i.test(await p.locator('main').innerText()))
  const labelInput = p.getByLabel('Label for In progress')
  await labelInput.fill('Doing')
  await labelInput.blur()
  await p.waitForTimeout(1200)
  await p.screenshot({path:`${OUT}/1-editor.png`})
  // Persisted to org.field_prefs?
  const persisted = await p.evaluate(async ()=>{
    const {getSupabaseClient}=await import('/src/lib/supabase/client.ts'); const sb=getSupabaseClient()
    const orgId=(await sb.from('organizations').select('id').limit(1)).data[0].id
    const fp=(await sb.from('organizations').select('field_prefs').eq('id',orgId).single()).data.field_prefs
    return fp?.status?.in_progress?.label
  })
  check('custom label persisted to org.field_prefs', persisted==='Doing')
  // The pill across the app reflects "Doing"
  await goToSection(p,'Capture')
  await p.getByRole('navigation',{name:/views/i}).getByRole('button',{name:'By Role'}).click()
  await p.waitForTimeout(1000)
  const statusCtl = p.getByLabel(/status for board deck/i).first()
  await statusCtl.waitFor({timeout:10000})
  check('the StatusPill shows the custom label "Doing"', /doing/i.test(await statusCtl.innerText()))
  check('the default "In progress" no longer shows for that item', !/in progress/i.test(await statusCtl.innerText()))
  await p.screenshot({path:`${OUT}/2-pill.png`})
  // Reset restores the default
  await goToSection(p,'Statuses')
  await p.getByRole('button',{name:'Reset'}).first().click()
  await p.waitForTimeout(1000)
  const afterReset = await p.evaluate(async ()=>{
    const {getSupabaseClient}=await import('/src/lib/supabase/client.ts'); const sb=getSupabaseClient()
    const orgId=(await sb.from('organizations').select('id').limit(1)).data[0].id
    const fp=(await sb.from('organizations').select('field_prefs').eq('id',orgId).single()).data.field_prefs
    return fp?.status?.in_progress?.label ?? null
  })
  check('Reset clears the override', afterReset===null)
}catch(e){check('threw: '+(e.message||e),false); await p.screenshot({path:`${OUT}/FAIL.png`}).catch(()=>{})}finally{await b.close()}
console.log(fail===0?'\n✅ STATUSES (Gate C) PASSED':`\n❌ ${fail} FAILED`); process.exit(fail?1:0)
