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
// createOrganization goes through an RPC (a SECURITY DEFINER routine), not `from`.
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null }
const rpc = vi.fn(() => Promise.resolve(rpcResult))
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from, rpc }),
}))

import { createOrganization, renameOrganization } from '@/modules/organizations/data/organizations-repository'
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

describe('createOrganization — RPC to the SECURITY DEFINER routine', () => {
  beforeEach(() => {
    rpcResult = { data: null, error: null }
    rpc.mockClear()
  })

  it('calls create_organization with the trimmed name and returns the new org id', async () => {
    rpcResult = { data: 'new-org-id', error: null }
    await expect(createOrganization('  Job 1  ')).resolves.toBe('new-org-id')
    expect(rpc).toHaveBeenCalledWith('create_organization', { p_name: 'Job 1' })
  })

  it('throws the transport/permission error the RPC surfaces', async () => {
    rpcResult = { data: null, error: { message: 'not authenticated' } }
    await expect(createOrganization('Job 1')).rejects.toBeTruthy()
  })

  it('throws when the RPC returns no id (nothing was created)', async () => {
    rpcResult = { data: null, error: null }
    await expect(createOrganization('Job 1')).rejects.toBeTruthy()
  })
})
