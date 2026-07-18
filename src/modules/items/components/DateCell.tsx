import { useState } from 'react'
import { formatDateTime } from '@/modules/items/presentation'

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

/**
 * Change the *date* while keeping the existing *time of day* (PDL-043). The old
 * behaviour forced local noon on every edit, silently clobbering a captured "4pm"
 * — the exact bug this fixes. If the field had no specific time, the new date is
 * stored at local **midnight** (the "no specific time" sentinel, D5).
 */
function combineDateKeepingTime(newDate: string, existingIso: string | null): string | null {
  if (!newDate) return null
  const existing = existingIso ? new Date(existingIso) : null
  const d = new Date(`${newDate}T00:00:00`)
  if (existing) d.setHours(existing.getHours(), existing.getMinutes(), 0, 0)
  return d.toISOString()
}

/**
 * A cell that shows a *date* (with its time when it has one), not a raw form
 * control. A bare `<input type="date">` prints the browser's "dd-mm-yyyy"
 * placeholder when empty and a raw ISO when set; so render the formatted value and
 * swap in the input only while editing. Neutral for past dates (no "overdue"
 * colour — FR-12b). Editing here keeps any time-of-day (see combineDateKeepingTime);
 * the full time picker lives in the task panel.
 */
export function DateCell({
  value,
  label,
  canWrite,
  busy = false,
  placeholder = 'Set date',
  className = '',
  assumed = false,
  onChange,
}: {
  value: string | null
  label: string
  canWrite: boolean
  busy?: boolean
  placeholder?: string
  className?: string
  /** The date was defaulted by the app, not user-set — show a small "assumed" tag (PDL-047). */
  assumed?: boolean
  onChange: (iso: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  // Same visual pattern as the "· suggested" list tag: a small appended marker that
  // flags a date the app assumed, so it reads differently from a user-set one.
  const assumedTag = assumed && value ? <span className="ml-1 text-[10px] text-primary">· assumed</span> : null

  if (canWrite && editing) {
    return (
      <input
        type="date"
        autoFocus
        aria-label={label}
        className={`h-6 rounded border border-input bg-background px-1 text-xs ${className}`}
        defaultValue={dateInput(value)}
        disabled={busy}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false)
        }}
        onChange={(e) => {
          onChange(combineDateKeepingTime(e.target.value, value))
          setEditing(false)
        }}
      />
    )
  }

  const text = formatDateTime(value)
  if (!canWrite) return <span className="text-muted-foreground">{text}{assumedTag}</span>

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setEditing(true)}
      className={`h-6 rounded border border-transparent px-1 text-left text-xs text-muted-foreground hover:border-input ${className}`}
    >
      {text ? <>{text}{assumedTag}</> : <span className="text-muted-foreground/50">{placeholder}</span>}
    </button>
  )
}
