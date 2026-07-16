import type { Tag } from '@/modules/tags/data/tags-repository'

/**
 * A tag's colour classes. When `tags.color` is set, the chip uses it inline and
 * this returns '' (no palette class). Otherwise the colour is derived from the id,
 * so a tag looks the same everywhere without anyone being forced to pick a colour
 * at creation (PDL-005: organising is never a setup gate).
 */
const palette = [
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
]

export function tagColor(tag: Pick<Tag, 'id' | 'color'>): string {
  if (tag.color) return ''
  let h = 0
  for (const ch of tag.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}
