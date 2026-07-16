import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/modules/tags/components/TagChip'
import {
  useAddTagToItem,
  useCreateTag,
  useItemTags,
  useRemoveTagFromItem,
  useTags,
} from '@/modules/tags/hooks/use-tags'

/**
 * Tag an item (PDL-010, flat). A tag can be **created while tagging** — requiring a
 * trip to a settings screen first would make organising a setup gate, which PDL-005
 * rejects.
 *
 * Writes require `can_write_item` (RLS `p_item_tags_write`), so the controls are
 * hidden when `canWrite` is false — the UI must never offer what the DB refuses.
 */
export function TagPicker({
  itemId,
  organizationId,
  canWrite,
  onError,
}: {
  itemId: string
  organizationId: string
  canWrite: boolean
  onError: (m: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const { data: allTags } = useTags(organizationId)
  const { data: itemTagMap } = useItemTags([itemId])
  const add = useAddTagToItem(organizationId)
  const remove = useRemoveTagFromItem(organizationId)
  const create = useCreateTag(organizationId)

  const fail = (e: unknown) => onError(e instanceof Error ? e.message : 'That change could not be saved.')
  const tagIds = itemTagMap?.get(itemId) ?? []
  const tags = (allTags ?? []).filter((t) => tagIds.includes(t.id))
  const available = (allTags ?? []).filter((t) => !tagIds.includes(t.id))
  const busy = add.isPending || remove.isPending || create.isPending

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = text.trim()
    if (!name) return
    // Re-use an existing tag when the name matches — case-insensitively, mirroring
    // the DB's own `uq_tags_org_name` on lower(name). Typing "Urgent" when "urgent"
    // exists must not error; it should just tag it.
    const existing = (allTags ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!tagIds.includes(existing.id)) {
        add.mutate({ itemId, tagId: existing.id }, { onError: fail })
      }
      setText('')
      setAdding(false)
      return
    }
    create.mutate(
      { name },
      {
        onError: fail,
        onSuccess: (tag) => {
          add.mutate({ itemId, tagId: (tag as { id: string }).id }, { onError: fail })
          setText('')
          setAdding(false)
        },
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          onRemove={canWrite ? () => remove.mutate({ itemId, tagId: tag.id }, { onError: fail }) : undefined}
        />
      ))}
      {tags.length === 0 && !adding && <span className="text-muted-foreground">No tags</span>}

      {canWrite && !adding && (
        <button
          type="button"
          aria-label={`Add a tag to this item`}
          onClick={() => setAdding(true)}
          disabled={busy}
          className="inline-flex items-center gap-0.5 rounded border border-dashed border-input px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-input hover:text-foreground"
        >
          <Plus className="h-2.5 w-2.5" /> Tag
        </button>
      )}

      {canWrite && adding && (
        <form onSubmit={onSubmit} className="flex items-center gap-1">
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setText('')
                setAdding(false)
              }
            }}
            list={`tags-${itemId}`}
            placeholder="Tag name…"
            aria-label="Tag name"
            className="h-6 w-32 text-xs"
          />
          {/* Existing tags offered, but a new name is equally valid — no gate. */}
          <datalist id={`tags-${itemId}`}>
            {available.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          <Button type="submit" size="sm" variant="secondary" aria-label="Add tag" disabled={!text.trim() || busy}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
