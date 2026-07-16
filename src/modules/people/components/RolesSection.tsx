import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RoleCard } from '@/modules/people/components/RoleCard'
import { useCreateRole, useRoles } from '@/modules/people/hooks/use-roles'
import type { Member } from '@/modules/people/data/people-repository'

/**
 * Roles management on the People & Roles surface. Roles are a durable business
 * responsibility, distinct from a member's platform permission (TDL-017): being
 * an admin doesn't make you responsible for anything, and vice versa.
 *
 * Admin-only writes (RLS enforces it too); members see roles read-only.
 */
export function RolesSection({
  organizationId,
  members,
  isAdmin,
  currentUserId,
}: {
  organizationId: string
  members: Member[]
  isAdmin: boolean
  currentUserId: string
}) {
  const { data: roles, isLoading } = useRoles(organizationId, true)
  const createRole = useCreateRole(organizationId)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    try {
      await createRole.mutateAsync({ name: trimmed, createdBy: currentUserId })
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The role could not be created.')
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="text-sm text-muted-foreground">
          Durable responsibilities. Who holds one now is derived from the current assignment.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : roles && roles.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              members={members}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No roles yet.{isAdmin ? ' Create one below.' : ''}
        </p>
      )}

      {isAdmin && (
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <Input
            placeholder="New role (e.g. Finance, Client Lead)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New role name"
            className="max-w-xs"
          />
          <Button type="submit" disabled={createRole.isPending || !name.trim()}>
            Add role
          </Button>
        </form>
      )}
    </section>
  )
}
