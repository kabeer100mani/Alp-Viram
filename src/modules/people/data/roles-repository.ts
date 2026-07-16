import { getSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type Role = Tables<'roles'>

/**
 * Roles + time-bounded role-assignments — the heart of the responsibility model
 * (Doc 9). A role is a durable business responsibility; who holds it *now* is
 * derived through the assignment window, so replacing a person is one assignment
 * change and every item responsible to that role follows, with no item edits.
 *
 * All writes are admin-only (RLS, migrations 0002/0005). Nothing is ever deleted:
 * roles retire via is_active, assignments close via valid_to (TDL-009).
 */

export interface AssignmentHolder {
  assignmentId: string
  userId: string
  displayName: string | null
  validFrom: string
  validTo: string | null
}

export async function listRoles(organizationId: string): Promise<Role[]> {
  const { data, error } = await getSupabaseClient()
    .from('roles')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as Role[]
}

export async function createRole(
  organizationId: string,
  name: string,
  createdBy: string,
): Promise<Role> {
  const { data, error } = await getSupabaseClient()
    .from('roles')
    .insert({ organization_id: organizationId, name: name.trim(), created_by: createdBy })
    .select('*')
    .single()
  if (error) throw error
  return data as Role
}

export async function renameRole(id: string, name: string): Promise<void> {
  const { error } = await getSupabaseClient().from('roles').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

/** Retire, never delete — deleting a role would cascade its assignments and the
 *  item responsibilities derived from it (TD-001 / TDL-009). */
export async function retireRole(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('roles').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

/**
 * Assignments for a role. `role_assignments` has two FKs to profiles (user_id and
 * created_by), so the embed must name the exact one or PostgREST errors and the
 * list silently empties (the Gate A lesson).
 */
export async function listAssignments(roleId: string): Promise<AssignmentHolder[]> {
  const { data, error } = await getSupabaseClient()
    .from('role_assignments')
    .select('id, user_id, valid_from, valid_to, profiles!role_assignments_user_id_fkey(display_name)')
    .eq('role_id', roleId)
    .order('valid_from', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const rel = (row as { profiles: { display_name: string | null } | { display_name: string | null }[] | null })
      .profiles
    const profile = Array.isArray(rel) ? rel[0] : rel
    return {
      assignmentId: (row as { id: string }).id,
      userId: (row as { user_id: string }).user_id,
      displayName: profile?.display_name ?? null,
      validFrom: (row as { valid_from: string }).valid_from,
      validTo: (row as { valid_to: string | null }).valid_to,
    }
  })
}

/** True while valid_from ≤ now < valid_to (or valid_to is null). */
export function isCurrent(a: AssignmentHolder): boolean {
  const now = Date.now()
  return new Date(a.validFrom).getTime() <= now && (a.validTo === null || new Date(a.validTo).getTime() > now)
}

export async function assignUserToRole(
  organizationId: string,
  roleId: string,
  userId: string,
  createdBy: string,
): Promise<void> {
  const { error } = await getSupabaseClient().from('role_assignments').insert({
    organization_id: organizationId,
    role_id: roleId,
    user_id: userId,
    created_by: createdBy,
  })
  if (error) throw error
}

/** Close an assignment — the handover. Zero item rows change. */
export async function closeAssignment(assignmentId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('role_assignments')
    .update({ valid_to: new Date().toISOString() })
    .eq('id', assignmentId)
  if (error) throw error
}
