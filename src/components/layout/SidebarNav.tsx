import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { SECTIONS } from '@/components/layout/sections'
import { OrgBar } from '@/modules/organizations/components/OrgBar'
import type { ActiveOrg } from '@/modules/organizations/use-active-org'

/**
 * The desktop section sidebar (≥md). The same SECTIONS also drive the mobile
 * BottomTabBar — one config, two renderings (PDL-048).
 */
export function SidebarNav({
  org,
  userId,
  isSolo,
  isAdmin,
  onCapture,
}: {
  org: ActiveOrg
  userId: string
  isSolo: boolean
  isAdmin: boolean
  onCapture: () => void
}) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-[--bg-sidebar] px-3 py-4 md:flex">
      <div className="flex items-center gap-2 px-1">
        <img src="/favicon.svg" alt="" className="h-6 w-auto" />
        <span className="text-sm font-semibold tracking-tight">SutraDhar</span>
      </div>

      {/* Workspace name + switcher (stays silent for a solo single-org user, PDL-022). */}
      <div className="mt-3 min-h-[1.5rem] px-1">
        <OrgBar org={org} userId={userId} isSolo={isSolo} isAdmin={isAdmin} />
      </div>

      {/* Global quick capture (PDL-048) — one click from any section. Labelled
          "Quick capture" so it's clearly distinct from the "Capture" section tab. */}
      <button
        type="button"
        onClick={onCapture}
        className="mt-4 flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> Quick capture
      </button>

      <nav aria-label="Sections" className="mt-4 space-y-0.5">
        {SECTIONS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${
                isActive
                  ? 'bg-[--bg-active] text-foreground'
                  : 'text-muted-foreground hover:bg-[--bg-hover] hover:text-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
