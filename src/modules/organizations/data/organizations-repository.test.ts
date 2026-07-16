import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB boundary. renameOrganization ends in
// .update({name}).eq('id', id).select() — a forbidden update matches zero rows and
// returns NO error, so `.select()` forces the result back and a refusal must become a
// real PermissionError instead of a false "saved".
let result: { data: unknown; error: unknown } = { data: null, error: null }
const select = vi.fn(() => Promise.resolve(result))
const eq = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ update }))
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from }),
}))

import { renameOrganization } from '@/modules/organizations/data/organizations-repository'
import { PermissionError } from '@/core/errors'

describe('renameOrganization — silent RLS denial', () => {
  beforeEach(() => {
    result = { data: null, error: null }
    update.mockClear()
  })

  it('turns a silent RLS denial (0 rows, no error) into a PermissionError', async () => {
    result = { data: [], error: null }
    await expect(renameOrganization('org-1', 'New Name')).rejects.toBeInstanceOf(PermissionError)
  })

  it('resolves without throwing when a row comes back', async () => {
    result = { data: [{ id: 'org-1', name: 'New Name' }], error: null }
    await expect(renameOrganization('org-1', 'New Name')).resolves.toBeUndefined()
  })

  it('throws the transport error when the update itself fails', async () => {
    result = { data: null, error: { message: 'connection reset' } }
    await expect(renameOrganization('org-1', 'New Name')).rejects.toBeTruthy()
  })
})
