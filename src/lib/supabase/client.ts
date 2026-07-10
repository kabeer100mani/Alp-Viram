import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { logger } from '@/core/logger'

let client: SupabaseClient | null = null

/**
 * Returns the shared Supabase client, or `null` if credentials are not yet
 * configured (Milestone 0). Fully wired up in Milestone 1, where the generated
 * `Database` types will be added for end-to-end type safety.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!env.isSupabaseConfigured) {
    logger.warn(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
    )
    return null
  }
  if (!client) {
    client = createClient(env.supabaseUrl as string, env.supabaseAnonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}
