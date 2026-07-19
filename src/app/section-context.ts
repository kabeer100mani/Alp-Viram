import { useOutletContext } from 'react-router-dom'
import type { ActiveOrg } from '@/modules/organizations/use-active-org'

/**
 * Shared context the AppShell hands to every section route (via <Outlet context>).
 * Sections read it with useSection() instead of each re-deriving org/user/roles.
 */
export interface SectionContext {
  userId: string
  displayName: string
  org: ActiveOrg
  isSolo: boolean
  isAdmin: boolean
  isOwner: boolean
  signOut: () => Promise<void>
  /** Open the global capture sheet (the "+"), reachable from any section (PDL-048). */
  openCapture: () => void
}

export function useSection(): SectionContext {
  return useOutletContext<SectionContext>()
}
