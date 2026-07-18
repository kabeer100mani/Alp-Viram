import { Flag } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { priorityLabel, priorityOptions, type Priority } from '@/modules/items/presentation'
import { cn } from '@/lib/utils'

/**
 * A ClickUp-style priority flag (spec §3.2): a flag icon in the priority colour
 * plus its label; clicking opens a DropdownMenu of the five priorities, each with
 * its own coloured flag. "None" is an outlined, muted flag (the others are filled).
 *
 * Colours come only from the §2 tokens (var(--priority-*)). Note the enum value
 * `medium` is the spec's "Normal" (var(--priority-normal)).
 */
const COLOR: Record<Priority, string> = {
  none: 'var(--priority-none)',
  low: 'var(--priority-low)',
  medium: 'var(--priority-normal)',
  high: 'var(--priority-high)',
  urgent: 'var(--priority-urgent)',
}

function FlagMark({ p, className }: { p: Priority; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[4px] text-[13px]', className)} style={{ color: COLOR[p] }}>
      <Flag className="h-3.5 w-3.5 shrink-0" fill={p === 'none' ? 'none' : 'currentColor'} />
      <span className={p === 'none' ? 'text-[--text-muted]' : ''}>{priorityLabel(p)}</span>
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
  if (!canWrite) return <FlagMark p={value} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        disabled={disabled}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <FlagMark p={value} className="cursor-pointer" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8rem]">
        {priorityOptions.map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)} className="gap-2">
            <Flag
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: COLOR[p] }}
              fill={p === 'none' ? 'none' : 'currentColor'}
            />
            {priorityLabel(p)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
