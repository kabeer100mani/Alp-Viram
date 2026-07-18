import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Flag } from 'lucide-react'
import { priorityColor, priorityLabel, priorityOptions, type Priority } from '@/modules/items/presentation'

/**
 * A small styled priority dropdown.
 *
 * A native `<select>`'s option popup is browser chrome (white box, black text) and
 * cannot be styled cross-browser — so this renders a custom, theme-consistent option
 * list. The list is **portaled to <body> with fixed positioning** because the trigger
 * often sits inside the dense table's `overflow-x-auto` wrapper, which would clip a
 * normally-positioned dropdown (the menu was in the DOM but visually cut off).
 *
 * Keeps `role="listbox"`/`role="option"` and the trigger's aria-label, so it stays
 * accessible and testable.
 */
export function PrioritySelect({
  value,
  onChange,
  disabled = false,
  label,
  className = '',
}: {
  value: Priority
  onChange: (p: Priority) => void
  disabled?: boolean
  /** Accessible name for the trigger (e.g. "Priority for <title>" or "Priority"). */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // Position the fixed menu under the trigger before paint, so it never flashes.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    // A scroll or resize invalidates the fixed position — simplest is to close.
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-secondary/60 disabled:opacity-60"
      >
        <Flag className={`h-3 w-3 shrink-0 ${priorityColor(value)}`} fill="currentColor" />
        <span className={`truncate ${priorityColor(value)}`}>{priorityLabel(value)}</span>
        <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className="z-50 min-w-[8rem] rounded-md border border-border bg-background p-1 shadow-md"
          >
            {priorityOptions.map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={p === value}
                onClick={() => {
                  onChange(p)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary"
              >
                <Flag className={`h-3 w-3 shrink-0 ${priorityColor(p)}`} fill="currentColor" />
                <span className={priorityColor(p)}>{priorityLabel(p)}</span>
                {p === value && <Check className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
