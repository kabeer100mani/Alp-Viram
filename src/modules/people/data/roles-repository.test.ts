import { describe, it, expect } from 'vitest'
import { isCurrent, type AssignmentHolder } from '@/modules/people/data/roles-repository'

const at = (validFrom: string, validTo: string | null): AssignmentHolder => ({
  assignmentId: 'a',
  userId: 'u',
  displayName: null,
  validFrom,
  validTo,
})

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString()
const HOUR = 3600_000

// Responsibility is time-bounded: valid_from ≤ now < valid_to (or valid_to null).
// This is what makes a handover work — closing the window revokes the role.
describe('isCurrent (time-bounded role holding)', () => {
  it('is true for an open-ended assignment that has started', () => {
    expect(isCurrent(at(iso(-HOUR), null))).toBe(true)
  })

  it('is true within an open window', () => {
    expect(isCurrent(at(iso(-HOUR), iso(HOUR)))).toBe(true)
  })

  it('is false once the window has closed (a completed handover)', () => {
    expect(isCurrent(at(iso(-2 * HOUR), iso(-HOUR)))).toBe(false)
  })

  it('is false before the window opens (a future assignment)', () => {
    expect(isCurrent(at(iso(HOUR), null))).toBe(false)
  })
})
