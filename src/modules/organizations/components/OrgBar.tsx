import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Pencil, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useCreateOrganization, useMyOrgs, useRenameOrganization, useSwitchOrg } from '@/modules/organizations/hooks/use-organizations'
import type { ActiveOrg } from '@/modules/organizations/use-active-org'

/**
 * The workspace name, with rename (admin), the multi-org switcher (PDL-009), and
 * self-service workspace creation (PDL-045).
 *
 * Progressive disclosure (PDL-022): a solo user with one organization is not shown
 * their workspace name or a one-entry switcher. But self-service creation
 * deliberately relaxes this one notch — the whole point of PDL-045 is letting a
 * solo person keep several personal workspaces ("Personal", "Job 1"…), so a quiet
 * "New workspace" entry must be reachable even before a second org exists. The
 * moment there are 2+, the full named switcher appears on its own.
 */
export function OrgBar({
  org,
  userId,
  isSolo,
  isAdmin,
}: {
  org: ActiveOrg
  userId: string
  isSolo: boolean
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(org.name)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: orgs } = useMyOrgs(userId)
  const rename = useRenameOrganization(userId)
  const switchOrg = useSwitchOrg()
  const createOrg = useCreateOrganization()

  useEffect(() => setName(org.name), [org.id, org.name])

  // Click-away closes the switcher.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const canSwitch = (orgs?.length ?? 0) > 1

  function save() {
    const next = name.trim()
    if (!next || next === org.name) {
      setName(org.name)
      setEditing(false)
      return
    }
    rename.mutate(
      { id: org.id, name: next },
      {
        onError: (e) => {
          setError(e instanceof Error ? e.message : 'That name could not be saved.')
          setName(org.name)
        },
        onSettled: () => setEditing(false),
      },
    )
  }

  function createWorkspace() {
    const next = newName.trim()
    if (!next) return
    setError(null)
    createOrg.mutate(next, {
      onSuccess: () => {
        // The hook switches into the new org and clears the cache; this bar
        // re-renders with the new org. Reset local state so it starts clean.
        setCreating(false)
        setNewName('')
        setOpen(false)
      },
      onError: (e) => setError(e instanceof Error ? e.message : 'That workspace could not be created.'),
    })
  }

  // The inline "name a new workspace" field, shared by the solo entry and the
  // switcher menu. Enter creates, Escape cancels.
  const createField = (
    <Input
      autoFocus
      aria-label="New workspace name"
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          createWorkspace()
        }
        if (e.key === 'Escape') {
          setCreating(false)
          setNewName('')
        }
      }}
      onBlur={() => {
        if (!newName.trim()) setCreating(false)
      }}
      placeholder="Workspace name…"
      className="h-6 w-44 text-sm"
    />
  )

  // Solo user, single org: the whole bar is otherwise silent (PDL-022). Offer only
  // the quiet create entry (PDL-045) — no name, no one-item switcher.
  if (isSolo && !canSwitch) {
    return (
      <div className="flex items-center gap-1">
        {creating ? (
          createField
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded p-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New workspace
          </button>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {editing ? (
        <Input
          autoFocus
          aria-label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setName(org.name)
              setEditing(false)
            }
          }}
          className="h-6 w-48 text-sm"
        />
      ) : (
        <>
          <span className="text-sm text-muted-foreground">{org.name}</span>
          {/* Rename is admin-only, matching the `orgs_update` policy — the UI must
              never offer an action the database will refuse (Doc 8). */}
          {isAdmin && (
            <button
              type="button"
              aria-label="Rename workspace"
              onClick={() => setEditing(true)}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Switch workspace"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
        {open && (
          <div
            role="menu"
            aria-label="Workspaces"
            className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-md border border-border bg-background p-1 shadow-md"
          >
            {orgs?.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  if (o.id !== org.id) switchOrg(o.id)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-secondary"
              >
                <Check className={`h-3 w-3 shrink-0 ${o.id === org.id ? '' : 'invisible'}`} />
                <span className="truncate">{o.name}</span>
              </button>
            ))}
            {/* Create a new workspace from the switcher (PDL-045). */}
            <div className="mt-1 border-t border-border pt-1">
              {creating ? (
                <div className="px-1 py-0.5">{createField}</div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3 w-3 shrink-0" /> New workspace
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
