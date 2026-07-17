import { getSupabaseClient } from '@/lib/supabase/client'
import { PermissionError } from '@/core/errors'
import type { Tables } from '@/lib/supabase/database.types'

export type OrgMemberRole = 'owner' | 'admin' | 'member'

export interface Member {
  id: string
  userId: string
  role: OrgMemberRole
  displayName: string | null
  joinedAt: string
  isActive: boolean
}

export type Invitation = Tables<'invitations'>

/**
 * Members of the org, with their display name. Readable by any member.
 *
 * Active-only by default — the responsibility/assignee pickers must not offer a
 * deactivated person. The admin management surface passes `includeInactive` so a
 * deactivation isn't a black hole (you can see and reactivate).
 */
export async function listMembers(
  organizationId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Member[]> {
  let q = getSupabaseClient()
    .from('organization_members')
    // organization_members has TWO FKs to profiles (user_id and invited_by), so
    // the embed must name the exact one — otherwise PostgREST cannot disambiguate
    // and the whole query errors, leaving the members list silently empty.
    .select('id, user_id, role, joined_at, is_active, profiles!organization_members_user_id_fkey(display_name)')
    .eq('organization_id', organizationId)
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => {
    const rel = (row as { profiles: { display_name: string | null } | { display_name: string | null }[] | null })
      .profiles
    const profile = Array.isArray(rel) ? rel[0] : rel
    return {
      id: (row as { id: string }).id,
      userId: (row as { user_id: string }).user_id,
      role: (row as { role: OrgMemberRole }).role,
      displayName: profile?.display_name ?? null,
      joinedAt: (row as { joined_at: string }).joined_at,
      isActive: (row as { is_active: boolean }).is_active,
    }
  })
}

/**
 * Member offboarding — admin-only (RLS `members_update`/`members_delete` require
 * `is_org_admin`; the UI mirrors that but the database is the real gate).
 *
 * The `protect_owner_membership` trigger (0003) refuses to remove, demote, or
 * deactivate the **last active owner**, and only an owner may grant `owner`. Those
 * raise real Postgres errors (not silent 0-row), so they surface as the DB's
 * message; the caller turns a *silent* RLS denial (0 rows, no error) into a
 * PermissionError, same discipline as everywhere else.
 */
async function requireWritten<T extends { length: number }>(
  data: T | null,
  error: unknown,
  denialMessage: string,
): Promise<void> {
  if (error) throw error
  if (!data || data.length === 0) throw new PermissionError(denialMessage)
}

/** Fully remove a member from the org (deletes the membership row). */
export async function removeMember(membershipId: string): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('organization_members')
    .delete()
    .eq('id', membershipId)
    .select()
  await requireWritten(data, error, 'You cannot remove this member.')
}

/** Deactivate (revoke access, keep history) or reactivate a member. */
export async function setMemberActive(membershipId: string, isActive: boolean): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('organization_members')
    .update({ is_active: isActive })
    .eq('id', membershipId)
    .select()
  await requireWritten(data, error, 'You cannot change this member.')
}

/** Change a member's org-level role (owner / admin / member). */
export async function changeMemberRole(membershipId: string, role: OrgMemberRole): Promise<void> {
  const { data, error } = await getSupabaseClient()
    .from('organization_members')
    .update({ role })
    .eq('id', membershipId)
    .select()
  await requireWritten(data, error, 'You cannot change this member’s role.')
}

/** Pending invitations — admin-only (RLS returns nothing to non-admins). */
export async function listPendingInvitations(organizationId: string): Promise<Invitation[]> {
  const { data, error } = await getSupabaseClient()
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Invitation[]
}

/**
 * Pull the Edge Function's own error message out of a failed invoke.
 *
 * supabase-js signals a non-2xx from a function as a FunctionsHttpError with
 * `data === null` and the JSON body on `error.context` (a Response). Without
 * reading that, the user only ever sees "Edge Function returned a non-2xx status
 * code" — never the message that explains what actually went wrong ("This invite
 * has expired", "sent to a different email address").
 */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json()
      if (body?.error) return body.error as string
    } catch {
      /* body wasn't JSON — fall through */
    }
  }
  return error instanceof Error ? error.message : fallback
}

/**
 * Mint an invite (admin-only, enforced by RLS in the function). Always returns the
 * link; `emailed` says whether the server also sent it (true only once Resend is
 * configured). So the admin can always fall back to sharing the link by hand.
 */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: 'admin' | 'member',
): Promise<{ link: string; emailed: boolean }> {
  const { data, error } = await getSupabaseClient().functions.invoke('invitations', {
    // appUrl lets the server build the emailed link to match this app's origin.
    body: { action: 'create', organizationId, email, role, appUrl: window.location.origin },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'The invite could not be created.'))
  const token = (data as { token?: string })?.token
  if (!token) throw new Error('The invite could not be created.')
  return {
    link: `${window.location.origin}/invite?token=${token}`,
    emailed: Boolean((data as { emailed?: boolean })?.emailed),
  }
}

/** Redeem an invite for the signed-in user. */
export async function acceptInvitation(token: string): Promise<{ organizationId: string }> {
  const { data, error } = await getSupabaseClient().functions.invoke('invitations', {
    body: { action: 'accept', token },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'This invite could not be accepted.'))
  const organizationId = (data as { organizationId?: string })?.organizationId
  if (!organizationId) throw new Error('This invite could not be accepted.')
  return { organizationId }
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
  if (error) throw error
}
