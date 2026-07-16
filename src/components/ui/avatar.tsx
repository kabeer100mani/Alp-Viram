import { avatarColor, initials } from '@/modules/items/presentation'

/** A small coloured initials circle, so people are recognisable at a glance. */
export function Avatar({ userId, name, size = 'sm' }: { userId: string; name: string | null; size?: 'sm' | 'xs' }) {
  const dim = size === 'xs' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'
  return (
    <span
      title={name ?? 'Member'}
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full font-medium text-white ${avatarColor(userId)}`}
    >
      {initials(name)}
    </span>
  )
}
