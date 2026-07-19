import { FolderTree, Inbox, Settings2, SlidersHorizontal, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The five top-level sections (PDL-048), driving BOTH the desktop sidebar and the
 * mobile bottom tab bar — one config, two renderings. Order is the display order.
 */
export interface SectionDef {
  to: string
  label: string
  Icon: LucideIcon
}

export const SECTIONS: SectionDef[] = [
  { to: '/capture', label: 'Capture', Icon: Inbox },
  { to: '/projects', label: 'Projects', Icon: FolderTree },
  { to: '/people', label: 'People', Icon: Users },
  { to: '/settings', label: 'Settings', Icon: Settings2 },
  { to: '/statuses', label: 'Statuses', Icon: SlidersHorizontal },
]
