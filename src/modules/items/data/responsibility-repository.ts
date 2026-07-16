import { getSupabaseClient } from '@/lib/supabase/client'

/**
 * Responsibility on an item — the two orthogonal axes of the hybrid model
 * (Doc 9): responsibility is a **Role**, execution is an **Assigned User**.
 * Plus optional Collaborators.
 *
 * An item never stores a person for responsibility. Who is responsible *now* is
 * derived from the role's current assignment window (current_responsible_users).
 * All writes are gated on can_write_item by RLS (migration 0005) — the same rule
 * the item card already respects.
 */

export interface ResponsibleRole {
  id: string
  roleId: string
  roleName: string
  isPrimary: boolean
}

export interface AssignedUser {
  id: string
  userId: string
  displayName: string | null
  isPrimary: boolean
  assignedVia: string
}

export interface Collaborator {
  id: string
  userId: string
  displayName: string | null
}

/** The person(s) currently responsible, derived through the role assignments. */
export interface CurrentHolder {
  userId: string
  roleId: string
  isPrimary: boolean
}

export interface ItemResponsibility {
  responsibleRoles: ResponsibleRole[]
  assignedUsers: AssignedUser[]
  collaborators: Collaborator[]
  currentHolders: CurrentHolder[]
}

const client = () => getSupabaseClient()
type ProfileRel = { display_name: string | null } | { display_name: string | null }[] | null
const nameOf = (rel: ProfileRel) => (Array.isArray(rel) ? rel[0] : rel)?.display_name ?? null

export async function getItemResponsibility(itemId: string): Promise<ItemResponsibility> {
  const [roles, users, collabs, holders] = await Promise.all([
    client().from('item_responsible_roles').select('id, role_id, is_primary, roles(name)').eq('item_id', itemId),
    // item_assigned_users and item_collaborators each have two FKs to profiles
    // (user_id, created_by), so name the exact one or PostgREST errors (Gate A lesson).
    client()
      .from('item_assigned_users')
      .select('id, user_id, is_primary, assigned_via, profiles!item_assigned_users_user_id_fkey(display_name)')
      .eq('item_id', itemId),
    client()
      .from('item_collaborators')
      .select('id, user_id, profiles!item_collaborators_user_id_fkey(display_name)')
      .eq('item_id', itemId),
    client().rpc('current_responsible_users', { p_item_id: itemId }),
  ])
  if (roles.error) throw roles.error
  if (users.error) throw users.error
  if (collabs.error) throw collabs.error
  if (holders.error) throw holders.error

  return {
    responsibleRoles: (roles.data ?? []).map((r) => {
      const rel = (r as { roles: { name: string } | { name: string }[] | null }).roles
      return {
        id: (r as { id: string }).id,
        roleId: (r as { role_id: string }).role_id,
        roleName: (Array.isArray(rel) ? rel[0] : rel)?.name ?? 'role',
        isPrimary: (r as { is_primary: boolean }).is_primary,
      }
    }),
    assignedUsers: (users.data ?? []).map((u) => ({
      id: (u as { id: string }).id,
      userId: (u as { user_id: string }).user_id,
      displayName: nameOf((u as { profiles: ProfileRel }).profiles),
      isPrimary: (u as { is_primary: boolean }).is_primary,
      assignedVia: (u as { assigned_via: string }).assigned_via,
    })),
    collaborators: (collabs.data ?? []).map((c) => ({
      id: (c as { id: string }).id,
      userId: (c as { user_id: string }).user_id,
      displayName: nameOf((c as { profiles: ProfileRel }).profiles),
    })),
    currentHolders: ((holders.data ?? []) as { user_id: string; role_id: string; is_primary: boolean }[]).map((h) => ({
      userId: h.user_id,
      roleId: h.role_id,
      isPrimary: h.is_primary,
    })),
  }
}

// ── Responsible roles ───────────────────────────────────────────────────────

export async function addResponsibleRole(
  organizationId: string,
  itemId: string,
  roleId: string,
  createdBy: string,
  makePrimary = false,
): Promise<void> {
  if (makePrimary) await clearPrimaryRole(itemId)
  const { error } = await client().from('item_responsible_roles').insert({
    organization_id: organizationId,
    item_id: itemId,
    role_id: roleId,
    is_primary: makePrimary,
    created_by: createdBy,
  })
  if (error) throw error
}

export async function removeResponsibleRole(id: string): Promise<void> {
  const { error } = await client().from('item_responsible_roles').delete().eq('id', id)
  if (error) throw error
}

async function clearPrimaryRole(itemId: string): Promise<void> {
  // Only one primary is allowed (uq_irr_primary), so demote the current one first.
  await client().from('item_responsible_roles').update({ is_primary: false }).eq('item_id', itemId).eq('is_primary', true)
}

/**
 * Set the single primary responsible role for an item (used by triage: pick a
 * role, or clear it). Replaces whatever primary role was set.
 */
export async function setPrimaryResponsibleRole(
  organizationId: string,
  itemId: string,
  roleId: string | null,
  createdBy: string,
): Promise<void> {
  await clearPrimaryRole(itemId)
  if (roleId === null) return
  // Upsert: the role may already be attached (non-primary) — flip it to primary.
  const existing = await client()
    .from('item_responsible_roles')
    .select('id')
    .eq('item_id', itemId)
    .eq('role_id', roleId)
    .maybeSingle()
  if (existing.data) {
    const { error } = await client().from('item_responsible_roles').update({ is_primary: true }).eq('id', existing.data.id)
    if (error) throw error
  } else {
    const { error } = await client().from('item_responsible_roles').insert({
      organization_id: organizationId,
      item_id: itemId,
      role_id: roleId,
      is_primary: true,
      created_by: createdBy,
    })
    if (error) throw error
  }
}

// ── Assigned users & collaborators ──────────────────────────────────────────

export async function addAssignedUser(
  organizationId: string,
  itemId: string,
  userId: string,
  createdBy: string,
): Promise<void> {
  const { error } = await client().from('item_assigned_users').insert({
    organization_id: organizationId,
    item_id: itemId,
    user_id: userId,
    assigned_via: 'direct',
    created_by: createdBy,
  })
  if (error) throw error
}

export async function removeAssignedUser(id: string): Promise<void> {
  const { error } = await client().from('item_assigned_users').delete().eq('id', id)
  if (error) throw error
}

export async function addCollaborator(organizationId: string, itemId: string, userId: string): Promise<void> {
  const { error } = await client()
    .from('item_collaborators')
    .insert({ organization_id: organizationId, item_id: itemId, user_id: userId })
  if (error) throw error
}

export async function removeCollaborator(id: string): Promise<void> {
  const { error } = await client().from('item_collaborators').delete().eq('id', id)
  if (error) throw error
}
