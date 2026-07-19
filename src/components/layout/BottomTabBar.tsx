import { NavLink } from 'react-router-dom'
import { SECTIONS } from '@/components/layout/sections'

/**
 * The mobile bottom tab bar (<md) — the native phone navigation pattern, and the
 * one Doc 5 §5 anticipated ("the same views collapse into a bottom nav later").
 * Same SECTIONS as the desktop sidebar (PDL-048).
 */
export function BottomTabBar() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-[--bg-sidebar] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {SECTIONS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
