import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronRight, Folder as FolderIcon, Info, List as ListIcon, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCreateFolder,
  useCreateList,
  useCreateProject,
  useProjectTree,
  useUpdateProjectContext,
} from '@/modules/lists/hooks/use-lists'

/**
 * The container tree in the rail (PDL-035): Organization → Project → Folder → List.
 * All optional — the section is empty until you make a Project.
 *
 * Projects and Folders expand/collapse (they hold no tasks directly); only a
 * **List** is selectable — that's where tasks live. A List can sit inside a Folder
 * or straight under a Project (folderless).
 *
 * Member-writable, so no admin gate. "+ Project" at the top; "+ Folder" and
 * "+ List" per project; "+ List" per folder.
 */
type Adding =
  | { kind: 'project' }
  | { kind: 'folder'; projectId: string }
  | { kind: 'list'; projectId: string; folderId: string | null }

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
  const { data: tree } = useProjectTree(organizationId)
  const createProject = useCreateProject(organizationId, currentUserId)
  const createFolder = useCreateFolder(organizationId, currentUserId)
  const createList = useCreateList(organizationId, currentUserId)
  const updateContext = useUpdateProjectContext(organizationId)

  const [open, setOpen] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Adding | null>(null)
  const [name, setName] = useState('')
  // The new project's free-text context (PDL-044) — what it's about / who's involved.
  const [context, setContext] = useState('')
  // Editing an existing project's context: { id, value } while open.
  const [editCtx, setEditCtx] = useState<{ id: string; value: string } | null>(null)

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const ensureOpen = (id: string) => setOpen((prev) => new Set(prev).add(id))
  const startAdd = (a: Adding) => {
    setAdding(a)
    setName('')
  }

  function submitAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n || !adding) return
    if (adding.kind === 'project') createProject.mutate({ name: n, context: context.trim() || null })
    else if (adding.kind === 'folder') createFolder.mutate({ projectId: adding.projectId, name: n })
    else createList.mutate({ projectId: adding.projectId, name: n, folderId: adding.folderId })
    setName('')
    setContext('')
    setAdding(null)
  }

  function saveContext() {
    if (!editCtx) return
    updateContext.mutate({ id: editCtx.id, context: editCtx.value })
    setEditCtx(null)
  }

  const iconBtn = (label: string, onClick: () => void, node: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="px-1 text-muted-foreground hover:text-foreground"
    >
      {node}
    </button>
  )

  const listButton = (list: { id: string; name: string }, indent: number) => (
    <li key={list.id}>
      <button
        type="button"
        onClick={() => onSelectList(list.id, list.name)}
        aria-current={activeListId === list.id ? 'page' : undefined}
        className={`flex w-full items-center gap-2 rounded-md py-1 pr-2 text-sm ${
          activeListId === list.id
            ? 'bg-secondary font-medium text-secondary-foreground'
            : 'text-muted-foreground hover:bg-secondary/50'
        }`}
        style={{ paddingLeft: `${indent}rem` }}
      >
        <ListIcon className="h-3.5 w-3.5" /> {list.name}
      </button>
    </li>
  )

  return (
    <div className="space-y-1 border-t border-border pt-3">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs text-muted-foreground">Projects</span>
        {iconBtn('New project', () => startAdd({ kind: 'project' }), <Plus className="h-3.5 w-3.5" />)}
      </div>

      <ul className="space-y-0.5">
        {(tree ?? []).map(({ project, folders, rootLists }) => {
          const pOpen = open.has(project.id)
          return (
            <li key={project.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggle(project.id)}
                  aria-expanded={pOpen}
                  className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-secondary/50"
                >
                  {pOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {project.name}
                </button>
                {iconBtn(`Context for ${project.name}`, () => setEditCtx({ id: project.id, value: project.context ?? '' }), <Info className="h-3 w-3" />)}
                {iconBtn(`New folder in ${project.name}`, () => { startAdd({ kind: 'folder', projectId: project.id }); ensureOpen(project.id) }, <FolderIcon className="h-3 w-3" />)}
                {iconBtn(`New list in ${project.name}`, () => { startAdd({ kind: 'list', projectId: project.id, folderId: null }); ensureOpen(project.id) }, <Plus className="h-3 w-3" />)}
              </div>

              {/* Inline free-text context editor (PDL-044): what it's about / who's
                  involved. Feeds keyword ranking of the capture follow-up. */}
              {editCtx?.id === project.id && (
                <div className="space-y-1 px-2 py-1">
                  <textarea
                    autoFocus
                    value={editCtx.value}
                    onChange={(e) => setEditCtx({ id: project.id, value: e.target.value })}
                    placeholder="What is this project about? Who's involved?"
                    aria-label={`Context for ${project.name}`}
                    rows={3}
                    className="w-full rounded border border-input bg-background p-1.5 text-xs"
                  />
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={saveContext} disabled={updateContext.isPending}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditCtx(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {pOpen && (
                <ul className="space-y-0.5">
                  {folders.map(({ folder, lists }) => {
                    const fOpen = open.has(folder.id)
                    return (
                      <li key={folder.id}>
                        <div className="flex items-center" style={{ paddingLeft: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => toggle(folder.id)}
                            aria-expanded={fOpen}
                            className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-secondary/50"
                          >
                            {fOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <FolderIcon className="h-3.5 w-3.5" /> {folder.name}
                          </button>
                          {iconBtn(`New list in ${folder.name}`, () => { startAdd({ kind: 'list', projectId: project.id, folderId: folder.id }); ensureOpen(folder.id) }, <Plus className="h-3 w-3" />)}
                        </div>
                        {fOpen && <ul className="space-y-0.5">{lists.map((l) => listButton(l, 3))}</ul>}
                      </li>
                    )
                  })}
                  {/* Folderless lists, directly under the project. */}
                  {rootLists.map((l) => listButton(l, 2))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {adding && (
        <form onSubmit={submitAdd} className="space-y-1 px-2 pt-1">
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={adding.kind === 'project' ? 'Project name' : adding.kind === 'folder' ? 'Folder name' : 'List name'}
              aria-label={adding.kind === 'project' ? 'New project name' : adding.kind === 'folder' ? 'New folder name' : 'New list name'}
              className="h-7 text-xs"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}>
              Add
            </Button>
          </div>
          {/* Optional context for a new project (PDL-044) — never blocks creation. */}
          {adding.kind === 'project' && (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Optional: what's it about? who's involved? (helps filing)"
              aria-label="New project context"
              rows={2}
              className="w-full rounded border border-input bg-background p-1.5 text-xs"
            />
          )}
        </form>
      )}
    </div>
  )
}
