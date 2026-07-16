import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, Folder as FolderIcon, List as ListIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateFolder, useCreateList, useListTree } from '@/modules/lists/hooks/use-lists'

/**
 * The Folder → List tree in the rail (PDL-032). Optional structure — this section
 * is simply empty until the user makes a folder or list; nothing here is required.
 *
 * Lists/folders are member-writable, so no admin gate. Selecting a list filters the
 * main pane to that list.
 */
export function ListTreeNav({
  organizationId,
  currentUserId,
  activeListId,
  onSelectList,
}: {
  organizationId: string
  currentUserId: string
  activeListId: string | undefined
  onSelectList: (listId: string, name: string) => void
}) {
  const { data: tree } = useListTree(organizationId)
  const createFolder = useCreateFolder(organizationId, currentUserId)
  const createList = useCreateList(organizationId, currentUserId)

  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<null | { kind: 'folder' } | { kind: 'list'; folderId: string | null }>(null)
  const [name, setName] = useState('')

  const toggleFolder = (id: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function submitAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n || !adding) return
    if (adding.kind === 'folder') createFolder.mutate({ name: n })
    else createList.mutate({ name: n, folderId: adding.folderId })
    setName('')
    setAdding(null)
  }

  const listButton = (list: { id: string; name: string }, indent: boolean) => (
    <li key={list.id}>
      <button
        type="button"
        onClick={() => onSelectList(list.id, list.name)}
        aria-current={activeListId === list.id ? 'page' : undefined}
        className={`flex w-full items-center gap-2 rounded-md py-1 pr-2 text-sm ${indent ? 'pl-7' : 'pl-2'} ${
          activeListId === list.id
            ? 'bg-secondary font-medium text-secondary-foreground'
            : 'text-muted-foreground hover:bg-secondary/50'
        }`}
      >
        <ListIcon className="h-3.5 w-3.5" /> {list.name}
      </button>
    </li>
  )

  return (
    <div className="space-y-1 border-t border-border pt-3">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs text-muted-foreground">Lists</span>
        <span className="flex gap-1">
          <button
            type="button"
            aria-label="New folder"
            title="New folder"
            onClick={() => { setAdding({ kind: 'folder' }); setName('') }}
            className="text-muted-foreground hover:text-foreground"
          >
            <FolderIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="New list"
            title="New list"
            onClick={() => { setAdding({ kind: 'list', folderId: null }); setName('') }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <ul className="space-y-0.5">
        {(tree?.folders ?? []).map(({ folder, lists }) => {
          const open = openFolders.has(folder.id)
          return (
            <li key={folder.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.id)}
                  aria-expanded={open}
                  className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary/50"
                >
                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <FolderIcon className="h-3.5 w-3.5" /> {folder.name}
                </button>
                <button
                  type="button"
                  aria-label={`New list in ${folder.name}`}
                  title={`New list in ${folder.name}`}
                  onClick={() => { setAdding({ kind: 'list', folderId: folder.id }); setName(''); setOpenFolders((p) => new Set(p).add(folder.id)) }}
                  className="px-1 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {open && <ul className="space-y-0.5">{lists.map((l) => listButton(l, true))}</ul>}
            </li>
          )
        })}
        {(tree?.rootLists ?? []).map((l) => listButton(l, false))}
      </ul>

      {adding && (
        <form onSubmit={submitAdd} className="flex items-center gap-1 px-2 pt-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={adding.kind === 'folder' ? 'Folder name' : 'List name'}
            aria-label={adding.kind === 'folder' ? 'New folder name' : 'New list name'}
            className="h-7 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}>
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
