import { useQuery } from '@tanstack/react-query'
import { listAiCaptures } from '@/modules/inbox/data/ai-captures-repository'

/** The Capture history feed for an org (M9 Gate B). */
export function useAiCaptures(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['ai-captures', organizationId],
    queryFn: () => listAiCaptures(organizationId as string),
    enabled: Boolean(organizationId),
  })
}
