import { getSupabaseClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

export type OrgMemberRole = 'owner' | 'admin' | 'member'

export interface Member {
  userId: string
  role: OrgMemberRole
  displayName: string | null
  joinedAt: string
}

export type Invitation = Tables<'invitations'>

/** Members of the org, with their display name. Readable by any member. */
export async function listMembers(organizationId: string): Promise<Member[]> {
  const { data, error } = await getSupabaseClient()
    .from('organization_members')
    // organization_members has TWO FKs to profiles (user_id and invited_by), so
    // the embed must name the exact one — otherwise PostgREST cannot disambiguate
    // and the whole query errors, leaving the members list silently empty.
    .select('user_id, role, joined_at, profiles!organization_members_user_id_fkey(display_name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => {
    const rel = (row as { profiles: { display_name: string | null } | { display_name: string | null }[] | null })
      .profiles
    const profile = Array.isArray(rel) ? rel[0] : rel
    return {
      userId: (row as { user_id: string }).user_id,
      role: (row as { role: OrgMemberRole }).role,
      displayName: profile?.display_name ?? null,
      joinedAt: (row as { joined_at: string }).joined_at,
    }
  })
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

/** Mint an invite (admin-only, enforced by RLS in the function). Returns a link. */
export async function createInvitation(
  organizationId: string,
  email: string,
  role: 'admin' | 'member',
): Promise<{ link: string }> {
  const { data, error } = await getSupabaseClient().functions.invoke('invitations', {
    body: { action: 'create', organizationId, email, role },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'The invite could not be created.'))
  const token = (data as { token?: string })?.token
  if (!token) throw new Error('The invite could not be created.')
  return { link: `${window.location.origin}/invite?token=${token}` }
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
