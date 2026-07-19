import { Flag } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { priorityOptions, type Priority } from '@/modules/items/presentation'
import { useFieldPrefs } from '@/modules/fields/use-field-prefs'
import { resolvePriority } from '@/modules/fields/field-prefs'
import type { FieldPrefs } from '@/modules/fields/field-prefs'
import { cn } from '@/lib/utils'

/**
 * A ClickUp-style priority flag (spec §3.2): a flag in the priority colour + label;
 * clicking opens a DropdownMenu of the five priorities. Label + colour come from the
 * org's field prefs (PDL-049), §2 defaults as fallback. "None" is an outlined flag.
 */
function FlagMark({ p, prefs, className }: { p: Priority; prefs: FieldPrefs; className?: string }) {
  const { label, color } = resolvePriority(p, prefs)
  return (
    <span className={cn('inline-flex items-center gap-[4px] text-[13px]', className)} style={{ color }}>
      <Flag className="h-3.5 w-3.5 shrink-0" fill={p === 'none' ? 'none' : 'currentColor'} />
      <span className={p === 'none' ? 'text-[--text-muted]' : ''}>{label}</span>
    </span>
  )
}

export function PriorityFlag({
  value,
  canWrite,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: Priority
  canWrite: boolean
  disabled?: boolean
  onChange: (next: Priority) => void
  ariaLabel: string
}) {
  const prefs = useFieldPrefs()
  if (!canWrite) return <FlagMark p={value} prefs={prefs} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        disabled={disabled}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <FlagMark p={value} prefs={prefs} className="cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8rem]">
        {priorityOptions.map((p) => {
          const { label, color } = resolvePriority(p, prefs)
          return (
            <DropdownMenuItem key={p} onSelect={() => onChange(p)} className="gap-2">
              <Flag className="h-3.5 w-3.5 shrink-0" style={{ color }} fill={p === 'none' ? 'none' : 'currentColor'} />
              {label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
