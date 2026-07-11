import { z } from 'zod'

/** Validation for email/password auth. Reused by the form and the service. */
export const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type Credentials = z.infer<typeof credentialsSchema>
