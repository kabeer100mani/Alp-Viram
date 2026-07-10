import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

/**
 * The top-level chrome: a sticky header with the brand and theme toggle, plus
 * a constrained content area. Screen content is passed as children.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              A
            </div>
            <span className="text-sm font-semibold tracking-tight">Alp-Viram</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  )
}
