// Supabase Edge Function (Deno) — member invitations.
//
// Two actions the client cannot do under RLS, so they live server-side behind a
// verified user JWT (TDL-011):
//
//   create — an admin mints an invite for an email; returns a shareable token.
//            (An admin *could* insert via RLS, but minting the token and
//            enforcing the invariants belongs in one trusted place.)
//   accept — the invitee joins. This REQUIRES the service role: members_insert
//            demands is_org_admin, and the invitee is not an admin (nor a member
//            yet), so no client policy can perform this insert. The service role
//            bypasses RLS; every check below is therefore explicit and manual.
//
// Email delivery is deferred (PDL-011): create returns a link for the admin to
// share; no mail is sent.
import { createClient } from 'npm:@supabase/supabase-js@2.110.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const url = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    // A client scoped to the caller's JWT — used to identify them and to run
    // reads/writes AS them (so RLS still applies to the admin-side checks).
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: auth } = await asUser.auth.getUser()
    const user = auth.user
    if (!user) return json({ error: 'Not authenticated.' }, 401)

    // The service-role client: bypasses RLS. Used ONLY for the membership insert
    // on accept, which no client policy can perform.
    const asService = createClient(url, serviceKey, { auth: { persistSession: false } })

    const body = await req.json()
    const action = body?.action

    // ── create ────────────────────────────────────────────────────────────
    if (action === 'create') {
      const organizationId = String(body.organizationId ?? '')
      const email = String(body.email ?? '').trim().toLowerCase()
      const role = body.role === 'admin' ? 'admin' : 'member' // never owner
      if (!organizationId || !email) return json({ error: 'organizationId and email are required.' }, 400)
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'That is not a valid email.' }, 400)

      // Authorization is enforced by RLS: the insert's WITH CHECK requires
      // is_org_admin AND invited_by = auth.uid(), so a non-admin caller is
      // refused here without us re-implementing the check.
      const token = randomToken()
      const { data, error } = await asUser
        .from('invitations')
        .upsert(
          {
            organization_id: organizationId,
            email,
            role,
            token,
            status: 'pending',
            invited_by: user.id,
            expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
            accepted_by: null,
            accepted_at: null,
          },
          { onConflict: 'organization_id,email' },
        )
        .select('token')
        .single()
      if (error) return json({ error: error.message }, error.message.includes('row-level security') ? 403 : 400)
      return json({ token: data.token }, 200)
    }

    // ── accept ────────────────────────────────────────────────────────────
    if (action === 'accept') {
      const token = String(body.token ?? '')
      if (!token) return json({ error: 'token is required.' }, 400)

      const { data: invite } = await asService
        .from('invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle()
      if (!invite) return json({ error: 'This invite link is not valid.' }, 404)
      if (invite.status !== 'pending') return json({ error: 'This invite has already been used or revoked.' }, 409)
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        return json({ error: 'This invite has expired.' }, 409)
      }
      // The invite is for a specific email — the signed-in user must match it, so
      // a leaked link cannot be redeemed by someone else.
      if ((user.email ?? '').toLowerCase() !== invite.email) {
        return json({ error: 'This invite was sent to a different email address.' }, 403)
      }

      // Idempotent: if they are already an active member, just mark it accepted.
      const { data: existing } = await asService
        .from('organization_members')
        .select('id, is_active')
        .eq('organization_id', invite.organization_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing) {
        const { error: memErr } = await asService.from('organization_members').insert({
          organization_id: invite.organization_id,
          user_id: user.id,
          role: invite.role,
          invited_by: invite.invited_by,
          invited_at: invite.created_at,
        })
        if (memErr) return json({ error: memErr.message }, 400)
      }

      await asService
        .from('invitations')
        .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
        .eq('id', invite.id)

      return json({ organizationId: invite.organization_id }, 200)
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
