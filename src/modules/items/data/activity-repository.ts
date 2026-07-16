import { getSupabaseClient } from '@/lib/supabase/client'

export interface ActivityEntry {
  id: string
  eventType: string
  payload: Record<string, unknown>
  actorId: string | null
  actorName: string | null
  recordedAt: string
}

/**
 * The item's audit trail (`activity_events`) — read-only.
 *
 * The table is append-only and written by DB triggers (PDL-018 / TDL-004); nothing
 * here writes. Comment-writing is deliberately deferred.
 *
 * activity_events has a single FK to profiles (actor_id), so the embed is not
 * ambiguous — but it is named explicitly anyway, so that adding a second actor-ish
 * FK later fails loudly here instead of silently returning no names (Gate A lesson).
 */
export async function listItemActivity(itemId: string): Promise<ActivityEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from('activity_events')
    .select('id, event_type, payload, actor_id, recorded_at, profiles!activity_events_actor_id_fkey(display_name)')
    .eq('item_id', itemId)
    .order('recorded_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => {
    const rel = (r as { profiles: { display_name: string | null } | { display_name: string | null }[] | null }).profiles
    const profile = Array.isArray(rel) ? rel[0] : rel
    return {
      id: (r as { id: string }).id,
      eventType: (r as { event_type: string }).event_type,
      payload: ((r as { payload: Record<string, unknown> | null }).payload ?? {}) as Record<string, unknown>,
      actorId: (r as { actor_id: string | null }).actor_id,
      actorName: profile?.display_name ?? null,
      recordedAt: (r as { recorded_at: string }).recorded_at,
    }
  })
}
