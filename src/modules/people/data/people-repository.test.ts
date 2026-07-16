import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}))

import { acceptInvitation, createInvitation } from '@/modules/people/data/people-repository'

// Model a supabase-js FunctionsHttpError: data is null and the JSON body sits on
// error.context (a Response), NOT on data. This is the shape the real client
// produces for a 4xx from an Edge Function.
const httpError = (body: unknown) => ({
  data: null,
  error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), { status: 403 }),
  }),
})

beforeEach(() => {
  invoke.mockReset()
})

describe('createInvitation', () => {
  it('builds a shareable link from the returned token', async () => {
    invoke.mockResolvedValue({ data: { token: 'abc123' }, error: null })
    const { link } = await createInvitation('org-1', 'a@b.com', 'member')
    expect(link).toContain('/invite?token=abc123')
  })

  it('surfaces the function error message from the HTTP error body (not the generic one)', async () => {
    invoke.mockResolvedValue(httpError({ error: 'only an admin can invite' }))
    await expect(createInvitation('org-1', 'a@b.com', 'member')).rejects.toThrow(/only an admin/i)
  })

  it('throws if no token comes back', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(createInvitation('org-1', 'a@b.com', 'member')).rejects.toThrow(/could not be created/i)
  })
})

describe('acceptInvitation', () => {
  it('returns the organization id on success', async () => {
    invoke.mockResolvedValue({ data: { organizationId: 'org-9' }, error: null })
    await expect(acceptInvitation('tok')).resolves.toEqual({ organizationId: 'org-9' })
  })

  it('surfaces a wrong-email / expired error rather than pretending to join', async () => {
    invoke.mockResolvedValue(httpError({ error: 'This invite was sent to a different email address.' }))
    await expect(acceptInvitation('tok')).rejects.toThrow(/different email/i)
  })
})
