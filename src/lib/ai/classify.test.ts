import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the network boundary so we can feed classifyCapture arbitrary "AI output"
// and prove the Zod gate — not the model — decides what the app trusts.
const invoke = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}))

import { classifyCapture } from '@/lib/ai/classify'

const validClassification = {
  type: 'task',
  title: 'Buy milk',
  body: null,
  is_reminder: false,
  due_at: null,
  remind_at: null,
  priority: 'none',
  confidence: 0.42,
  needs_clarification: false,
  clarifying_question: null,
}

describe('classifyCapture — the Zod gate (no AI output bypasses validation)', () => {
  beforeEach(() => invoke.mockReset())

  it('accepts a structurally valid classification', async () => {
    invoke.mockResolvedValue({ data: { classification: validClassification }, error: null })
    await expect(classifyCapture('Buy milk')).resolves.toMatchObject({ type: 'task', title: 'Buy milk' })
  })

  it('rejects an out-of-contract enum value', async () => {
    invoke.mockResolvedValue({
      data: { classification: { ...validClassification, type: 'reminder' } },
      error: null,
    })
    await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
  })

  it('rejects an out-of-range confidence', async () => {
    invoke.mockResolvedValue({
      data: { classification: { ...validClassification, confidence: 5 } },
      error: null,
    })
    await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
  })

  it('rejects a response missing a required field', async () => {
    const { title: _omit, ...missingTitle } = validClassification
    invoke.mockResolvedValue({ data: { classification: missingTitle }, error: null })
    await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
  })

  it('propagates a transport error from the Edge Function', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('non-2xx status code') })
    await expect(classifyCapture('x')).rejects.toThrow(/non-2xx/i)
  })

  // TD-002: a naive wall time is silently read as UTC by `timestamptz`, shifting
  // a user's due/remind time by their whole offset. It must not get through.
  describe('datetime must be timezone-qualified (TD-002)', () => {
    const withDue = (due_at: unknown) => ({ ...validClassification, due_at })

    it('accepts a UTC "Z" datetime', async () => {
      invoke.mockResolvedValue({ data: { classification: withDue('2026-07-20T16:00:00Z') }, error: null })
      await expect(classifyCapture('x')).resolves.toMatchObject({ due_at: '2026-07-20T16:00:00Z' })
    })

    it('accepts an explicit UTC offset', async () => {
      invoke.mockResolvedValue({ data: { classification: withDue('2026-07-20T16:00:00+05:30') }, error: null })
      await expect(classifyCapture('x')).resolves.toMatchObject({ due_at: '2026-07-20T16:00:00+05:30' })
    })

    it('rejects a naive wall time with no timezone', async () => {
      invoke.mockResolvedValue({ data: { classification: withDue('2026-07-20T16:00:00') }, error: null })
      await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
    })

    it('rejects a date-only value', async () => {
      invoke.mockResolvedValue({ data: { classification: withDue('2026-07-20') }, error: null })
      await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
    })

    it('rejects a naive remind_at', async () => {
      invoke.mockResolvedValue({
        data: { classification: { ...validClassification, remind_at: '2026-07-20T09:00:00' } },
        error: null,
      })
      await expect(classifyCapture('x')).rejects.toThrow(/unexpected shape/i)
    })

    it('still allows null (no date given)', async () => {
      invoke.mockResolvedValue({ data: { classification: withDue(null) }, error: null })
      await expect(classifyCapture('x')).resolves.toMatchObject({ due_at: null })
    })
  })
})
