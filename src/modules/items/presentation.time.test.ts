import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatScheduleWindow, hasTimeOfDay } from '@/modules/items/presentation'

// Inputs are LOCAL-naive ISO strings (no 'Z'), so `new Date(...)` reads them in the
// test runner's own zone — `getHours()` is then deterministic regardless of TZ, which
// is exactly the local-midnight convention the helpers use (PDL-043 / D5).
const localNoon = '2026-08-03T12:00:00'
const local4pm = '2026-08-03T16:00:00'
const localMidnight = '2026-08-03T00:00:00'

describe('hasTimeOfDay (PDL-043 midnight = no specific time)', () => {
  it('is false for null and for local midnight', () => {
    expect(hasTimeOfDay(null)).toBe(false)
    expect(hasTimeOfDay(localMidnight)).toBe(false)
  })
  it('is true for a real clock time', () => {
    expect(hasTimeOfDay(local4pm)).toBe(true)
    expect(hasTimeOfDay(localNoon)).toBe(true)
  })
})

describe('formatDateTime', () => {
  it('shows date only when there is no clock time (matches formatDate)', () => {
    expect(formatDateTime(localMidnight)).toBe(formatDate(localMidnight))
  })
  it('appends the time when the item has one', () => {
    const withTime = formatDateTime(local4pm)
    expect(withTime).not.toBe(formatDate(local4pm))
    expect(withTime.startsWith(formatDate(local4pm))).toBe(true)
    expect(withTime).toContain(':') // a clock time is present
  })
  it('is empty for null', () => {
    expect(formatDateTime(null)).toBe('')
  })
})

describe('formatScheduleWindow (06:00–24:00 default)', () => {
  it('is empty when neither endpoint is set', () => {
    expect(formatScheduleWindow(null, null)).toBe('')
  })
  it('a no-time end reads as midnight (the default window end)', () => {
    expect(formatScheduleWindow(null, localMidnight).toLowerCase()).toContain('midnight')
  })
  it('joins start and end with an arrow when both are set', () => {
    expect(formatScheduleWindow(localMidnight, local4pm)).toContain('→')
  })
  it('uses the actual clock time when present, not the default', () => {
    // A timed end shows its time, not "midnight".
    expect(formatScheduleWindow(null, local4pm).toLowerCase()).not.toContain('midnight')
    expect(formatScheduleWindow(null, local4pm)).toContain(':')
  })
})
