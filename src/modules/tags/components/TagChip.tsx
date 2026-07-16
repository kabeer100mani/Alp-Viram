import { X } from 'lucide-react'
import { tagColor } from '@/modules/tags/tag-color'
import type { Tag } from '@/modules/tags/data/tags-repository'

/** One flat tag (PDL-010). */
export function TagChip({
  tag,
  onRemove,
  onClick,
}: {
  tag: Tag
  /** Shown only when the caller may write — never offer an edit RLS would refuse. */
  onRemove?: () => void
  onClick?: () => void
}) {
  const style = tagColor(tag)
  const inner = (
    <>
      {tag.name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove tag ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="opacity-60 hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </>
  )

  const className = `inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${style}`
  const inlineStyle = tag.color ? { backgroundColor: `${tag.color}22`, color: tag.color } : undefined

  if (onClick && !onRemove) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Filter by tag ${tag.name}`}
        className={`${className} hover:brightness-95`}
        style={inlineStyle}
      >
        {inner}
      </button>
    )
  }

  return (
    <span className={className} style={inlineStyle}>
      {inner}
    </span>
  )
}
