import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB boundary the same way tags-repository.test.ts does — a module-level
// chain of vi.fn()s that reproduces exactly what RLS does on a refused write:
// zero rows and NO error. Two shared result variables keep the chains unambiguous:
//   - `lookupResult` drives the createView max-sort_order lookup (`.maybeSingle()`).
//   - `writeResult` drives every insert/update/delete terminal (`.select()` awaited).
// `select()` returns a thenable (→ writeResult) that ALSO carries the lookup-chain
// methods (.eq/.order/.limit/.maybeSingle), so one `select` serves both roles.
let lookupResult: { data: unknown; error: unknown } = { data: null, error: null }
let writeResult: { data: unknown; error: unknown } = { data: null, error: null }

const maybeSingle = vi.fn(() => Promise.resolve(lookupResult))
const limit = vi.fn(() => ({ maybeSingle }))
const order = vi.fn(() => ({ limit }))
const selectEq = vi.fn(() => ({ order })) // .eq() inside the createView lookup chain

const select = vi.fn(() => {
  const thenable = Promise.resolve(writeResult) as Promise<typeof writeResult> & {
    eq: typeof selectEq
    order: typeof order
    limit: typeof limit
    maybeSingle: typeof maybeSingle
  }
  thenable.eq = selectEq
  thenable.order = order
  thenable.limit = limit
  thenable.maybeSingle = maybeSingle
  return thenable
})

// update/delete: .eq('id').eq('is_system', false).select()
const writeEq = vi.fn(() => ({ eq: writeEq, select }))
const insert = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq: writeEq }))
const del = vi.fn(() => ({ eq: writeEq }))
const from = vi.fn(() => ({ insert, update, delete: del, select }))

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from }),
}))

import { createView, renameView, updateViewFilter, deleteView } from '@/modules/views/data/views-repository'
import { PermissionError } from '@/core/errors'
import type { ViewFilter } from '@/modules/views/view-filter'

const A_UUID = '11111111-1111-4111-8111-111111111111'
// A validated max-sort_order lookup so createView's nextOrder computes.
const OK_LOOKUP = { data: { sort_order: 20 }, error: null }

beforeEach(() => {
  lookupResult = { data: null, error: null }
  writeResult = { data: null, error: null }
  from.mockClear()
  insert.mockClear()
  update.mockClear()
  del.mockClear()
  select.mockClear()
  selectEq.mockClear()
  order.mockClear()
  limit.mockClear()
  maybeSingle.mockClear()
  writeEq.mockClear()
})

describe('createView — Zod validation before storage (TDL-010)', () => {
  it('rejects an invalid filter (empty tags array) and never calls insert', async () => {
    await expect(
      createView('org-1', 'owner-1', 'Bad', { tags: [] } as unknown as ViewFilter),
    ).rejects.toBeInstanceOf(Error)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects a filter with a bogus state and never calls insert', async () => {
    await expect(
      createView('org-1', 'owner-1', 'Bad', { states: ['bogus'] } as unknown as ViewFilter),
    ).rejects.toBeInstanceOf(Error)
    expect(insert).not.toHaveBeenCalled()
  })

  it('inserts a valid filter and resolves', async () => {
    lookupResult = OK_LOOKUP
    writeResult = { data: [{ id: 'v1' }], error: null }
    await expect(createView('org-1', 'owner-1', 'Tagged', { tags: [A_UUID] })).resolves.toBeUndefined()
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('accepts an empty filter object', async () => {
    lookupResult = OK_LOOKUP
    writeResult = { data: [{ id: 'v1' }], error: null }
    await expect(createView('org-1', 'owner-1', 'All', {})).resolves.toBeUndefined()
  })

  it('turns a silent RLS denial (0 rows, no error) into a PermissionError', async () => {
    lookupResult = OK_LOOKUP
    writeResult = { data: [], error: null }
    await expect(createView('org-1', 'owner-1', 'All', {})).rejects.toBeInstanceOf(PermissionError)
  })
})

describe('renameView', () => {
  it('turns 0 rows (no error) into a PermissionError', async () => {
    writeResult = { data: [], error: null }
    await expect(renameView('v1', 'New name')).rejects.toBeInstanceOf(PermissionError)
  })

  it('resolves when a row comes back', async () => {
    writeResult = { data: [{ id: 'v1' }], error: null }
    await expect(renameView('v1', 'New name')).resolves.toBeUndefined()
  })
})

describe('updateViewFilter', () => {
  it('rejects an invalid filter and never calls update', async () => {
    await expect(
      updateViewFilter('v1', { states: ['bogus'] } as unknown as ViewFilter),
    ).rejects.toBeInstanceOf(Error)
    expect(update).not.toHaveBeenCalled()
  })

  it('turns a silent RLS denial (0 rows, no error) into a PermissionError', async () => {
    writeResult = { data: [], error: null }
    await expect(updateViewFilter('v1', {})).rejects.toBeInstanceOf(PermissionError)
  })

  it('resolves on a valid filter when a row comes back', async () => {
    writeResult = { data: [{ id: 'v1' }], error: null }
    await expect(updateViewFilter('v1', { tags: [A_UUID] })).resolves.toBeUndefined()
  })
})

describe('deleteView', () => {
  it('turns 0 rows (no error) into a PermissionError', async () => {
    writeResult = { data: [], error: null }
    await expect(deleteView('v1')).rejects.toBeInstanceOf(PermissionError)
  })

  it('resolves when a row comes back', async () => {
    writeResult = { data: [{ id: 'v1' }], error: null }
    await expect(deleteView('v1')).resolves.toBeUndefined()
  })
})
