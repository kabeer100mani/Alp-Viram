import { Link, NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { SECTIONS } from '@/components/layout/sections'
import { OrgBar } from '@/modules/organizations/components/OrgBar'
import type { ActiveOrg } from '@/modules/organizations/use-active-org'

/**
 * The desktop section sidebar (≥md). Collapses to an icon-only rail on click
 * (PDL-051); the same SECTIONS drive the mobile BottomTabBar.
 */
export function SidebarNav({
  org,
  userId,
  isSolo,
  isAdmin,
  onCapture,
  collapsed,
  onToggleCollapse,
}: {
  org: ActiveOrg
  userId: string
  isSolo: boolean
  isAdmin: boolean
  onCapture: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 hidden flex-col border-r border-border bg-[--bg-sidebar] py-4 md:flex ${
        collapsed ? 'w-16 px-2 items-center' : 'w-56 px-3'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1`}>
        <Link to="/" aria-label="Home" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-6 w-auto" />
          {!collapsed && <span className="text-sm font-semibold tracking-tight">SutraDhar</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggleCollapse}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          aria-label="Expand sidebar"
          onClick={onToggleCollapse}
          className="mt-3 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <div className="mt-3 min-h-[1.5rem] px-1">
          <OrgBar org={org} userId={userId} isSolo={isSolo} isAdmin={isAdmin} />
        </div>
      )}

      {/* Global quick capture (PDL-048/051) — one click from any section. */}
      <button
        type="button"
        onClick={onCapture}
        aria-label="Quick capture"
        className={`mt-4 flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 ${
          collapsed ? 'w-10 px-0' : 'px-3'
        }`}
      >
        <Plus className="h-4 w-4" />
        {!collapsed && 'Quick capture'}
      </button>

      <nav aria-label="Sections" className="mt-4 w-full space-y-0.5">
        {SECTIONS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md py-2 text-sm ${collapsed ? 'justify-center px-0' : 'px-2'} ${
                isActive
                  ? 'bg-[--bg-active] text-foreground'
                  : 'text-muted-foreground hover:bg-[--bg-hover] hover:text-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
