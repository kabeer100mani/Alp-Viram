import { z } from 'zod'

/**
 * Centralized, validated environment configuration.
 *
 * Rule: never read `import.meta.env` directly anywhere else — import `env`
 * from here. Supabase credentials are optional until Milestone 1 wires up the
 * backend, so the app still runs during Milestone 0 without them.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  MODE: z.string().default('development'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail fast with a readable message instead of a cryptic runtime error later.
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment configuration. Check your .env file.')
}

const data = parsed.data

export const env = {
  supabaseUrl: data.VITE_SUPABASE_URL,
  supabaseAnonKey: data.VITE_SUPABASE_ANON_KEY,
  mode: data.MODE,
  isProduction: data.MODE === 'production',
  isDevelopment: data.MODE !== 'production',
  /** True once Supabase credentials are configured (Milestone 1). */
  isSupabaseConfigured: Boolean(data.VITE_SUPABASE_URL && data.VITE_SUPABASE_ANON_KEY),
} as const
