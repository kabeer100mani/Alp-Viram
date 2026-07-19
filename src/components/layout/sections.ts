import { FolderTree, Home, MessageSquarePlus, Settings2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The five top-level sections (PDL-051), driving BOTH the desktop sidebar and the
 * mobile bottom tab bar — one config, two renderings. Home is the task view; Capture
 * is the capture surface. "Statuses" is not a tab — it lives inside Settings.
 */
export interface SectionDef {
  to: string
  label: string
  Icon: LucideIcon
}

export const SECTIONS: SectionDef[] = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/capture', label: 'Capture', Icon: MessageSquarePlus },
  { to: '/projects', label: 'Projects', Icon: FolderTree },
  { to: '/people', label: 'People', Icon: Users },
  { to: '/settings', label: 'Settings', Icon: Settings2 },
]
