import { ChevronRight, LogOut, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { OrgBar } from '@/modules/organizations/components/OrgBar'
import { useSection } from '@/app/section-context'

/**
 * Settings section (PDL-048): workspace name/rename/switch/new workspace, appearance,
 * and account. Consolidates controls that were scattered across the old header.
 * (Workspace deletion still lives in People for now — moves here in a later pass.)
 */
export function SettingsSection() {
  const { org, userId, isAdmin, signOut } = useSection()

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Workspace</h2>
        {/* isSolo=false so the name + rename + switcher always show here, even for a
            solo user — Settings is where you manage the workspace. */}
        <OrgBar org={org} userId={userId} isSolo={false} isAdmin={isAdmin} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Customization</h2>
        <Link
          to="/statuses"
          className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-sm hover:bg-[--bg-hover]"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Statuses &amp; priorities
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <p className="text-xs text-muted-foreground">Rename statuses and priorities and set their colors.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Appearance</h2>
        <p className="text-xs text-muted-foreground">
          Dark theme. Light mode returns in a later update.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </section>
    </div>
  )
}
