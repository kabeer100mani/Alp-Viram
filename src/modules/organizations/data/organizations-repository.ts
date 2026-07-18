import { getSupabaseClient } from '@/lib/supabase/client'
import { PermissionError } from '@/core/errors'

export interface MyOrg {
  id: string
  name: string
  isPersonal: boolean
  teamEnabled: boolean
  role: string
}

interface OrgRow {
  id: string
  name: string
  is_personal: boolean
  team_enabled: boolean
}

/**
 * Every organization the user belongs to (PDL-009: multi-org kept, but **one active
 * at a time** — this feeds the switcher, never a combined cross-org view).
 */
export async function listMyOrgs(userId: string): Promise<MyOrg[]> {
  const { data, error } = await getSupabaseClient()
    .from('organization_members')
    .select('role, organizations(id, name, is_personal, team_enabled)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
  if (error) throw error

  return (data ?? [])
    .map((row) => {
      const rel = (row as { organizations: OrgRow | OrgRow[] | null }).organizations
      const org = Array.isArray(rel) ? rel[0] : rel
      if (!org) return null
      return {
        id: org.id,
        name: org.name,
        isPersonal: org.is_personal,
        teamEnabled: org.team_enabled,
        role: (row as { role: string }).role,
      }
    })
    .filter((o): o is MyOrg => o !== null)
}

/**
 * Create a brand-new personal organization for the current user and return its id
 * (PDL-045). This calls a SECURITY DEFINER routine rather than inserting directly:
 * the owner-membership insert is blocked by RLS for a non-member (see the migration
 * 0022 header), so the org + owner row must be created atomically server-side. The
 * new org's system views are seeded automatically by a trigger.
 */
export async function createOrganization(name: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('create_organization', {
    p_name: name.trim(),
  })
  if (error) throw error
  if (!data || typeof data !== 'string') {
    throw new Error('That workspace could not be created.')
  }
  return data
}

/**
 * Rename an organization. RLS (`orgs_update`) already restricts this to
 * `is_org_admin`; the UI mirrors that rather than relying on it alone.
 *
 * `slug` is deliberately NOT regenerated (M6 D2): it is `unique not null`, so
 * regenerating invites collisions and breaks any existing reference — for a purely
 * cosmetic gain. The display name is what users see; the slug is an identifier.
 *
 * RLS denies silently (0 rows, no error), so `.select()` forces the result back and
 * a refusal becomes a real PermissionError instead of a false "saved".
 */
export async function renameOrganization(id: string, name: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new PermissionError('Only an admin can rename this workspace.')
  }
}

/**
 * Permanently delete an organization and everything in it (TD-007). Irreversible.
 *
 * Owner-only (RLS `orgs_delete` = `is_org_owner`); the UI mirrors that and adds a
 * type-to-confirm gate. The cascade completes because 0018 taught the audit triggers
 * and the append-only guard to distinguish teardown from live-org tampering.
 *
 * A silent RLS 0-row (non-owner) becomes a PermissionError rather than a false
 * "deleted". `.select()` forces the affected row back to tell the difference.
 */
export async function deleteOrganization(id: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('organizations')
    .delete()
    .eq('id', id)
    .select()
  if (error) throw error
  if (!data || data.length === 0) {
    throw new PermissionError('Only the workspace owner can delete it.')
  }
}
