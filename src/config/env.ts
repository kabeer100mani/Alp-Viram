import { z } from 'zod'

/**
 * Centralized, validated environment configuration.
 *
 * Rule: never read `import.meta.env` directly anywhere else — import `env` from
 * here. Supabase credentials are optional so the app (and tests) still run
 * without them. Empty strings are treated as "not set".
 */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const envSchema = z.object({
  VITE_SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  VITE_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  MODE: z.string().default('development'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
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
  /** True once Supabase credentials are configured. */
  isSupabaseConfigured: Boolean(data.VITE_SUPABASE_URL && data.VITE_SUPABASE_ANON_KEY),
} as const
