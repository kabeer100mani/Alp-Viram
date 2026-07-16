import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB boundary so we can reproduce exactly what RLS does on a refused
// write: zero rows, and NO error.
type Patch = Record<string, unknown>
const maybeSingle = vi.fn()
const select = vi.fn(() => ({ maybeSingle }))
const eq = vi.fn(() => ({ select }))
const update = vi.fn((_patch: Patch) => ({ eq }))
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: () => ({ update }) }),
}))

import { completeItem, snoozeItem, updateItem, reopenItem } from '@/modules/items/data/items-repository'
import { PermissionError } from '@/core/errors'

const anItem = { id: 'item-1', title: 'Prepare July MIS', type: 'task', state: 'committed' }

describe('items write path', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    update.mockClear()
  })

  it('returns the updated item on success', async () => {
    maybeSingle.mockResolvedValue({ data: anItem, error: null })
    await expect(updateItem('item-1', { title: 'Prepare July MIS' })).resolves.toMatchObject({ id: 'item-1' })
  })

  // The important one. RLS denies silently — without this, a forbidden write
  // looks exactly like a successful one.
  it('turns a silent RLS denial (0 rows, no error) into a PermissionError', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(updateItem('item-1', { title: 'hacked' })).rejects.toBeInstanceOf(PermissionError)
  })

  it('surfaces the denial for every mutation, not just updateItem', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(completeItem('item-1', 'task')).rejects.toBeInstanceOf(PermissionError)
    await expect(snoozeItem('item-1', '2026-07-20T09:00:00Z')).rejects.toBeInstanceOf(PermissionError)
    await expect(reopenItem('item-1')).rejects.toBeInstanceOf(PermissionError)
  })

  it('refuses to complete a Note — a Note has no done-state', async () => {
    maybeSingle.mockResolvedValue({ data: anItem, error: null })
    await expect(completeItem('note-1', 'note')).rejects.toThrow(/no done-state/i)
    expect(update).not.toHaveBeenCalled() // rejected before touching the database
  })

  it('stamps completed_at when completing', async () => {
    maybeSingle.mockResolvedValue({ data: anItem, error: null })
    await completeItem('item-1', 'task')
    const patch = update.mock.calls[0][0]
    expect(patch.state).toBe('done')
    expect(patch.completed_at).toEqual(expect.any(String))
  })

  it('reopening clears completed_at (Done is recoverable, never destructive)', async () => {
    maybeSingle.mockResolvedValue({ data: anItem, error: null })
    await reopenItem('item-1')
    const patch = update.mock.calls[0][0]
    expect(patch).toMatchObject({ state: 'committed', completed_at: null })
  })

  it('only sends the fields actually provided', async () => {
    maybeSingle.mockResolvedValue({ data: anItem, error: null })
    await updateItem('item-1', { title: 'new title' })
    expect(update.mock.calls[0][0]).toEqual({ title: 'new title' })
  })
})
