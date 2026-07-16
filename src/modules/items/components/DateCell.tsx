import { useState } from 'react'
import { formatDate } from '@/modules/items/presentation'

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
// Local noon → an unambiguous absolute instant (TD-005 discipline).
const toInstant = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null)

/**
 * A cell that shows a *date*, not a form control.
 *
 * A bare `<input type="date">` renders the browser's own "dd-mm-yyyy" placeholder as
 * literal text whenever its value is empty — and prints a raw "2026-08-20" when set.
 * In a dense row (or a triage chip, where empty is the *common* case) that reads as
 * a broken field. So: render the formatted date, or a quiet hint, and swap in the
 * real input only while the user is actually editing.
 *
 * Deliberately neutral for past dates — there is no raw "overdue" state (FR-12b) and
 * a shaming state is rejected (Doc 4). Lateness surfaces as the Aging view.
 */
export function DateCell({
  value,
  label,
  canWrite,
  busy = false,
  placeholder = 'Set date',
  className = '',
  onChange,
}: {
  value: string | null
  label: string
  canWrite: boolean
  busy?: boolean
  placeholder?: string
  className?: string
  onChange: (iso: string | null) => void
}) {
  const [editing, setEditing] = useState(false)

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
          onChange(toInstant(e.target.value))
          setEditing(false)
        }}
      />
    )
  }

  const text = formatDate(value)
  if (!canWrite) return <span className="text-muted-foreground">{text}</span>

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setEditing(true)}
      className={`h-6 rounded border border-transparent px-1 text-left text-xs text-muted-foreground hover:border-input ${className}`}
    >
      {text || <span className="text-muted-foreground/50">{placeholder}</span>}
    </button>
  )
}
