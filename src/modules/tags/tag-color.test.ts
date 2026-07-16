import { describe, it, expect } from 'vitest'
import { tagColor } from '@/modules/tags/tag-color'

// When a tag has an explicit colour it is applied inline, so tagColor returns ''
// (no palette class). With no colour, a deterministic class is derived from the id
// so a tag looks the same everywhere without anyone being forced to pick one
// (PDL-005: organising is never a setup gate).
describe('tagColor', () => {
  it('returns an empty string when a colour is set (inline colour wins)', () => {
    expect(tagColor({ id: 'tag-1', color: '#ff0000' })).toBe('')
  })

  it('returns a non-empty palette class when no colour is set', () => {
    const cls = tagColor({ id: 'tag-1', color: null })
    expect(cls).not.toBe('')
    expect(typeof cls).toBe('string')
    expect(cls.length).toBeGreaterThan(0)
  })

  it('is deterministic — the same id maps to the same class across calls', () => {
    const a = tagColor({ id: 'roadmap', color: null })
    const b = tagColor({ id: 'roadmap', color: null })
    expect(a).toBe(b)
  })
})
