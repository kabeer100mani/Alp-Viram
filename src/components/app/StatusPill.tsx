import { Circle, CircleCheckBig, CircleDashed, CircleDot, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFieldPrefs } from '@/modules/fields/use-field-prefs'
import { resolveStatus } from '@/modules/fields/field-prefs'
import type { FieldPrefs } from '@/modules/fields/field-prefs'
import type { ItemState } from '@/modules/items/types'
import { cn } from '@/lib/utils'

/**
 * A ClickUp-style status pill (spec §3.1). Rounded pill with a coloured status icon
 * + label; clicking opens a DropdownMenu of the offered statuses. Label + colour come
 * from the org's field prefs (PDL-049) with the §2 values as fallback; the `solid`
 * (filled vs ghost) style and the icon are fixed per status.
 *
 * Deviation from §2: labels are Proper Case, not UPPERCASE (no-all-caps rule).
 */
const ICONS: Record<ItemState, { icon: LucideIcon; fillIcon?: boolean }> = {
  captured: { icon: CircleDashed },
  committed: { icon: CircleDot },
  in_progress: { icon: Circle, fillIcon: true },
  done: { icon: CircleCheckBig },
  snoozed: { icon: Clock },
  backlog: { icon: CircleDashed },
}

function Pill({ state, prefs, className }: { state: ItemState; prefs: FieldPrefs; className?: string }) {
  const { label, color, solid } = resolveStatus(state, prefs)
  const { icon: Icon, fillIcon } = ICONS[state]
  const style = solid
    ? { backgroundColor: color, color: '#fff' }
    : { backgroundColor: 'var(--bg-surface)', color }
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[4px] rounded-full px-[10px] text-[11px] font-semibold',
        className,
      )}
      style={style}
    >
      <Icon className="h-3 w-3 shrink-0" fill={fillIcon ? 'currentColor' : 'none'} />
      {label}
    </span>
  )
}

export function StatusPill({
  state,
  options,
  canWrite,
  disabled,
  onChange,
  ariaLabel,
}: {
  state: ItemState
  options: ItemState[]
  canWrite: boolean
  disabled?: boolean
  onChange: (next: ItemState) => void
  ariaLabel: string
}) {
  const prefs = useFieldPrefs()
  if (!canWrite) return <Pill state={state} prefs={prefs} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        disabled={disabled}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Pill state={state} prefs={prefs} className="cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        {options.map((s) => {
          const { label, color } = resolveStatus(s, prefs)
          const { icon: Icon, fillIcon } = ICONS[s]
          return (
            <DropdownMenuItem key={s} onSelect={() => onChange(s)} className="gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} fill={fillIcon ? 'currentColor' : 'none'} />
              {label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
