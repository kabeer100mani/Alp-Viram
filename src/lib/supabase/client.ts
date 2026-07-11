import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { logger } from '@/core/logger'

let client: SupabaseClient | null = null

/**
 * Returns the shared Supabase browser client, created lazily so this module can
 * be imported in environments without credentials (e.g. unit tests) without
 * failing. Throws only if actually used while unconfigured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!env.isSupabaseConfigured) {
    logger.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    throw new Error('Supabase is not configured.')
  }
  if (!client) {
    client = createClient(env.supabaseUrl as string, env.supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

/** True when a client can be created — lets callers degrade gracefully in tests. */
export const isSupabaseReady = env.isSupabaseConfigured
