import { createContext, useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase/client'
import { PermissionError } from '@/core/errors'
import type { FieldPrefs } from '@/modules/fields/field-prefs'

/**
 * The active org's field prefs, provided by the AppShell so every StatusPill /
 * PriorityFlag renders the org's custom labels + colours. Defaults to `{}` (all §2
 * defaults) so components (and tests) work without a provider.
 */
const FieldPrefsContext = createContext<FieldPrefs>({})
export const FieldPrefsProvider = FieldPrefsContext.Provider
export function useFieldPrefs(): FieldPrefs {
  return useContext(FieldPrefsContext)
}

/** Fetch the org's field_prefs (any member may read). */
export function useOrgFieldPrefs(orgId: string | undefined) {
  return useQuery<FieldPrefs>({
    queryKey: ['field-prefs', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('organizations')
        .select('field_prefs')
        .eq('id', orgId as string)
        .single()
      if (error) throw error
      return (data?.field_prefs ?? {}) as FieldPrefs
    },
  })
}

/**
 * Update the org's field_prefs (admins only — the RLS `orgs_update` policy gates it;
 * a silent 0-row denial becomes a PermissionError, mirroring renameOrganization).
 */
export function useUpdateFieldPrefs(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: FieldPrefs) => {
      const { data, error } = await getSupabaseClient()
        .from('organizations')
        .update({ field_prefs: next })
        .eq('id', orgId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new PermissionError('Only an admin can change status and priority labels.')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-prefs', orgId] }),
  })
}
