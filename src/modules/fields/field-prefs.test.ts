import { describe, it, expect } from 'vitest'
import { PRIORITY_DEFAULTS, STATUS_DEFAULTS, resolvePriority, resolveStatus } from './field-prefs'

// PDL-049: labels/colors resolve to the org's override or the frozen §2 default.
describe('field prefs — resolve', () => {
  it('falls back to the §2 defaults when there are no overrides', () => {
    expect(resolveStatus('in_progress', {})).toMatchObject({
      label: 'In progress',
      color: STATUS_DEFAULTS.in_progress.color,
      solid: true,
    })
    expect(resolvePriority('high', {})).toMatchObject({ label: 'High', color: PRIORITY_DEFAULTS.high.color })
  })

  it('applies a label + color override', () => {
    const prefs = { status: { in_progress: { label: 'Doing', color: '#ff8800' } } }
    expect(resolveStatus('in_progress', prefs)).toMatchObject({ label: 'Doing', color: '#ff8800', solid: true })
  })

  it('an empty/whitespace label override keeps the default label', () => {
    expect(resolveStatus('done', { status: { done: { label: '   ' } } }).label).toBe('Done')
  })

  it('a partial override keeps the other field at its default', () => {
    expect(resolvePriority('low', { priority: { low: { color: '#123456' } } })).toMatchObject({
      label: 'Low',
      color: '#123456',
    })
  })

  it('solid (filled vs ghost) is fixed per status, never overridden', () => {
    expect(resolveStatus('captured', { status: { captured: { color: '#000' } } }).solid).toBe(false)
    expect(resolveStatus('done', { status: { done: { color: '#000' } } }).solid).toBe(true)
  })
})
