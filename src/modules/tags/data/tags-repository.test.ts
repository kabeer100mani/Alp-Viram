import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB boundary so we can reproduce exactly what RLS does on a refused
// write: zero rows, and NO error. `select()` is the terminal for the array-returning
// writes (add/removeTagFromItem); it also carries `.single()` for the row-returning
// writes (create/renameTag), so one shared `result` drives every chain.
let result: { data: unknown; error: unknown } = { data: null, error: null }
const single = vi.fn(() => Promise.resolve(result))
const select = vi.fn(() => {
  const thenable = Promise.resolve(result) as Promise<typeof result> & { single: typeof single }
  thenable.single = single
  return thenable
})
const eq = vi.fn(() => ({ eq, select }))
const insert = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))
const del = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ insert, update, delete: del, select }))
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from }),
}))

import { addTagToItem, removeTagFromItem, createTag, renameTag } from '@/modules/tags/data/tags-repository'
import { PermissionError } from '@/core/errors'

const aTag = { id: 'tag-1', organization_id: 'org-1', name: 'Roadmap' }

describe('tags write path — silent RLS denial', () => {
  beforeEach(() => {
    result = { data: null, error: null }
    from.mockClear()
    insert.mockClear()
    update.mockClear()
    del.mockClear()
    select.mockClear()
    single.mockClear()
  })

  // The important one for tagging: a forbidden insert matches zero rows and returns
  // NO error — indistinguishable from success unless we check the affected rows.
  it('addTagToItem turns 0 rows (no error) into a PermissionError', async () => {
    result = { data: [], error: null }
    await expect(addTagToItem('org-1', 'item-1', 'tag-1')).rejects.toBeInstanceOf(PermissionError)
  })

  it('addTagToItem does NOT throw when a row comes back', async () => {
    result = { data: [{ item_id: 'item-1', tag_id: 'tag-1' }], error: null }
    await expect(addTagToItem('org-1', 'item-1', 'tag-1')).resolves.toBeUndefined()
  })

  it('removeTagFromItem turns 0 rows (no error) into a PermissionError', async () => {
    result = { data: [], error: null }
    await expect(removeTagFromItem('item-1', 'tag-1')).rejects.toBeInstanceOf(PermissionError)
  })

  it('removeTagFromItem does NOT throw when a row comes back', async () => {
    result = { data: [{ item_id: 'item-1', tag_id: 'tag-1' }], error: null }
    await expect(removeTagFromItem('item-1', 'tag-1')).resolves.toBeUndefined()
  })
})

describe('tags create/rename', () => {
  beforeEach(() => {
    result = { data: null, error: null }
  })

  it('createTag returns the inserted row', async () => {
    result = { data: aTag, error: null }
    await expect(createTag('org-1', 'Roadmap')).resolves.toMatchObject({ id: 'tag-1', name: 'Roadmap' })
  })

  it('createTag throws when the transport returns an error', async () => {
    result = { data: null, error: { message: 'boom' } }
    await expect(createTag('org-1', 'Roadmap')).rejects.toBeTruthy()
  })

  it('renameTag returns the updated row', async () => {
    result = { data: { ...aTag, name: 'Planning' }, error: null }
    await expect(renameTag('tag-1', 'Planning')).resolves.toMatchObject({ name: 'Planning' })
  })

  it('renameTag throws when the transport returns an error', async () => {
    result = { data: null, error: { message: 'boom' } }
    await expect(renameTag('tag-1', 'Planning')).rejects.toBeTruthy()
  })
})
