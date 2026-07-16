import { describe, it, expect } from 'vitest'
import { parseViewFilter, viewFilterSchema } from '@/modules/views/view-filter'

// A stored filter is untrusted input (TDL-010): the DB validates nothing, so Zod
// is the only thing standing between a stale/hand-edited JSONB blob and a view
// that quietly means something other than its name.
describe('view filter contract', () => {
  it('accepts the seeded system-view filters verbatim', () => {
    // These must stay in step with supabase/migrations/0007_seed_system_views.sql.
    const seeded = [
      { states: ['captured'], sort: 'created_desc' },
      { states: ['committed', 'in_progress'], due: 'today', sort: 'due_asc' },
      { states: ['committed', 'in_progress'], due: 'upcoming', sort: 'due_asc' },
      { states: ['captured', 'committed'], agingDays: 3, sort: 'updated_desc' },
      { waiting: true, sort: 'updated_desc' },
      { states: ['done'], sort: 'updated_desc' },
      { groupBy: 'role', sort: 'due_asc' },
    ]
    for (const f of seeded) {
      expect(viewFilterSchema.safeParse(f).success, JSON.stringify(f)).toBe(true)
    }
  })

  it('treats an empty filter as valid (matches everything active)', () => {
    expect(parseViewFilter({})).toEqual({})
    expect(parseViewFilter(null)).toEqual({})
  })

  it('rejects an unknown state', () => {
    expect(parseViewFilter({ states: ['archived'] })).toBeNull()
  })

  it('rejects an unknown key — a filter from a newer client must fail loudly', () => {
    expect(parseViewFilter({ states: ['done'], mystery: true })).toBeNull()
  })

  it('rejects a nonsensical aging window', () => {
    expect(parseViewFilter({ agingDays: 0 })).toBeNull()
    expect(parseViewFilter({ agingDays: -3 })).toBeNull()
    expect(parseViewFilter({ agingDays: 1.5 })).toBeNull()
  })

  it('rejects an empty states array (would mean "nothing", not "everything")', () => {
    expect(parseViewFilter({ states: [] })).toBeNull()
  })

  it('rejects a filter that is not an object', () => {
    expect(parseViewFilter('done')).toBeNull()
    expect(parseViewFilter(42)).toBeNull()
  })

  it('has no "overdue" concept — there is no raw overdue state (FR-12b)', () => {
    expect(parseViewFilter({ due: 'overdue' })).toBeNull()
  })

  // tags (PDL-010): a view can filter on flat tag ids. Ids not names, so a rename
  // never breaks a saved view — which is exactly why the schema pins z.uuid().
  it('accepts and round-trips a filter carrying valid tag ids', () => {
    const tag = '123e4567-e89b-12d3-a456-426614174000'
    const parsed = parseViewFilter({ tags: [tag] })
    expect(parsed).toEqual({ tags: [tag] })
    expect(parsed?.tags?.[0]).toBe(tag)
  })

  it('rejects an empty tags array (nonempty — would mean "nothing", not a filter)', () => {
    expect(parseViewFilter({ tags: [] })).toBeNull()
  })

  it('rejects a tag id that is not a uuid (a name must never leak in)', () => {
    expect(parseViewFilter({ tags: ['not-a-uuid'] })).toBeNull()
  })

  it('treats omitted tags as valid (the field is optional)', () => {
    expect(parseViewFilter({ states: ['committed'] })).toEqual({ states: ['committed'] })
  })

  it('is still .strict() alongside tags — an unknown key still fails', () => {
    const tag = '123e4567-e89b-12d3-a456-426614174000'
    expect(parseViewFilter({ tags: [tag], mystery: true })).toBeNull()
  })
})
