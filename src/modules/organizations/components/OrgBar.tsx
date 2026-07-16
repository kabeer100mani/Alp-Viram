import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useMyOrgs, useRenameOrganization, useSwitchOrg } from '@/modules/organizations/hooks/use-organizations'
import type { ActiveOrg } from '@/modules/organizations/use-active-org'

/**
 * The workspace name, with rename (admin) and the multi-org switcher (PDL-009).
 *
 * Progressive disclosure (PDL-022): a solo user with exactly one organization sees
 * **nothing** here. Their org is an implementation detail they are deliberately not
 * shown — surfacing a "workspace switcher" with one entry would leak the tenancy
 * model to the very user the rule exists to protect. The switcher appears when
 * there is genuinely somewhere to switch to.
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
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: orgs } = useMyOrgs(userId)
  const rename = useRenameOrganization(userId)
  const switchOrg = useSwitchOrg()

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
  // Solo + single org → this whole bar is silent (PDL-022).
  if (isSolo && !canSwitch) return null

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

      {canSwitch && (
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
            </div>
          )}
        </div>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
