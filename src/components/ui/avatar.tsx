import { avatarColor, initials } from '@/modules/items/presentation'
import { cn } from '@/lib/utils'

/**
 * A small coloured initials circle, so people are recognisable at a glance (spec
 * §3.3). Colour is deterministic from the user id (the §2 avatar palette). When
 * `ring` is set it draws a 2px ring in the parent's background colour, for the
 * overlapping AvatarStack.
 */
export function Avatar({
  userId,
  name,
  size = 'sm',
  ring,
}: {
  userId: string
  name: string | null
  size?: 'sm' | 'xs'
  ring?: boolean
}) {
  const dim = size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'
  return (
    <span
      title={name ?? 'Member'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        dim,
        ring && 'ring-2 ring-[--bg-content]',
      )}
      style={{ backgroundColor: avatarColor(userId) }}
    >
      {initials(name)}
    </span>
  )
}
