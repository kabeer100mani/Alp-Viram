import { Circle, CircleCheckBig, CircleDashed, CircleDot, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { itemStateLabel } from '@/modules/items/presentation'
import type { ItemState } from '@/modules/items/types'
import { cn } from '@/lib/utils'

/**
 * A ClickUp-style status pill (spec §3.1). A rounded pill with a coloured
 * status icon + label; clicking opens a DropdownMenu of the offered statuses,
 * each with its own coloured icon — never a native select.
 *
 * Deviation from §2: the spec sets pill text in UPPERCASE, but the project's
 * standing rule forbids all-caps anywhere, so labels render Proper Case
 * (itemStateLabel already gives "To Do" / "In progress" / "Done").
 *
 * Colours come only from the §2 tokens (var(--status-*)); "solid" statuses fill
 * the pill and use white text/icon, "ghost" statuses sit on the surface colour
 * with the status colour as text/icon.
 */
type StatusMeta = { icon: LucideIcon; solid: boolean; color: string; fillIcon?: boolean }

const STATUS: Record<ItemState, StatusMeta> = {
  captured: { icon: CircleDashed, solid: false, color: 'var(--status-todo)' },
  committed: { icon: CircleDot, solid: true, color: 'var(--status-processing)' },
  in_progress: { icon: Circle, solid: true, color: 'var(--status-progress)', fillIcon: true },
  done: { icon: CircleCheckBig, solid: true, color: 'var(--status-done)' },
  snoozed: { icon: Clock, solid: false, color: 'var(--brand)' },
  backlog: { icon: CircleDashed, solid: false, color: 'var(--text-muted)' },
}

function pillStyle(meta: StatusMeta): React.CSSProperties {
  return meta.solid
    ? { backgroundColor: meta.color, color: '#fff' }
    : { backgroundColor: 'var(--bg-surface)', color: meta.color }
}

function Pill({ state, className }: { state: ItemState; className?: string }) {
  const meta = STATUS[state]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[4px] rounded-full px-[10px] text-[11px] font-semibold',
        className,
      )}
      style={pillStyle(meta)}
    >
      <Icon className="h-3 w-3 shrink-0" fill={meta.fillIcon ? 'currentColor' : 'none'} />
      {itemStateLabel(state)}
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
  if (!canWrite) return <Pill state={state} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        disabled={disabled}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Pill state={state} className="cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[9rem]">
        {options.map((s) => {
          const meta = STATUS[s]
          const Icon = meta.icon
          return (
            <DropdownMenuItem key={s} onSelect={() => onChange(s)} className="gap-2">
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: meta.color }}
                fill={meta.fillIcon ? 'currentColor' : 'none'}
              />
              {itemStateLabel(s)}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
