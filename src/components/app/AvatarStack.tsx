import { Avatar } from '@/components/ui/avatar'

/**
 * An overlapping stack of avatars (spec §3.3): up to `max` visible, each ringed in
 * the parent's background colour, overlapping by −6px, with a "+N" chip for the rest.
 */
export function AvatarStack({
  people,
  max = 2,
  size = 'xs',
}: {
  people: { userId: string; name: string | null }[]
  max?: number
  size?: 'sm' | 'xs'
}) {
  if (people.length === 0) return null
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  const dim = size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'

  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <span key={p.userId} className={i > 0 ? '-ml-1.5' : ''}>
          <Avatar userId={p.userId} name={p.name} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className={`-ml-1.5 inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-[--bg-surface] font-semibold text-[--text-secondary] ring-2 ring-[--bg-content]`}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}
