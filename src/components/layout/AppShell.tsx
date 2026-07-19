import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '@/modules/auth/auth-context'
import { useActiveOrg } from '@/modules/organizations/use-active-org'
import { OrgBar } from '@/modules/organizations/components/OrgBar'
import { SidebarNav } from '@/components/layout/SidebarNav'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { AiCaptureBox } from '@/modules/inbox/components/AiCaptureBox'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { SectionContext } from '@/app/section-context'

/**
 * The responsive app shell (PDL-048 / M8): a left sidebar on desktop, a bottom tab
 * bar on mobile, over the same five section routes. Provides shared context to each
 * section via <Outlet context> and hosts the global "+" capture sheet, reachable
 * from anywhere.
 */
export function AppShell() {
  const { user, signOut } = useAuth()
  const { data: org, isLoading } = useActiveOrg(user?.id)
  const [captureOpen, setCaptureOpen] = useState(false)

  if (isLoading || !org || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'there'
  const isSolo = Boolean(org.isPersonal && !org.teamEnabled)
  const isAdmin = org.role === 'owner' || org.role === 'admin'
  const isOwner = org.role === 'owner'
  const openCapture = () => setCaptureOpen(true)

  const ctx: SectionContext = { userId: user.id, displayName, org, isSolo, isAdmin, isOwner, signOut, openCapture }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SidebarNav org={org} userId={user.id} isSolo={isSolo} isAdmin={isAdmin} onCapture={openCapture} />

      {/* Mobile top header: brand + workspace switcher (the sidebar's job on desktop). */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight">SutraDhar</span>
        </div>
        <OrgBar org={org} userId={user.id} isSolo={isSolo} isAdmin={isAdmin} />
      </header>

      <main className="md:pl-56">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-10">
          <Outlet context={ctx} />
        </div>
      </main>

      <BottomTabBar />

      {/* Mobile floating "+" — quick capture from any section (Doc 5: one keystroke away). */}
      <button
        type="button"
        aria-label="Capture"
        onClick={openCapture}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Capture</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <AiCaptureBox organizationId={org.id} userId={user.id} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
